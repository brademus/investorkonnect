import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createClient } from 'npm:@base44/sdk@0.8.6';

async function downloadSignedPdf(envelopeId, env) {
  const accessToken = Deno.env.get(`DOCUSIGN_ACCESS_TOKEN_${env.toUpperCase()}`);
  const accountId = Deno.env.get(`DOCUSIGN_ACCOUNT_ID_${env.toUpperCase()}`);
  const baseUri = Deno.env.get(`DOCUSIGN_BASE_URI_${env.toUpperCase()}`);
  
  const pdfUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`;
  const response = await fetch(pdfUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/pdf'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to download signed PDF');
  }
  
  return await response.arrayBuffer();
}

async function sha256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function calculateNJReviewEnd() {
  // NJ: 3 business days from now
  let date = new Date();
  let businessDays = 0;
  
  while (businessDays < 3) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Not weekend
      businessDays++;
    }
  }
  
  // Set to end of day
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

/**
 * POST /api/docusign/webhook
 * Handle DocuSign Connect webhook events
 */
Deno.serve(async (req) => {
  try {
    // Verify webhook signature
    const signature = req.headers.get('X-DocuSign-Signature-1');
    const webhookSecret = Deno.env.get('DOCUSIGN_WEBHOOK_SECRET');
    
    // TODO: Implement proper HMAC verification if webhookSecret is set
    
    const event = await req.json();
    console.log('[DocuSign Webhook] Event received:', event.event);
    
    const envelopeId = event.data?.envelopeId || event.envelopeId;
    if (!envelopeId) {
      console.log('[DocuSign Webhook] No envelope ID, ignoring');
      return Response.json({ received: true });
    }
    
    // Find agreement by envelope ID
    const base44 = createClient(Deno.env.get('BASE44_APP_ID'), {
      serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });
    
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
      docusign_envelope_id: envelopeId 
    });
    
    if (!agreements || agreements.length === 0) {
      console.log('[DocuSign Webhook] Agreement not found for envelope:', envelopeId);
      return Response.json({ received: true });
    }
    
    const agreement = agreements[0];
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    
    // Update based on event
    const eventType = event.event || event.data?.envelopeStatus;
    console.log('[DocuSign Webhook] Processing event:', eventType, 'for agreement:', agreement.id);
    
    const updates = {
      docusign_status: eventType,
      audit_log: [
        ...(agreement.audit_log || []),
        {
          timestamp: new Date().toISOString(),
          actor: 'DocuSign',
          action: `webhook_${eventType}`,
          details: `DocuSign status: ${eventType}`
        }
      ]
    };
    
    // Map DocuSign events to agreement status
    switch (eventType) {
      case 'sent':
      case 'delivered':
        updates.status = 'sent';
        break;
        
      case 'signing_complete':
      case 'completed':
        // Check which recipients have signed
        const recipients = event.data?.envelopeRecipients || [];
        const investorRecipient = recipients.find(r => r.recipientId === agreement.investor_recipient_id);
        const agentRecipient = recipients.find(r => r.recipientId === agreement.agent_recipient_id);
        
        const investorSigned = investorRecipient?.status === 'completed';
        const agentSigned = agentRecipient?.status === 'completed';
        
        if (investorSigned && !agreement.investor_signed_at) {
          updates.investor_signed_at = new Date().toISOString();
        }
        
        if (agentSigned && !agreement.agent_signed_at) {
          updates.agent_signed_at = new Date().toISOString();
        }
        
        // Determine status
        if (investorSigned && agentSigned) {
          // Both signed - check if NJ for attorney review
          if (agreement.governing_state === 'NJ') {
            updates.status = 'attorney_review_pending';
            updates.nj_review_end_at = calculateNJReviewEnd();
            console.log('[DocuSign Webhook] NJ deal - entering attorney review until', updates.nj_review_end_at);
          } else {
            updates.status = 'fully_signed';
          }
          
          // Download signed PDF
          try {
            const pdfBuffer = await downloadSignedPdf(envelopeId, env);
            const pdfHash = await sha256(pdfBuffer);
            
            // Upload to storage
            const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
            const file = new File([blob], `agreement_${agreement.id}_signed.pdf`);
            const uploadResponse = await base44.integrations.Core.UploadFile({ file });
            
            updates.signed_pdf_url = uploadResponse.file_url;
            updates.signed_pdf_sha256 = pdfHash;
            
            console.log('[DocuSign Webhook] Signed PDF uploaded:', uploadResponse.file_url);
          } catch (error) {
            console.error('[DocuSign Webhook] Failed to download/upload signed PDF:', error);
          }
        } else if (investorSigned) {
          updates.status = 'investor_signed';
        } else if (agentSigned) {
          updates.status = 'agent_signed';
        }
        break;
        
      case 'voided':
      case 'declined':
        updates.status = 'draft';
        updates.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'DocuSign',
          action: 'envelope_voided',
          details: `Envelope ${eventType} - can regenerate`
        });
        break;
    }
    
    // Update agreement
    await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
    console.log('[DocuSign Webhook] Agreement updated:', agreement.id);

    // Persist signed agreement into Deal.documents so Shared Files can show it immediately
    try {
      const finalStatus = updates.status || agreement.status;
      if ((finalStatus === 'fully_signed' || finalStatus === 'attorney_review_pending') && (updates.signed_pdf_url || agreement.signed_pdf_url)) {
        const nowIso = new Date().toISOString();
        const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
        const existingDeal = dealArr[0] || {};
        const existingDocs = existingDeal.documents || {};
        const signedUrl = updates.signed_pdf_url || agreement.signed_pdf_url;
        const docMeta = {
          url: signedUrl,
          name: 'Internal Agreement (Signed).pdf',
          type: 'application/pdf',
          uploaded_at: nowIso,
          verified: true
        };
        const newDocs = {
          ...existingDocs,
          operating_agreement: docMeta,
          internal_agreement: docMeta
        };
        await base44.asServiceRole.entities.Deal.update(agreement.deal_id, { documents: newDocs, is_fully_signed: true });
        console.log('[DocuSign Webhook] ✓ Deal.documents updated with signed agreement');
      }
    } catch (e) {
      console.warn('[DocuSign Webhook] Warning: failed to persist signed agreement to Deal.documents', e?.message || e);
    }
    
    return Response.json({ received: true });
  } catch (error) {
    console.error('[DocuSign Webhook] Error:', error);
    // Return 200 to prevent DocuSign retries for processing errors
    return Response.json({ received: true, error: error.message });
  }
});
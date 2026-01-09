import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected. Admin must connect DocuSign first.');
  }
  
  const connection = connections[0];
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  if (now >= expiresAt) {
    throw new Error('DocuSign token expired. Admin must reconnect DocuSign.');
  }
  
  return connection;
}

async function downloadPdf(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download PDF');
  }
  const buffer = await response.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * POST /api/legalAgreement/:id/docusign/envelope
 * Create or reuse DocuSign envelope
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreementId } = await req.json();
    
    if (!agreementId) {
      return Response.json({ error: 'agreementId required' }, { status: 400 });
    }
    
    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreementId });
    if (!agreements || agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    const agreement = agreements[0];
    
    // Check if envelope already exists and is usable
    if (agreement.docusign_envelope_id && 
        agreement.docusign_status !== 'completed' && 
        agreement.docusign_status !== 'voided') {
      console.log('[DocuSign] Reusing envelope:', agreement.docusign_envelope_id);
      return Response.json({ 
        success: true, 
        envelopeId: agreement.docusign_envelope_id,
        reused: true
      });
    }
    
    // Get DocuSign connection from database
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    // Load investor and agent profiles
    const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.investor_profile_id });
    const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.agent_profile_id });
    
    const investor = investorProfiles[0];
    const agent = agentProfiles[0];
    
    if (!investor || !agent) {
      return Response.json({ error: 'Investor or agent profile not found' }, { status: 404 });
    }
    
    // Use DocuSign-specific PDF with correct anchors (not legacy final_pdf_url)
    const pdfUrl = agreement.docusign_pdf_url || agreement.signing_pdf_url || agreement.final_pdf_url;
    if (!pdfUrl) {
      return Response.json({ error: 'Agreement PDF not generated yet. Please generate from Agreement tab.' }, { status: 400 });
    }

    const pdfBase64 = await downloadPdf(pdfUrl);
    
    // Generate unique client user IDs for embedded signing
    const investorClientUserId = `investor_${agreement.id}_${Date.now()}`;
    const agentClientUserId = `agent_${agreement.id}_${Date.now()}`;
    
    // Create envelope request
    const envelopeDefinition = {
      emailSubject: `Sign Agreement - ${agreement.governing_state} Deal`,
      documents: [{
        documentBase64: pdfBase64,
        name: 'Investor-Agent Operating Agreement',
        fileExtension: 'pdf',
        documentId: '1'
      }],
      recipients: {
        signers: [
          {
            email: investor.email,
            name: investor.full_name || investor.email,
            recipientId: '1',
            routingOrder: '1',
            clientUserId: investorClientUserId,
            tabs: {
              signHereTabs: [{
                anchorString: '[[INVESTOR_SIGN]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorMatchWholeWord: true,
                anchorCaseSensitive: false
              }],
              dateSignedTabs: [{
                anchorString: '[[INVESTOR_DATE]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorMatchWholeWord: true,
                anchorCaseSensitive: false
              }],
              fullNameTabs: [{
                anchorString: '[[INVESTOR_PRINT]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorMatchWholeWord: true,
                anchorCaseSensitive: false,
                name: 'Investor Full Name',
                value: investor.full_name || investor.email,
                locked: true,
                required: true
              }]
            }
          },
          {
            email: agent.email,
            name: agent.full_name || agent.email,
            recipientId: '2',
            routingOrder: '2',
            clientUserId: agentClientUserId,
            tabs: {
              signHereTabs: [{
                anchorString: '[[AGENT_SIGN]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorMatchWholeWord: true,
                anchorCaseSensitive: false
              }],
              dateSignedTabs: [{
                anchorString: '[[AGENT_DATE]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorMatchWholeWord: true,
                anchorCaseSensitive: false
              }],
              fullNameTabs: [{
                anchorString: '[[AGENT_PRINT]]',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorMatchWholeWord: true,
                anchorCaseSensitive: false,
                name: 'Agent Full Name',
                value: agent.full_name || agent.email,
                locked: true,
                required: true
              }],
              textTabs: [
                {
                  anchorString: '[[AGENT_LICENSE]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorMatchWholeWord: true,
                  anchorCaseSensitive: false,
                  name: 'License Number',
                  value: agent.agent?.license_number || agent.license_number || '',
                  locked: false,
                  required: true
                },
                {
                  anchorString: '[[AGENT_BROKERAGE]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorMatchWholeWord: true,
                  anchorCaseSensitive: false,
                  name: 'Brokerage',
                  value: agent.agent?.brokerage || agent.broker || '',
                  locked: false,
                  required: true
                }
              ]
            }
          }
        ]
      },
      status: 'sent'
    };
    
    // Create envelope
    const createUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`;
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(envelopeDefinition)
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[DocuSign] Envelope creation failed:', errorText);
      return Response.json({ 
        error: 'Failed to create envelope',
        details: errorText
      }, { status: 500 });
    }
    
    const envelope = await createResponse.json();
    console.log('[DocuSign] Envelope created:', envelope.envelopeId);
    
    // Update agreement
    await base44.asServiceRole.entities.LegalAgreement.update(agreementId, {
      docusign_envelope_id: envelope.envelopeId,
      docusign_status: 'sent',
      investor_recipient_id: '1',
      agent_recipient_id: '2',
      investor_client_user_id: investorClientUserId,
      agent_client_user_id: agentClientUserId,
      status: 'sent',
      audit_log: [
        ...(agreement.audit_log || []),
        {
          timestamp: new Date().toISOString(),
          actor: user.email,
          action: 'envelope_created',
          details: `DocuSign envelope ${envelope.envelopeId} created`
        }
      ]
    });
    
    return Response.json({ 
      success: true, 
      envelopeId: envelope.envelopeId,
      reused: false
    });
  } catch (error) {
    console.error('[DocuSign Create Envelope] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
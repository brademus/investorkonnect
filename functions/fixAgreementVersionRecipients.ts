import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fix existing AgreementVersion records by copying recipient IDs from LegalAgreement
 * One-time fix for signing issues
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    
    // Get all AgreementVersion records
    const allVersions = await base44.asServiceRole.entities.AgreementVersion.list('-created_date', 1000);
    
    console.log(`[fixAgreementVersionRecipients] Found ${allVersions.length} AgreementVersion records`);
    
    let fixed = 0;
    let skipped = 0;
    const errors = [];
    
    for (const version of allVersions) {
      // Skip if already has recipient IDs
      if (version.investor_recipient_id && version.agent_recipient_id) {
        skipped++;
        continue;
      }
      
      console.log(`[fixAgreementVersionRecipients] Fixing version ${version.id} for deal ${version.deal_id}`);
      
      try {
        // Find corresponding LegalAgreement
        const legalAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
          deal_id: version.deal_id 
        });
        
        if (!legalAgreements || legalAgreements.length === 0) {
          console.warn(`[fixAgreementVersionRecipients] No LegalAgreement found for deal ${version.deal_id}`);
          errors.push(`Version ${version.id}: no LegalAgreement found`);
          continue;
        }
        
        const legalAgreement = legalAgreements[0];
        
        // Copy missing fields
        const updates = {};
        if (!version.investor_recipient_id && legalAgreement.investor_recipient_id) {
          updates.investor_recipient_id = legalAgreement.investor_recipient_id;
        }
        if (!version.agent_recipient_id && legalAgreement.agent_recipient_id) {
          updates.agent_recipient_id = legalAgreement.agent_recipient_id;
        }
        if (!version.investor_client_user_id && legalAgreement.investor_client_user_id) {
          updates.investor_client_user_id = legalAgreement.investor_client_user_id;
        }
        if (!version.agent_client_user_id && legalAgreement.agent_client_user_id) {
          updates.agent_client_user_id = legalAgreement.agent_client_user_id;
        }
        if (!version.investor_profile_id && legalAgreement.investor_profile_id) {
          updates.investor_profile_id = legalAgreement.investor_profile_id;
        }
        if (!version.agent_profile_id && legalAgreement.agent_profile_id) {
          updates.agent_profile_id = legalAgreement.agent_profile_id;
        }
        if (!version.docusign_last_sent_sha256 && legalAgreement.docusign_pdf_sha256) {
          updates.docusign_last_sent_sha256 = legalAgreement.docusign_pdf_sha256;
        }
        
        if (Object.keys(updates).length === 0) {
          console.log(`[fixAgreementVersionRecipients] Version ${version.id} already has all required fields`);
          skipped++;
          continue;
        }
        
        await base44.asServiceRole.entities.AgreementVersion.update(version.id, updates);
        fixed++;
        console.log(`[fixAgreementVersionRecipients] ✓ Fixed version ${version.id}`, updates);
      } catch (error) {
        const msg = `Version ${version.id}: ${error.message}`;
        console.error(`[fixAgreementVersionRecipients] Error:`, msg);
        errors.push(msg);
      }
    }
    
    console.log(`[fixAgreementVersionRecipients] Summary: fixed=${fixed}, skipped=${skipped}, errors=${errors.length}`);
    
    return Response.json({ 
      success: true,
      fixed,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[fixAgreementVersionRecipients] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
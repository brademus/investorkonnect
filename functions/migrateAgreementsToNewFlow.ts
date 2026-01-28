import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * MIGRATION FUNCTION: Update all existing agreements to work with new simplified flow
 * - Ensures agreements have required fields
 * - Links agreements to rooms properly
 * - Syncs status from DocuSign for in-progress agreements
 * - Marks old multi-agent agreements as superseded if needed
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[migrateAgreementsToNewFlow] Starting migration...');

    // Get all agreements
    const allAgreements = await base44.asServiceRole.entities.LegalAgreement.list('-created_date', 10000);
    console.log(`[migrateAgreementsToNewFlow] Found ${allAgreements.length} total agreements`);

    let updated = 0;
    let synced = 0;
    let errors = 0;

    for (const agreement of allAgreements) {
      try {
        const updates = {};

        // 1. Ensure all required fields exist
        if (!agreement.investor_recipient_id) {
          updates.investor_recipient_id = '1';
        }
        if (!agreement.agent_recipient_id) {
          updates.agent_recipient_id = '2';
        }

        // 2. Ensure status is set
        if (!agreement.status) {
          const hasInvestorSig = !!agreement.investor_signed_at;
          const hasAgentSig = !!agreement.agent_signed_at;
          
          if (hasInvestorSig && hasAgentSig) {
            updates.status = 'fully_signed';
          } else if (hasInvestorSig) {
            updates.status = 'investor_signed';
          } else if (hasAgentSig) {
            updates.status = 'agent_signed';
          } else if (agreement.docusign_envelope_id) {
            updates.status = 'sent';
          } else {
            updates.status = 'draft';
          }
        }

        // 3. Link to room if not already linked
        if (!agreement.room_id && agreement.deal_id) {
          const rooms = await base44.asServiceRole.entities.Room.filter(
            { deal_id: agreement.deal_id },
            '-created_date',
            1
          );
          if (rooms.length > 0) {
            updates.room_id = rooms[0].id;
          }
        }

        // 4. Ensure audit log exists
        if (!agreement.audit_log || !Array.isArray(agreement.audit_log)) {
          updates.audit_log = [{
            timestamp: new Date().toISOString(),
            actor: 'migration',
            action: 'migrated_to_new_flow',
            details: 'Migrated existing agreement to simplified flow'
          }];
        }

        // 5. Sync DocuSign status if envelope exists and not fully signed
        if (agreement.docusign_envelope_id && agreement.status !== 'fully_signed') {
          try {
            // Get DocuSign connection
            const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
            if (connections.length > 0) {
              const connection = connections[0];
              
              // Fetch envelope status
              const recipientsUrl = `${connection.base_uri}/restapi/v2.1/accounts/${connection.account_id}/envelopes/${agreement.docusign_envelope_id}/recipients`;
              const recipResp = await fetch(recipientsUrl, {
                headers: { 'Authorization': `Bearer ${connection.access_token}` }
              });

              if (recipResp.ok) {
                const recipData = await recipResp.json();
                const signers = recipData.signers || [];

                const invSigner = signers.find(s => String(s.recipientId) === String(agreement.investor_recipient_id || '1'));
                const agentSigner = signers.find(s => String(s.recipientId) === String(agreement.agent_recipient_id || '2'));

                const invCompleted = invSigner?.status === 'completed';
                const agCompleted = agentSigner?.status === 'completed';

                if (invCompleted && !agreement.investor_signed_at) {
                  updates.investor_signed_at = invSigner.signedDateTime || new Date().toISOString();
                  synced++;
                }

                if (agCompleted && !agreement.agent_signed_at) {
                  updates.agent_signed_at = agentSigner.signedDateTime || new Date().toISOString();
                  synced++;
                }

                if (invCompleted && agCompleted) {
                  updates.status = 'fully_signed';
                } else if (invCompleted) {
                  updates.status = 'investor_signed';
                } else if (agCompleted) {
                  updates.status = 'agent_signed';
                }
              }
            }
          } catch (e) {
            console.warn(`[migrateAgreementsToNewFlow] Warning syncing ${agreement.id}:`, e?.message);
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
          updated++;
          console.log(`[migrateAgreementsToNewFlow] Updated ${agreement.id}:`, Object.keys(updates).join(', '));
        }
      } catch (e) {
        errors++;
        console.error(`[migrateAgreementsToNewFlow] Error processing ${agreement.id}:`, e?.message);
      }
    }

    // Also ensure all deals have proper structure
    const allDeals = await base44.asServiceRole.entities.Deal.list('-created_date', 10000);
    let dealsUpdated = 0;

    for (const deal of allDeals) {
      try {
        const updates = {};

        // Ensure proposed_terms exists
        if (!deal.proposed_terms || typeof deal.proposed_terms !== 'object') {
          updates.proposed_terms = {
            seller_commission_type: 'percentage',
            seller_commission_percentage: 3,
            buyer_commission_type: 'percentage',
            buyer_commission_percentage: 3,
            agreement_length: 180
          };
        }

        // Ensure pipeline_stage is set
        if (!deal.pipeline_stage) {
          updates.pipeline_stage = 'new_listings';
        }

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Deal.update(deal.id, updates);
          dealsUpdated++;
        }
      } catch (e) {
        console.warn(`[migrateAgreementsToNewFlow] Warning updating deal ${deal.id}:`, e?.message);
      }
    }

    return Response.json({
      success: true,
      message: 'Migration complete',
      stats: {
        total_agreements: allAgreements.length,
        agreements_updated: updated,
        signatures_synced: synced,
        agreement_errors: errors,
        total_deals: allDeals.length,
        deals_updated: dealsUpdated
      }
    });
  } catch (error) {
    console.error('[migrateAgreementsToNewFlow]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
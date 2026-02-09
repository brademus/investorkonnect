import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get the active legal agreement for a deal/room.
 * Priority: room pointer > room-scoped > deal-level
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let deal_id, room_id;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      deal_id = url.searchParams.get('deal_id');
      room_id = url.searchParams.get('room_id');
    } else {
      const body = await req.json();
      deal_id = body.deal_id;
      room_id = body.room_id;
    }

    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });

    let agreement = null;

    // Resolve the caller's profile to check if they're an agent with a specific invite
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const callerProfile = profiles?.[0];
    const callerIsAgent = callerProfile?.user_role === 'agent';

    // 1. For AGENTS: prefer the investor-signed agreement so the agent signs the SAME envelope.
    //    If the agent has a regenerated agreement (after counter-offer), use that instead.
    //    But never use an agent_only agreement that has no investor signature.
    if (callerIsAgent && callerProfile && room_id) {
      // First check for agent-specific regenerated agreement (counter-offer flow)
      const invites = await base44.asServiceRole.entities.DealInvite.filter({
        deal_id, agent_profile_id: callerProfile.id
      });
      const myInvite = invites?.[0];
      if (myInvite?.legal_agreement_id) {
        const arr = await base44.asServiceRole.entities.LegalAgreement.filter({ id: myInvite.legal_agreement_id });
        const inviteAgreement = arr?.[0];
        if (inviteAgreement && !['superseded', 'voided'].includes(inviteAgreement.status)) {
          // Only use this if it has investor signature or is mode 'both' — never use stale agent_only
          if (inviteAgreement.investor_signed_at || inviteAgreement.signer_mode === 'both') {
            agreement = inviteAgreement;
            console.log('[getLegalAgreement] Agent-specific agreement from invite:', agreement.id, 'status:', agreement.status);
          } else {
            console.log('[getLegalAgreement] Invite agreement', inviteAgreement.id, 'is', inviteAgreement.signer_mode, 'without investor sig — skipping, will find investor-signed one');
          }
        }
      }

      // If no valid agent-specific agreement, find the investor-signed agreement for this deal/room
      if (!agreement) {
        const allAg = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 10);
        const investorSigned = allAg.find(a =>
          a.investor_signed_at &&
          a.docusign_envelope_id &&
          !['superseded', 'voided'].includes(a.status)
        );
        if (investorSigned) {
          agreement = investorSigned;
          console.log('[getLegalAgreement] Using investor-signed agreement for agent:', agreement.id);
        }
      }
    }

    // 2. Try room pointer (for investors or if agent invite didn't yield a result)
    if (!agreement && room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      const room = rooms?.[0];
      if (room?.current_legal_agreement_id) {
        const arr = await base44.asServiceRole.entities.LegalAgreement.filter({ id: room.current_legal_agreement_id });
        if (arr?.[0]) agreement = arr[0];
      }
    }

    // 3. Fallback: search by room_id or deal_id
    if (!agreement) {
      let list = [];
      if (room_id) {
        list = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id, room_id }, '-created_date', 5);
        if (!list.length) list = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 5);
      } else {
        list = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 5);
      }
      // Pick the active one (not superseded/voided) — NEVER return voided agreements
      agreement = list.find(a => !['superseded', 'voided'].includes(a.status)) || null;
    }

    if (!agreement) return Response.json({ agreement: null });

    // Access check — also check profile IDs (not just user IDs, since agent_only agreements
    // may have investor_user_id set to investor, not the agent who is viewing)
    let hasAccess = agreement.investor_user_id === user.id || agreement.agent_user_id === user.id;
    if (!hasAccess) {
      const p = callerProfile;
      if (p) {
        // Check profile ID matches
        if (agreement.investor_profile_id === p.id || agreement.agent_profile_id === p.id) hasAccess = true;
        // Check deal participants
        if (!hasAccess) {
          const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
          if (deals?.[0]?.selected_agent_ids?.includes(p.id)) hasAccess = true;
          if (deals?.[0]?.investor_id === p.id) hasAccess = true;
        }
        if (!hasAccess && room_id) {
          const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
          if (rooms?.[0]?.agent_ids?.includes(p.id)) hasAccess = true;
          if (rooms?.[0]?.investorId === p.id) hasAccess = true;
        }
      }
    }
    // Admin users always have access
    if (!hasAccess && user.role === 'admin') hasAccess = true;
    if (!hasAccess) return Response.json({ error: 'Not authorized' }, { status: 403 });

    return Response.json({ agreement });
  } catch (error) {
    console.error('[getLegalAgreement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
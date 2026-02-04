import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GENERATE INVESTOR AGREEMENT
 * Generates the base agreement PDF for investor to sign
 * Called from MyAgreement page with draft_id
 * Returns agreement_id and signing_url
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];

    const body = await req.json();
    const { draft_id } = body;

    if (!draft_id) {
      return Response.json({ error: 'Missing draft_id' }, { status: 400 });
    }

    // Get draft
    const drafts = await base44.asServiceRole.entities.DealDraft.filter({ id: draft_id });
    const draft = drafts[0];
    if (!draft) {
      return Response.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.investor_profile_id !== profile.id) {
      return Response.json({ error: 'Not authorized for this draft' }, { status: 403 });
    }

    // Check if agreement already exists for this draft
    const existingAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
      deal_id: draft_id 
    });
    if (existingAgreements.length > 0 && existingAgreements[0].investor_signed_at) {
      return Response.json({ 
        error: 'Agreement already signed',
        agreement_id: existingAgreements[0].id
      }, { status: 400 });
    }

    // Call generateLegalAgreement to create the PDF
    const exhibit_a = {
      buyer_commission_type: draft.buyer_commission_type,
      buyer_commission_percentage: draft.buyer_commission_percentage,
      buyer_flat_fee: draft.buyer_flat_fee,
      agreement_length_days: draft.agreement_length || 180,
      transaction_type: 'ASSIGNMENT'
    };

    const generateRes = await base44.asServiceRole.functions.invoke('generateLegalAgreement', {
      deal_id: draft_id,
      investor_profile_id: profile.id,
      exhibit_a,
      signer_mode: 'investor_only'
    });

    if (generateRes.data?.error) {
      return Response.json({ error: generateRes.data.error }, { status: 500 });
    }

    const agreement = generateRes.data?.agreement;
    if (!agreement?.id) {
      return Response.json({ error: 'Failed to generate agreement' }, { status: 500 });
    }

    // Create signing session
    const signRes = await base44.asServiceRole.functions.invoke('docusignCreateSigningSession', {
      agreement_id: agreement.id,
      role: 'investor',
      redirect_url: `${Deno.env.get('PUBLIC_APP_URL')}/DocuSignReturn?draft_id=${draft_id}&role=investor`
    });

    if (signRes.data?.error) {
      return Response.json({ error: signRes.data.error }, { status: 500 });
    }

    return Response.json({
      success: true,
      agreement_id: agreement.id,
      signing_url: signRes.data.signing_url
    });
  } catch (error) {
    console.error('[generateInvestorAgreement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
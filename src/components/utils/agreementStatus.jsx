// Centralized Agreement Status Label Helper (UI-only)
// Determines short, role-specific labels based on available room/agreement/negotiation fields

function pickBadgeClasses(tone) {
  // Use existing app palette
  switch (tone) {
    case 'green':
      return 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30';
    case 'blue':
      return 'bg-[#60A5FA]/20 text-[#60A5FA] border-[#60A5FA]/30';
    case 'amber':
      return 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30';
    default:
      return 'bg-[#1F1F1F] text-[#808080] border-[#333]';
  }
}

// Safe getter for negotiation status from various shapes
function getNegotiationStatus(input) {
  if (!input) return null;
  return (
    input?.negotiation?.status ||
    input?.deal_negotiation_status ||
    input?.negotiation_status ||
    input?.last_proposed_terms?.status ||
    null
  );
}

// Detect if a regeneration of documents is required based on various flags/shapes
function needsRegeneration(input) {
  if (!input) return false;
  const i = input;
  const fromBooleans = Boolean(
    i?.regen_required ||
    i?.requires_regen ||
    i?.needs_regeneration ||
    i?.regeneration_required ||
    i?.agreement_needs_regeneration ||
    i?.terms_changed_pending ||
    i?.pending_regeneration ||
    i?.last_proposed_terms?.requires_regen ||
    i?.last_proposed_terms?.needs_regeneration ||
    i?.last_proposed_terms?.regeneration_required
  );
  const fromStrings = (() => {
    const s = String(
      i?.status ||
      i?.negotiation?.status ||
      i?.deal_negotiation_status ||
      i?.negotiation_status ||
      i?.last_proposed_terms?.status ||
      ''
    ).toUpperCase();
    return s.includes('REGEN');
  })();
  return fromBooleans || fromStrings;
}

export function getAgreementStatusLabel({ room, agreement, negotiation, role }) {
  const userRole = role === 'agent' ? 'agent' : role === 'investor' ? 'investor' : 'member';

  // Pull basic status flags - prioritize agreement entity over room field
  const agreementStatus = (agreement?.status || room?.agreement_status || '').toLowerCase();
  const isFullySigned = !!(room?.is_fully_signed || agreementStatus === 'fully_signed');
  
  // Check if investor has signed (from agreement or room data)
  const investorHasSigned = !!(
    agreement?.investor_signed_at || 
    room?.agreement?.investor_signed_at ||
    room?.investor_signed_at || 
    agreementStatus === 'investor_signed'
  );

  // Optional negotiation/counter info (if present in provided objects)
  const negStatus = (
          (negotiation && negotiation.status) ||
          getNegotiationStatus(room) ||
          getNegotiationStatus(agreement) ||
          null
        );
  const negUpper = String(negStatus || '').toUpperCase();
  const lastActor = String(
    negotiation?.last_actor || negotiation?.lastActor || negotiation?.last_proposed_by || negotiation?.lastProposedBy || negotiation?.last_offer_by || negotiation?.lastOfferedBy || negotiation?.from_role || ''
  ).toUpperCase();

  const regenRequired = needsRegeneration(negotiation) || needsRegeneration(room) || needsRegeneration(agreement) || negUpper.includes('REGEN');

  // Show status to agent whenever there is an agreement in progress
  const hasAgreement = Boolean(agreementStatus && agreementStatus !== '' && agreementStatus !== 'none');
  const hasNegotiationSignal = Boolean(negotiation && negotiation.status) || Boolean(getNegotiationStatus(room)) || regenRequired;
  if (userRole === 'agent' && !(isFullySigned || investorHasSigned || hasAgreement || hasNegotiationSignal)) {
    return null;
  }

  // S5 — FULLY_SIGNED_LOCKED_IN
  if (isFullySigned) {
    return { state: 'S5', label: 'Signed', className: pickBadgeClasses('green') };
  }

  // S4 — TERMS_ACCEPTED_NEEDS_INVESTOR_REGEN_AND_SIGN (robust detection)
  if (regenRequired) {
    return {
      state: 'S4',
      label: userRole === 'investor' ? 'Regenerate contract' : 'Waiting for investor',
      className: pickBadgeClasses(userRole === 'investor' ? 'blue' : 'amber')
    };
  }

  // S4 — TERMS_ACCEPTED_NEEDS_INVESTOR_REGEN_AND_SIGN
  if (negStatus === 'ACCEPTED_REQUIRES_REGEN') {
    return {
      state: 'S4',
      label: userRole === 'investor' ? 'Regenerate contract' : 'Waiting for investor',
      className: pickBadgeClasses('amber')
    };
  }

  // S2 — AGENT_COUNTERED_WAITING_FOR_INVESTOR
  if (negUpper === 'COUNTERED_BY_AGENT' || (negUpper.includes('COUNTER') && lastActor === 'AGENT') || (negUpper.includes('PENDING') && lastActor === 'AGENT')) {
    return {
      state: 'S2',
      label: userRole === 'investor' ? 'Review and confirm new offer' : 'Waiting for investor',
      className: pickBadgeClasses(userRole === 'investor' ? 'blue' : 'amber')
    };
  }

  // S3 — INVESTOR_COUNTERED_WAITING_FOR_AGENT
  if (negUpper === 'COUNTERED_BY_INVESTOR' || (negUpper.includes('COUNTER') && lastActor === 'INVESTOR') || (negUpper.includes('PENDING') && lastActor === 'INVESTOR')) {
    return {
      state: 'S3',
      label: userRole === 'investor' ? 'Waiting for agent' : 'Review and confirm offer',
      className: pickBadgeClasses(userRole === 'investor' ? 'amber' : 'blue')
    };
  }

  // Generic counter fallback
  if (negUpper.includes('COUNTER')) {
    return { state: 'Sx', label: userRole === 'investor' ? 'Review and confirm new offer' : 'Waiting for investor', className: pickBadgeClasses(userRole === 'investor' ? 'blue' : 'amber') };
  }

  // Investor who hasn't signed current agreement should see "Sign contract"
  if (userRole === 'investor' && !agreement?.investor_signed_at && !room?.investor_signed_at && agreement && (agreementStatus === 'draft' || agreementStatus === 'sent')) {
    return { state: 'S0', label: 'Sign contract', className: pickBadgeClasses('blue') };
  }

  // If investor has signed, they wait for agent
  if (userRole === 'investor' && (agreement?.investor_signed_at || room?.investor_signed_at || (room?.agreement_status || '').toLowerCase() === 'investor_signed') && !isFullySigned) {
    return { state: 'S1', label: 'Waiting for agent', className: pickBadgeClasses('amber') };
  }

  // S1 — WAITING_FOR_AGENT_SIGNATURE (investor signed current version)
  if (investorHasSigned && !isFullySigned) {
    return {
      state: 'S1',
      label: userRole === 'investor' ? 'Waiting for agent' : 'Review & sign',
      className: pickBadgeClasses(userRole === 'investor' ? 'amber' : 'blue')
    };
  }

  // Initial states (sent/draft) - but check for signatures first
  if (agreementStatus === 'sent' || agreementStatus === 'draft') {
    if (userRole === 'investor') {
      return { state: investorHasSigned ? 'S1' : 'S0', label: investorHasSigned ? 'Waiting for agent' : 'Sign contract', className: pickBadgeClasses(investorHasSigned ? 'amber' : 'blue') };
    }

    // Agent view
    return { state: 'S0', label: investorHasSigned ? 'Review & sign' : 'Waiting for investor', className: pickBadgeClasses(investorHasSigned ? 'blue' : undefined) };
  }

  // Default: no badge
  return null;
}

export default { getAgreementStatusLabel };
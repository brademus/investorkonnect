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

export function getAgreementStatusLabel({ room, agreement, negotiation, role }) {
  const userRole = role === 'agent' ? 'agent' : role === 'investor' ? 'investor' : 'member';

  // Pull basic status flags
  const agreementStatus = (room?.agreement_status || agreement?.status || '').toLowerCase();
  const isFullySigned = !!(room?.is_fully_signed || agreementStatus === 'fully_signed');

  // Optional negotiation/counter info (if present in provided objects)
  const negStatus = (
    (negotiation && negotiation.status) ||
    getNegotiationStatus(room) ||
    getNegotiationStatus(agreement) ||
    null
  );

  // Hard rule: no labels for agents before investor has signed (pre-sign states)
  if (userRole === 'agent' && !(isFullySigned || agreementStatus === 'investor_signed')) {
    return null;
  }

  // S5 — FULLY_SIGNED_LOCKED_IN
  if (isFullySigned) {
    return { state: 'S5', label: 'Signed', className: pickBadgeClasses('green') };
  }

  // S4 — TERMS_ACCEPTED_NEEDS_INVESTOR_REGEN_AND_SIGN
  if (negStatus === 'ACCEPTED_REQUIRES_REGEN') {
    return {
      state: 'S4',
      label: userRole === 'investor' ? 'Regenerate & sign' : 'Waiting on investor',
      className: pickBadgeClasses('amber')
    };
  }

  // S2 — AGENT_COUNTERED_WAITING_FOR_INVESTOR
  if (negStatus === 'COUNTERED_BY_AGENT') {
    return {
      state: 'S2',
      label: userRole === 'investor' ? 'Review counter' : 'Waiting on investor',
      className: pickBadgeClasses('blue')
    };
  }

  // S3 — INVESTOR_COUNTERED_WAITING_FOR_AGENT
  if (negStatus === 'COUNTERED_BY_INVESTOR') {
    return {
      state: 'S3',
      label: userRole === 'investor' ? 'Waiting on agent' : 'Review counter',
      className: pickBadgeClasses('blue')
    };
  }

  // S1 — WAITING_FOR_AGENT_SIGNATURE (investor signed current version)
  if (agreementStatus === 'investor_signed') {
    return {
      state: 'S1',
      label: userRole === 'investor' ? 'Waiting on agent' : 'Review & sign',
      className: pickBadgeClasses(userRole === 'investor' ? 'amber' : 'blue')
    };
  }

  // Default: no badge
  return null;
}

export default { getAgreementStatusLabel };
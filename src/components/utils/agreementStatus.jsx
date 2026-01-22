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
  const negUpper = String(negStatus || '').toUpperCase();
  const lastActor = String(
    negotiation?.last_actor || negotiation?.lastActor || negotiation?.last_proposed_by || negotiation?.lastProposedBy || negotiation?.last_offer_by || negotiation?.lastOfferedBy || negotiation?.from_role || ''
  ).toUpperCase();

  const regenRequired = needsRegeneration(negotiation) || needsRegeneration(room) || needsRegeneration(agreement) || negUpper.includes('REGEN');

  // Show nothing to agent only when there is truly no actionable state yet
  const hasNegotiationSignal = Boolean(negotiation && negotiation.status) || Boolean(getNegotiationStatus(room)) || regenRequired;
  if (userRole === 'agent' && !(isFullySigned || agreementStatus === 'investor_signed' || hasNegotiationSignal)) {
    return null;
  }

  // S5 — FULLY_SIGNED_LOCKED_IN
  if (isFullySigned) {
    return { state: 'S5', label: 'Signed', className: pickBadgeClasses('green') };
  }

  // S4 — TERMS_ACCEPTED_NEEDS_INVESTOR_REGEN_AND_SIGN (robust detection)
  if (regenRequired) {
    // HARD GUARD: agent must never see "Review & sign" when regeneration is required
    return {
      state: 'S4',
      label: userRole === 'investor' ? 'Regenerate contract' : 'Waiting for investor',
      className: pickBadgeClasses('amber')
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

  // S1 — WAITING_FOR_AGENT_SIGNATURE (investor signed current version)
  if (agreementStatus === 'investor_signed') {
    return {
      state: 'S1',
      label: userRole === 'investor' ? 'Waiting for agent' : 'Review & sign',
      className: pickBadgeClasses(userRole === 'investor' ? 'amber' : 'blue')
    };
  }

  // Initial states (sent/draft): investor usually signs immediately.
  if (agreementStatus === 'sent' || agreementStatus === 'draft') {
    const req = (room?.request_status || '').toLowerCase();
    const roomStatus = (room?.agreement_status || '').toLowerCase();
    const investorHasSigned = roomStatus === 'investor_signed' || !!agreement?.investor_signed_at;

    if (userRole === 'investor') {
      // If request accepted or we've already signed, show waiting for agent
      if (req === 'accepted' || investorHasSigned) {
        return { state: 'S1', label: 'Waiting for agent', className: pickBadgeClasses('amber') };
      }
      return { state: 'S0', label: 'Sign contract', className: pickBadgeClasses('blue') };
    }

    // Agent view
    return { state: 'S0', label: investorHasSigned ? 'Review & sign' : 'Waiting for investor', className: pickBadgeClasses(investorHasSigned ? 'blue' : undefined) };
  }

  // Default: no badge
  return null;
}

export default { getAgreementStatusLabel };
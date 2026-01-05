/**
 * Deal Redaction Utilities
 * Determines what information should be visible based on IOA signature status
 */

/**
 * Check if sensitive deal info is unlocked for a specific user
 * @param {Object} deal - Deal object
 * @param {Object} agreement - LegalAgreement object (optional)
 * @param {string} userRole - Current user's role ('investor' | 'agent')
 * @returns {boolean} - True if user can see full address
 */
export function isDealInfoUnlocked(deal, agreement = null, userRole = null) {
  if (!deal) return false;
  
  // Investors always see full address (they own the deal)
  if (userRole === 'investor') return true;
  
  // For agents: check if internal agreement is fully signed
  if (userRole === 'agent') {
    // Check agreement signature status
    if (agreement?.status === 'fully_signed') return true;
    if (agreement?.investor_signed_at && agreement?.agent_signed_at) return true;
    
    // Legacy: check deal-level IOA status
    if (deal.ioa_investor_signed_at && deal.ioa_agent_signed_at) return true;
    if (deal.ioa_status === 'fully_signed') return true;
    
    // Not unlocked for agent
    return false;
  }
  
  // Default: locked
  return false;
}

/**
 * Get redacted version of deal data
 * @param {Object} deal - Original deal object
 * @param {Object} agreement - LegalAgreement object (optional)
 * @param {string} userRole - Current user's role ('investor' | 'agent')
 * @returns {Object} - Deal with sensitive fields redacted if not unlocked
 */
export function getRedactedDeal(deal, agreement = null, userRole = null) {
  if (!deal) return null;
  
  const isUnlocked = isDealInfoUnlocked(deal, agreement, userRole);
  
  if (isUnlocked) {
    return deal; // Return full data if unlocked
  }
  
  // Return redacted version for agents
  return {
    ...deal,
    // REDACTED: Full address replaced with city/state only
    property_address: `${deal.city || 'City'}, ${deal.state || 'State'}`,
    
    // REDACTED: Seller info hidden
    seller_info: deal.seller_info ? {
      ...deal.seller_info,
      seller_name: '[Hidden Until Agreement Signed]',
      second_signer_name: deal.seller_info.second_signer_name ? '[Hidden]' : undefined
    } : undefined,
    
    // Mark as redacted
    _is_redacted: true,
    _unlock_status: 'redacted'
  };
}

/**
 * Get user-friendly agreement status message
 * @param {Object} agreement - LegalAgreement object
 * @param {Object} deal - Deal object (fallback)
 * @param {string} userRole - Current user's role
 * @returns {string} - Status message
 */
export function getIOAStatusMessage(agreement, deal, userRole) {
  // Check agreement status first
  if (agreement) {
    const status = agreement.status;
    
    switch (status) {
      case 'draft':
        return 'Agreement not sent - full address hidden from agent';
      case 'sent':
        return userRole === 'agent'
          ? 'Sign the agreement to unlock full property address'
          : 'Waiting for both parties to sign';
      case 'investor_signed':
        return userRole === 'agent'
          ? 'Sign the agreement to unlock full property address'
          : 'Waiting for agent to sign';
      case 'agent_signed':
        return userRole === 'investor'
          ? 'Sign the agreement to finalize'
          : 'Waiting for investor to sign';
      case 'fully_signed':
        return 'Agreement fully signed - all details unlocked';
      default:
        return '';
    }
  }
  
  // Fallback to legacy IOA status
  if (!deal) return '';
  const status = deal.ioa_status || 'not_started';
  
  switch (status) {
    case 'not_started':
      return 'Agreement not started - full address hidden from agent';
    case 'awaiting_investor':
      return userRole === 'investor' 
        ? 'Sign to unlock full deal details'
        : 'Waiting for investor to sign';
    case 'awaiting_agent':
      return userRole === 'agent'
        ? 'Sign to unlock full property address'
        : 'Waiting for agent to sign';
    case 'fully_signed':
      return 'Agreement fully signed - all details unlocked';
    default:
      return '';
  }
}

/**
 * Check if current user can sign IOA for this deal
 * @param {Object} deal - Deal object
 * @param {Object} profile - Current user profile
 * @returns {Object} - { canSign: boolean, reason: string }
 */
export function canUserSignIOA(deal, profile) {
  if (!deal || !profile) {
    return { canSign: false, reason: 'Missing deal or profile' };
  }
  
  const userRole = profile.user_role;
  
  if (userRole === 'investor') {
    if (deal.investor_id !== profile.id) {
      return { canSign: false, reason: 'Not the investor on this deal' };
    }
    if (deal.ioa_investor_signed_at) {
      return { canSign: false, reason: 'Already signed' };
    }
    return { canSign: true, reason: 'Ready to sign' };
  }
  
  if (userRole === 'agent') {
    if (deal.agent_id !== profile.id) {
      return { canSign: false, reason: 'Not the agent on this deal' };
    }
    if (deal.ioa_agent_signed_at) {
      return { canSign: false, reason: 'Already signed' };
    }
    return { canSign: true, reason: 'Ready to sign' };
  }
  
  return { canSign: false, reason: 'Invalid role' };
}

export default {
  isDealInfoUnlocked,
  getRedactedDeal,
  getIOAStatusMessage,
  canUserSignIOA
};
/**
 * Deal Redaction Utilities
 * Determines what information should be visible based on IOA signature status
 */

/**
 * Check if sensitive deal info is unlocked
 * @param {Object} deal - Deal object
 * @returns {boolean} - True if both parties signed IOA
 */
export function isDealInfoUnlocked(deal) {
  if (!deal) return false;
  
  // If IOA not required, info is unlocked
  if (deal.ioa_required === false) return true;
  
  // Check if both signatures are present
  return !!(deal.ioa_investor_signed_at && deal.ioa_agent_signed_at);
}

/**
 * Get redacted version of deal data
 * @param {Object} deal - Original deal object
 * @param {string} userRole - Current user's role ('investor' | 'agent')
 * @returns {Object} - Deal with sensitive fields redacted if not unlocked
 */
export function getRedactedDeal(deal, userRole) {
  if (!deal) return null;
  
  const isUnlocked = isDealInfoUnlocked(deal);
  
  if (isUnlocked) {
    return deal; // Return full data if unlocked
  }
  
  // Return redacted version
  return {
    ...deal,
    // REDACTED: Full address replaced with city/state only
    property_address: `[Address Hidden - ${deal.city || 'City'}, ${deal.state || 'State'}]`,
    
    // REDACTED: Seller info hidden
    seller_info: deal.seller_info ? {
      ...deal.seller_info,
      seller_name: '[Seller Name Hidden Until IOA Signed]',
      second_signer_name: deal.seller_info.second_signer_name ? '[Hidden]' : undefined
    } : undefined,
    
    // Mark as redacted
    _is_redacted: true,
    _unlock_status: 'redacted'
  };
}

/**
 * Get user-friendly IOA status message
 * @param {Object} deal - Deal object
 * @param {string} userRole - Current user's role
 * @returns {string} - Status message
 */
export function getIOAStatusMessage(deal, userRole) {
  if (!deal) return '';
  
  const status = deal.ioa_status || 'not_started';
  
  switch (status) {
    case 'not_started':
      return 'IOA not started - sensitive details hidden';
    case 'awaiting_investor':
      return userRole === 'investor' 
        ? 'Sign the IOA to unlock full deal details'
        : 'Waiting for investor to sign IOA';
    case 'awaiting_agent':
      return userRole === 'agent'
        ? 'Sign the IOA to unlock full deal details'
        : 'Waiting for agent to sign IOA';
    case 'fully_signed':
      return 'IOA fully signed - all details unlocked';
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
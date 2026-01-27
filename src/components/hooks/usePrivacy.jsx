import { useMemo } from 'react';

/**
 * Privacy middleware - centralized address masking logic
 * Single source of truth for what data is visible based on role and agreement status
 */
export function usePrivacy(userRole) {
  const getVisibleAddress = (deal, isFullySigned) => {
    // Agents only see city/state until fully signed
    if (userRole === 'agent' && !isFullySigned) {
      return `${deal.city || 'City'}, ${deal.state || 'State'}`;
    }
    // Investors always see full address
    return deal.property_address || deal.title || 'Address Pending';
  };

  const getVisibleCounterpartyName = (deal, hasAgentAccepted, isFullySigned, isAgent) => {
    if (isAgent) {
      // Agents see investor name only if fully signed
      return isFullySigned ? (deal.counterparty_name || 'Investor') : 'Pending Agreement Signatures';
    }
    // Investors see agent status/name based on acceptance
    if (hasAgentAccepted) {
      return isFullySigned ? (deal.agent_name || 'Agent Connected') : 
             (isAgent ? 'Pending Investor Signature' : 'Pending Agent Signature');
    }
    return 'No Agent Selected';
  };

  const getVisibleSellerName = (sellerName, isFullySigned, isInvestor) => {
    // Only show seller name if investor OR fully signed
    return (isInvestor || isFullySigned) ? sellerName : null;
  };

  return useMemo(() => ({
    getVisibleAddress,
    getVisibleCounterpartyName,
    getVisibleSellerName
  }), [userRole]);
}
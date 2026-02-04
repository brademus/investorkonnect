import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

/**
 * KEY TERMS PANEL for Room Page
 * Shows buyer agent commission terms and updates when counters are accepted
 */
export default function KeyTermsPanel({ deal, room, profile, onTermsChange }) {
  const [displayTerms, setDisplayTerms] = useState(null);

  // Extract current buyer commission terms
  useEffect(() => {
    if (!deal && !room) {
      setDisplayTerms(null);
      return;
    }

    // Priority: Deal proposed_terms > Room agent_terms > Room budget fallback
    let terms = null;

    // Check deal.proposed_terms first
    if (deal?.proposed_terms) {
      terms = deal.proposed_terms;
    }
    // Fallback to room agent_terms
    else if (room?.agent_terms && typeof room.agent_terms === 'object') {
      // agent_terms is { agentId: { terms object } }, flatten to first agent
      const agentIds = Object.keys(room.agent_terms);
      if (agentIds.length > 0) {
        terms = room.agent_terms[agentIds[0]];
      }
    }

    setDisplayTerms(terms);
    if (onTermsChange) {
      onTermsChange(terms);
    }
  }, [deal?.proposed_terms, room?.agent_terms, deal?.id, room?.id]);

  const formatComm = (type, percentage, flatFee) => {
    if (type === 'percentage' && percentage !== undefined) {
      return `${percentage}%`;
    } else if (type === 'flat_fee' && flatFee !== undefined) {
      return `$${flatFee.toLocaleString()}`;
    }
    return 'Not set';
  };

  const buyerComm = displayTerms?.buyer_commission_type
    ? formatComm(
        displayTerms.buyer_commission_type,
        displayTerms.buyer_commission_percentage,
        displayTerms.buyer_flat_fee
      )
    : 'Not set';

  const sellerComm = displayTerms?.seller_commission_type
    ? formatComm(
        displayTerms.seller_commission_type,
        displayTerms.seller_commission_percentage,
        displayTerms.seller_flat_fee
      )
    : 'Not set';

  const agreementLength = displayTerms?.agreement_length
    ? `${displayTerms.agreement_length} days`
    : 'Not set';

  return (
    <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
      <CardHeader className="border-b border-[#1F1F1F]">
        <CardTitle className="text-lg text-[#FAFAFA]">Key Terms</CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {!displayTerms ? (
          <div className="text-center py-6">
            <AlertCircle className="w-10 h-10 text-[#808080] mx-auto mb-2 opacity-50" />
            <p className="text-[#808080] text-sm">No terms set yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Buyer Commission */}
            <div className="bg-[#141414] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#808080] mb-1">Buyer Commission</p>
                <p className="text-sm font-semibold text-[#FAFAFA]">{buyerComm}</p>
              </div>
              <Badge className="bg-[#E3C567]/20 text-[#E3C567] border-[#E3C567]/30">
                {displayTerms.buyer_commission_type === 'percentage' ? 'Percentage' : 'Flat Fee'}
              </Badge>
            </div>

            {/* Seller Commission */}
            <div className="bg-[#141414] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#808080] mb-1">Seller Commission</p>
                <p className="text-sm font-semibold text-[#FAFAFA]">{sellerComm}</p>
              </div>
              <Badge className="bg-[#E3C567]/20 text-[#E3C567] border-[#E3C567]/30">
                {displayTerms.seller_commission_type === 'percentage' ? 'Percentage' : 'Flat Fee'}
              </Badge>
            </div>

            {/* Agreement Length */}
            <div className="bg-[#141414] rounded-xl p-4">
              <p className="text-xs text-[#808080] mb-1">Agreement Length</p>
              <p className="text-sm font-semibold text-[#FAFAFA]">{agreementLength}</p>
            </div>

            {/* Last Updated */}
            {displayTerms && (
              <p className="text-xs text-[#808080] text-right pt-2">
                Updated {new Date(displayTerms.updated_at || deal?.updated_date || room?.requested_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
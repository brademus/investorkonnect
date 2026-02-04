import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * KEY TERMS PANEL for Room Page
 * Shows purchase price, buyer agent commission, and agreement length - updates when counters are accepted
 * ALWAYS fetches latest non-voided agreement for this specific room to get the most current terms
 */
export default function KeyTermsPanel({ deal, room, profile, onTermsChange, agreement }) {
  const currentRoom = room;
  const [displayTerms, setDisplayTerms] = useState(null);
  const [loading, setLoading] = useState(true);

  // Extract current buyer commission terms - ALWAYS fetch fresh from agreement
  useEffect(() => {
    if (!room?.id) {
      setDisplayTerms(null);
      setLoading(false);
      return;
    }

    const loadTerms = async () => {
      setLoading(true);
      let terms = null;

      try {
        // ALWAYS fetch the latest non-voided agreement for this room
        // This ensures we get the updated terms after counter acceptance
        const dealId = deal?.id || room?.deal_id;
        
        if (dealId && room?.id) {
          console.log('[KeyTermsPanel] Fetching agreements for deal:', dealId, 'room:', room.id);
          
          const agreements = await base44.entities.LegalAgreement.filter({ 
            deal_id: dealId,
            room_id: room.id 
          });
          
          console.log('[KeyTermsPanel] Found agreements:', agreements.length, agreements.map(a => ({ id: a.id, status: a.status })));
          
          // Find the latest non-voided agreement (prefer draft for newly generated)
          const draftAgreement = agreements.find(a => a.status === 'draft');
          const nonVoidedAgreement = agreements.find(a => a.status !== 'voided');
          const latestAgreement = draftAgreement || nonVoidedAgreement || agreements[0];
          
          if (latestAgreement?.exhibit_a_terms) {
            terms = latestAgreement.exhibit_a_terms;
            console.log('[KeyTermsPanel] Using agreement exhibit_a_terms:', latestAgreement.id, terms);
          }
        }
        
        // Fallback: use passed agreement prop
        if (!terms && agreement?.exhibit_a_terms) {
          terms = agreement.exhibit_a_terms;
          console.log('[KeyTermsPanel] Fallback to agreement prop:', terms);
        }
        
        // Fallback: use deal.proposed_terms
        if (!terms && deal?.proposed_terms) {
          terms = deal.proposed_terms;
          console.log('[KeyTermsPanel] Fallback to deal.proposed_terms:', terms);
        }
        
        // Fallback: room agent_terms
        if (!terms && room?.agent_terms && typeof room.agent_terms === 'object') {
          const agentIds = Object.keys(room.agent_terms);
          if (agentIds.length > 0) {
            terms = room.agent_terms[agentIds[0]];
            console.log('[KeyTermsPanel] Fallback to room.agent_terms:', terms);
          }
        }
      } catch (e) {
        console.error('[KeyTermsPanel] Error fetching terms:', e);
      }

      setDisplayTerms(terms);
      setLoading(false);
      
      if (onTermsChange) {
        onTermsChange(terms);
      }
    };

    loadTerms();
  }, [deal?.id, room?.id, room?.deal_id, room?.current_legal_agreement_id, agreement?.id]);

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

  const purchasePrice = (deal?.purchase_price || currentRoom?.budget || 0).toLocaleString();

  const agreementLength = (displayTerms?.agreement_length || deal?.agreement_length)
    ? `${displayTerms?.agreement_length || deal?.agreement_length} days`
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
            {/* Purchase Price */}
            <div className="bg-[#141414] rounded-xl p-4">
              <p className="text-xs text-[#808080] mb-1">Purchase Price</p>
              <p className="text-sm font-semibold text-[#34D399]">${purchasePrice}</p>
            </div>

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
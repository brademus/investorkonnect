import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

/**
 * KEY TERMS PANEL for Room Page
 * Shows purchase price, buyer agent commission, and agreement length - updates when counters are accepted
 * Fetches latest terms from the room's current legal agreement
 */
export default function KeyTermsPanel({ deal, room, profile, onTermsChange, agreement }) {
  const currentRoom = room;
  const [displayTerms, setDisplayTerms] = useState(null);
  const [loading, setLoading] = useState(false);

  // Extract current buyer commission terms - prioritize agreement exhibit_a_terms
  useEffect(() => {
    if (!deal && !room) {
      setDisplayTerms(null);
      return;
    }

    const loadTerms = async () => {
      let terms = null;

      // Priority 1: If agreement passed in, use its exhibit_a_terms
      if (agreement?.exhibit_a_terms) {
        terms = agreement.exhibit_a_terms;
        console.log('[KeyTermsPanel] Using agreement exhibit_a_terms:', terms);
      }
      // Priority 2: Fetch from room's current_legal_agreement_id
      else if (room?.current_legal_agreement_id) {
        try {
          setLoading(true);
          const agreements = await base44.entities.LegalAgreement.filter({ 
            id: room.current_legal_agreement_id 
          });
          if (agreements[0]?.exhibit_a_terms) {
            terms = agreements[0].exhibit_a_terms;
            console.log('[KeyTermsPanel] Fetched from current_legal_agreement_id:', terms);
          }
        } catch (e) {
          console.warn('[KeyTermsPanel] Failed to fetch agreement:', e);
        } finally {
          setLoading(false);
        }
      }
      // Priority 3: Fetch latest non-voided agreement for this room
      else if (room?.id && deal?.id) {
        try {
          setLoading(true);
          const agreements = await base44.entities.LegalAgreement.filter({ 
            deal_id: deal.id,
            room_id: room.id 
          });
          // Find the latest non-voided agreement
          const validAgreement = agreements.find(a => a.status !== 'voided') || agreements[0];
          if (validAgreement?.exhibit_a_terms) {
            terms = validAgreement.exhibit_a_terms;
            console.log('[KeyTermsPanel] Fetched from room+deal query:', terms);
          }
        } catch (e) {
          console.warn('[KeyTermsPanel] Failed to fetch room agreements:', e);
        } finally {
          setLoading(false);
        }
      }
      
      // Priority 4: Fall back to deal.proposed_terms
      if (!terms && deal?.proposed_terms) {
        terms = deal.proposed_terms;
        console.log('[KeyTermsPanel] Using deal.proposed_terms:', terms);
      }
      // Priority 5: Fallback to room agent_terms
      else if (!terms && room?.agent_terms && typeof room.agent_terms === 'object') {
        const agentIds = Object.keys(room.agent_terms);
        if (agentIds.length > 0) {
          terms = room.agent_terms[agentIds[0]];
          console.log('[KeyTermsPanel] Using room.agent_terms:', terms);
        }
      }

      setDisplayTerms(terms);
      if (onTermsChange) {
        onTermsChange(terms);
      }
    };

    loadTerms();
  }, [deal?.proposed_terms, room?.agent_terms, room?.current_legal_agreement_id, deal?.id, room?.id, agreement?.id, agreement?.exhibit_a_terms]);

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
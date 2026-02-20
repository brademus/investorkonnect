import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, CalendarCheck } from 'lucide-react';

/**
 * KEY TERMS PANEL for Room Page
 * Shows contract price, buyer agent commission, and agreement length - updates when counters are accepted
 * ALWAYS fetches latest non-voided agreement for this specific room to get the most current terms
 * 
 * CRITICAL: Each agent has THEIR OWN terms stored in room.agent_terms[agentId]
 * Counter offers and negotiations are agent-specific, not deal-wide
 */
export default function KeyTermsPanel({ deal, room, profile, onTermsChange, agreement, selectedAgentId, inline = false, isSigned: isSignedProp }) {
  const currentRoom = room;
  const [displayTerms, setDisplayTerms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apptConfirmed, setApptConfirmed] = useState(false);

  useEffect(() => {
    if (!deal?.id) return;
    if (deal.walkthrough_scheduled !== true || deal.walkthrough_confirmed === true) return;
    try {
      base44.entities.DealAppointments.filter({ dealId: deal.id }).then(rows => {
        const s = rows?.[0]?.walkthrough?.status;
        if (s === 'SCHEDULED' || s === 'COMPLETED') setApptConfirmed(true);
      }).catch(() => {});
    } catch (_) {}
  }, [deal?.id]);

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
        // CRITICAL: Determine which agent we're showing terms for
        const targetAgentId = selectedAgentId || room.agent_ids?.[0];
        
        // Helper: merge multiple term sources, preferring the first non-null value for each field
        const mergeTerms = (...sources) => {
          const fields = ['buyer_commission_type','buyer_commission_percentage','buyer_flat_fee',
                          'seller_commission_type','seller_commission_percentage','seller_flat_fee',
                          'agreement_length_days','agreement_length'];
          const merged = {};
          let hasAny = false;
          for (const f of fields) {
            for (const s of sources) {
              if (s && s[f] !== null && s[f] !== undefined && s[f] !== '') {
                merged[f] = s[f];
                hasAny = true;
                break;
              }
            }
            if (!merged[f]) merged[f] = null;
          }
          return hasAny ? merged : null;
        };

        // Fetch agreement terms — run both queries in parallel
        let agentAgreementTerms = null;
        const dealId = deal?.id || room?.deal_id;
        
        if (dealId) {
          const [inviteResults, roomAgreements] = await Promise.all([
            (targetAgentId ? base44.entities.DealInvite.filter({ deal_id: dealId, agent_profile_id: targetAgentId }).catch(() => []) : Promise.resolve([])),
            (room?.id ? base44.entities.LegalAgreement.filter({ deal_id: dealId, room_id: room.id }).catch(() => []) : Promise.resolve([]))
          ]);

          // Try agent-specific agreement from DealInvite first
          const invite = inviteResults?.[0];
          if (invite?.legal_agreement_id) {
            const match = roomAgreements.find(a => a.id === invite.legal_agreement_id && a.exhibit_a_terms && !['superseded', 'voided'].includes(a.status));
            if (match) {
              agentAgreementTerms = match.exhibit_a_terms;
            } else {
              // Agreement might not be in room-scoped results, fetch directly
              const agArr = await base44.entities.LegalAgreement.filter({ id: invite.legal_agreement_id }).catch(() => []);
              if (agArr?.[0]?.exhibit_a_terms && !['superseded', 'voided'].includes(agArr[0].status)) {
                agentAgreementTerms = agArr[0].exhibit_a_terms;
              }
            }
          }
          
          // Fallback to room-level agreements
          if (!agentAgreementTerms && roomAgreements.length > 0) {
            const filtered = roomAgreements.filter(a => !a.agent_profile_id || a.agent_profile_id === targetAgentId);
            const latest = filtered.find(a => a.status === 'sent') || filtered.find(a => !['superseded', 'voided'].includes(a.status));
            if (latest?.exhibit_a_terms) agentAgreementTerms = latest.exhibit_a_terms;
          }
        }

        // Collect all available term sources in priority order
        // After regeneration, the agreement exhibit_a_terms is the most authoritative source
        // because it contains the fully merged terms (base + counter offer changes)
        const agentSpecificTerms = (room?.agent_terms && targetAgentId) ? room.agent_terms[targetAgentId] : null;
        const roomTerms = room?.proposed_terms || null;
        const dealTerms = deal?.proposed_terms || null;
        const passedAgreementTerms = agreement?.exhibit_a_terms && (!agreement.agent_profile_id || agreement.agent_profile_id === targetAgentId)
          ? agreement.exhibit_a_terms : null;

        // If room.requires_regenerate is true, the agreement hasn't been regenerated yet,
        // so agent-specific counter terms are more current than the stale agreement exhibit_a_terms.
        const roomNeedsRegen = room?.requires_regenerate || currentRoom?.requires_regenerate;
        if (roomNeedsRegen) {
          // Agent counter terms > room terms > agreement (stale) > deal
          terms = mergeTerms(agentSpecificTerms, roomTerms, agentAgreementTerms, passedAgreementTerms, dealTerms);
        } else {
          // After regen, agreement is authoritative: agreement > agent terms > room > deal
          terms = mergeTerms(agentAgreementTerms, agentSpecificTerms, passedAgreementTerms, roomTerms, dealTerms);
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
  }, [deal?.id, room?.id, room?.deal_id, room?.current_legal_agreement_id, room?.proposed_terms, room?.agent_terms, agreement?.id, agreement?.exhibit_a_terms, selectedAgentId]);

  const formatComm = (type, percentage, flatFee) => {
    const normalizedType = type === 'flat' ? 'flat_fee' : type;
    if (normalizedType === 'percentage' && percentage !== undefined && percentage !== null) {
      return `${percentage}%`;
    } else if (normalizedType === 'flat_fee' && flatFee !== undefined && flatFee !== null) {
      return `$${Number(flatFee).toLocaleString()}`;
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

  const contractPrice = (deal?.purchase_price || currentRoom?.budget || 0).toLocaleString();

  const DEAL_TYPE_LABELS = {
    wholesale: "Wholesale",
    novation: "Novation",
    whole_tail: "Whole-tail",
    fix_and_flip: "Fix & Flip",
    buy_and_hold: "Buy & Hold",
    sub_2: "Sub-2",
  };
  const dealTypeLabel = deal?.deal_type ? (DEAL_TYPE_LABELS[deal.deal_type] || deal.deal_type) : null;

  const rawLength = displayTerms?.agreement_length_days || displayTerms?.agreement_length 
    || deal?.proposed_terms?.agreement_length_days || deal?.proposed_terms?.agreement_length 
    || deal?.agreement_length;
  const agreementLength = rawLength ? `${rawLength} days` : 'Not set';

  const termsContent = (
    <>
      {loading ? (
        <div className="text-center py-6">
          <Loader2 className="w-8 h-8 text-[#E3C567] mx-auto mb-2 animate-spin" />
          <p className="text-[#808080] text-sm">Loading terms...</p>
        </div>
      ) : !displayTerms ? (
        <div className="text-center py-6">
          <AlertCircle className="w-10 h-10 text-[#808080] mx-auto mb-2 opacity-50" />
          <p className="text-[#808080] text-sm">No terms set yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between py-1.5 border-b border-[#1F1F1F] last:border-0">
            <span className="text-sm text-[#808080]">Contract Price</span>
            <span className="text-sm font-medium text-[#34D399]">${contractPrice}</span>
          </div>
          {dealTypeLabel && (
            <div className="flex items-center justify-between py-1.5 border-b border-[#1F1F1F] last:border-0">
              <span className="text-sm text-[#808080]">Deal Type</span>
              <span className="text-sm font-medium text-[#E3C567]">{dealTypeLabel}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5 border-b border-[#1F1F1F] last:border-0">
            <span className="text-sm text-[#808080]">Seller's Agent Commission</span>
            <span className="text-sm font-medium text-[#FAFAFA]">{sellerComm}{displayTerms.seller_commission_type ? ` (${displayTerms.seller_commission_type === 'percentage' ? 'Percentage' : 'Flat Fee'})` : ''}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-[#1F1F1F] last:border-0">
            <span className="text-sm text-[#808080]">Agreement Length</span>
            <span className="text-sm font-medium text-[#FAFAFA]">{agreementLength}</span>
          </div>
        </div>
      )}
      {deal?.walkthrough_scheduled === true && (() => {
        const fullySigned = isSignedProp || room?.is_fully_signed || room?.agreement_status === 'fully_signed' || room?.request_status === 'locked' || deal?.is_fully_signed;
        const wtSlots = deal.walkthrough_slots?.filter(s => s.date && s.date.length >= 8) || [];
        const wtDate = deal.walkthrough_date && String(deal.walkthrough_date).length >= 8 ? deal.walkthrough_date : null;
        const wtTime = deal.walkthrough_time && String(deal.walkthrough_time).length >= 3 ? deal.walkthrough_time : null;
        const allSlots = wtSlots.length > 0 ? wtSlots : (wtDate ? [{ date: wtDate, timeStart: wtTime, timeEnd: null }] : []);

        if (deal.walkthrough_confirmed === true || apptConfirmed) {
          return (
            <div className="flex items-center justify-between py-1.5 border-b border-[#1F1F1F] last:border-0 mt-4">
              <span className="text-sm text-[#808080]">Walk-through</span>
              <span className="text-sm font-medium text-[#34D399]">
                {(deal.walkthrough_confirmed_date || deal.walkthrough_date)
                  ? `${deal.walkthrough_confirmed_date || deal.walkthrough_date}${(deal.walkthrough_confirmed_time || deal.walkthrough_time) ? ` at ${deal.walkthrough_confirmed_time || deal.walkthrough_time}` : ''}`
                  : 'Confirmed'}
              </span>
            </div>
          );
        }

        if (fullySigned) {
          return (
            <div className="flex items-center justify-between py-1.5 border-b border-[#1F1F1F] last:border-0 mt-4">
              <span className="text-sm text-[#808080]">Walk-through</span>
              <span className="text-sm italic text-[#F59E0B]">To Be Determined</span>
            </div>
          );
        }

        // Before signing — show available times
        if (allSlots.length > 0) {
          return (
            <div className="py-1.5 border-b border-[#1F1F1F] last:border-0 mt-4 space-y-2">
              <span className="text-sm text-[#808080]">Walk-through — Available times:</span>
              {allSlots.map((slot, idx) => {
                const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ') || null;
                return (
                  <div key={idx} className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                    <span className="font-medium">{allSlots.length > 1 ? `Option ${idx + 1}: ` : ''}{slot.date}</span>
                    {timeLabel && <span className="text-[#808080]">{timeLabel}</span>}
                  </div>
                );
              })}
            </div>
          );
        }

        return null;
      })()}
    </>
  );

  if (inline) {
    return (
      <div className="border-t border-[#1F1F1F] pt-5">
        <h4 className="text-base font-semibold text-[#FAFAFA] mb-3">Deal Details</h4>
        {termsContent}
      </div>
    );
  }

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="font-semibold text-[#FAFAFA] text-lg mb-4">Deal Details</h4>
      {termsContent}
    </div>
  );
}
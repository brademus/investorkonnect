import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
import { useQueryClient } from '@tanstack/react-query';
import LoadingAnimation from '@/components/LoadingAnimation';
import SimpleAgreementPanel from '@/components/SimpleAgreementPanel';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MyAgreement() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const dealId = params.get('dealId');
  const { profile, loading: loadingProfile } = useCurrentProfile();
  const queryClient = useQueryClient();

  const [deal, setDeal] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [agentProfiles, setAgentProfiles] = useState([]);
  const [pendingCounters, setPendingCounters] = useState([]);
  const [draft, setDraft] = useState(null);
  const loadedRef = useRef(false);

  // Load deal data from sessionStorage OR database (if editing)
  useEffect(() => {
    if (!profile || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        let dealData = null;
        let agentIds = [];
        let existingRoom = null;
        const isEditingExistingDeal = !!dealId;

        // If editing existing deal, load from database
        if (isEditingExistingDeal) {
          console.log('[MyAgreement] Loading existing deal from database:', dealId);
          const deals = await base44.entities.Deal.filter({ id: dealId });
          if (!deals?.length) {
            toast.error('Deal not found');
            navigate(createPageUrl('Pipeline'), { replace: true });
            return;
          }
          const dbDeal = deals[0];
          
          // Convert Deal entity to dealData format for agreement generation
          const terms = dbDeal.proposed_terms || {};
          dealData = {
            dealId: dbDeal.id,
            propertyAddress: dbDeal.property_address,
            city: dbDeal.city,
            state: dbDeal.state,
            zip: dbDeal.zip,
            county: dbDeal.county,
            purchasePrice: dbDeal.purchase_price,
            closingDate: dbDeal.key_dates?.closing_date,
            contractDate: dbDeal.key_dates?.contract_date,
            propertyType: dbDeal.property_type,
            beds: dbDeal.property_details?.beds,
            baths: dbDeal.property_details?.baths,
            sqft: dbDeal.property_details?.sqft,
            yearBuilt: dbDeal.property_details?.year_built,
            numberOfStories: dbDeal.property_details?.number_of_stories,
            hasBasement: dbDeal.property_details?.has_basement,
            sellerName: dbDeal.seller_info?.seller_name,
            earnestMoney: dbDeal.seller_info?.earnest_money,
            numberOfSigners: dbDeal.seller_info?.number_of_signers || '1',
            secondSignerName: dbDeal.seller_info?.second_signer_name,
            sellerCommissionType: terms.seller_commission_type === 'flat_fee' ? 'flat' : (terms.seller_commission_type || 'percentage'),
            sellerCommissionPercentage: terms.seller_commission_percentage,
            sellerFlatFee: terms.seller_flat_fee,
            buyerCommissionType: terms.buyer_commission_type === 'flat_fee' ? 'flat' : (terms.buyer_commission_type || 'percentage'),
            buyerCommissionPercentage: terms.buyer_commission_percentage,
            buyerFlatFee: terms.buyer_flat_fee,
            agreementLength: terms.agreement_length,
            contractUrl: dbDeal.contract_document?.url,
            specialNotes: dbDeal.special_notes,
            selectedAgentIds: dbDeal.selected_agent_ids || [],
            walkthroughSlots: (dbDeal.walkthrough_slots || []).filter(s => s.date && s.date.length >= 8)
          };
          agentIds = dealData.selectedAgentIds;
          console.log('[MyAgreement] Loaded deal data:', { buyerCommissionPercentage: dealData.buyerCommissionPercentage, agreementLength: dealData.agreementLength });

          // Load existing room for this deal
          const rooms = await base44.entities.Room.filter({ deal_id: dealId });
          if (rooms?.length) {
            existingRoom = rooms[0];
            setRoom(existingRoom);
            console.log('[MyAgreement] Found existing room:', existingRoom.id);
          }

          // Void all old non-voided agreements for this deal
          const oldAgreements = await base44.entities.LegalAgreement.filter({ deal_id: dealId });
          for (const ag of oldAgreements) {
            if (ag.status !== 'voided' && ag.status !== 'superseded') {
              await base44.entities.LegalAgreement.update(ag.id, { status: 'voided' });
              console.log('[MyAgreement] Voided old agreement:', ag.id);
            }
          }

          // Clear deal's current_legal_agreement_id since we'll generate a new one
          await base44.entities.Deal.update(dealId, { current_legal_agreement_id: null });
          if (existingRoom) {
            await base44.entities.Room.update(existingRoom.id, { 
              current_legal_agreement_id: null,
              agreement_status: 'draft',
              requires_regenerate: false
            });
          }

        } else {
         // New deal - load from sessionStorage
         const draftData = sessionStorage.getItem('newDealDraft');
         if (!draftData) {
           toast.error('No deal data found. Please start over.');
           navigate(createPageUrl('Pipeline'), { replace: true });
           return;
         }
         dealData = JSON.parse(draftData);
         agentIds = dealData.selectedAgentIds || [];
        }

        if (agentIds.length === 0) {
          toast.error('No agents selected. Please start over.');
          navigate(createPageUrl('Pipeline'), { replace: true });
          return;
        }

        // Build proposed_terms from deal data
        const buyerCommType = dealData.buyerCommissionType || 'percentage';
        const sellerCommType = dealData.sellerCommissionType || 'percentage';
        const proposedTerms = {
          seller_commission_type: sellerCommType,
          seller_commission_percentage: sellerCommType === 'percentage' ? Number(dealData.sellerCommissionPercentage) : null,
          seller_flat_fee: (sellerCommType === 'flat' || sellerCommType === 'flat_fee') ? Number(dealData.sellerFlatFee) : null,
          buyer_commission_type: buyerCommType,
          buyer_commission_percentage: buyerCommType === 'percentage' ? Number(dealData.buyerCommissionPercentage) : null,
          buyer_flat_fee: (buyerCommType === 'flat' || buyerCommType === 'flat_fee') ? Number(dealData.buyerFlatFee) : null,
          agreement_length: dealData.agreementLength ? Number(dealData.agreementLength) : null
        };

        if (isEditingExistingDeal) {
          // EDITING: Don't create DealDraft. Use existing deal ID directly.
          setDraft({ id: dealId });
          setDeal({ 
            ...dealData, 
            proposed_terms: proposedTerms,
            investor_id: profile.id,
            draft_id: dealId
          });
        } else {
          // NEW DEAL: Create DealDraft so automation can find it after investor signs
          const cleanedPrice = String(dealData.purchasePrice || "").replace(/[$,\s]/g, "").trim();
          const wtSlots = (Array.isArray(dealData.walkthroughSlots) ? dealData.walkthroughSlots : []).filter(s => s.date && String(s.date).length >= 8);

          const draftPayload = {
            property_address: dealData.propertyAddress,
            city: dealData.city,
            state: dealData.state,
            zip: dealData.zip,
            county: dealData.county,
            purchase_price: Number(cleanedPrice),
            property_type: dealData.propertyType || null,
            beds: dealData.beds ? Number(dealData.beds) : null,
            baths: dealData.baths ? Number(dealData.baths) : null,
            sqft: dealData.sqft ? Number(dealData.sqft) : null,
            year_built: dealData.yearBuilt ? Number(dealData.yearBuilt) : null,
            number_of_stories: dealData.numberOfStories || null,
            has_basement: dealData.hasBasement || null,
            seller_name: dealData.sellerName,
            earnest_money: dealData.earnestMoney ? Number(dealData.earnestMoney) : null,
            number_of_signers: dealData.numberOfSigners,
            second_signer_name: dealData.secondSignerName,
            buyer_commission_type: buyerCommType,
            buyer_commission_percentage: buyerCommType === 'percentage' ? Number(dealData.buyerCommissionPercentage) : null,
            buyer_flat_fee: (buyerCommType === 'flat' || buyerCommType === 'flat_fee') ? Number(dealData.buyerFlatFee) : null,
            agreement_length: dealData.agreementLength ? Number(dealData.agreementLength) : null,
            contract_url: dealData.contractUrl || null,
            special_notes: dealData.specialNotes || null,
            deal_type: dealData.dealType || null,
            closing_date: dealData.closingDate,
            contract_date: dealData.contractDate,
            selected_agent_ids: agentIds,
            seller_commission_type: sellerCommType,
            seller_commission_percentage: sellerCommType === 'percentage' ? Number(dealData.sellerCommissionPercentage) : null,
            seller_flat_fee: (sellerCommType === 'flat' || sellerCommType === 'flat_fee') ? Number(dealData.sellerFlatFee) : null,
            walkthrough_slots: wtSlots
          };
          // Create DealDraft with walkthrough slots
          const result = await base44.functions.invoke('createDealDraft', draftPayload);
          const draftCreated = { id: result?.data?.draft_id };
          setDraft(draftCreated);
          setDeal({ 
            ...dealData, 
            proposed_terms: proposedTerms,
            investor_id: profile.id,
            draft_id: draftCreated.id
          });
        }

        setSelectedAgentIds(agentIds);

        // Load agent profiles
        if (agentIds.length > 0) {
          const agentPromises = agentIds.map(id => 
            base44.entities.Profile.filter({ id }).then(profiles => profiles[0])
          );
          const agents = await Promise.all(agentPromises);
          setAgentProfiles(agents.filter(Boolean));
        }
      } catch (e) {
        console.error('[MyAgreement] Error loading deal data:', e);
        toast.error('Failed to load deal data');
        navigate(createPageUrl('Pipeline'), { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, profile]);

  // Subscribe to real-time agreement updates for this deal
  // Accept agreements with or without room_id — the automation links room_id after signing
  useEffect(() => {
    if (!dealId) return;

    const unsub = base44.entities.LegalAgreement.subscribe((event) => {
      const a = event?.data;
      if (!a) return;
      if (a.deal_id !== dealId) return;
      // Skip voided/superseded — only track the active agreement
      if (a.status === 'voided' || a.status === 'superseded') return;
      setAgreement(a);
    });

    return () => unsub?.();
  }, [dealId]);

  // Subscribe to real-time counter offer updates
  useEffect(() => {
    if (!room?.id) return;

    const unsub = base44.entities.CounterOffer.subscribe((event) => {
      const counter = event?.data;
      if (!counter || counter.room_id !== room.id) return;

      // CRITICAL: Only show pending counters, remove all others
      if (event.type === 'create' || event.type === 'update') {
        if (counter.status === 'pending') {
          setPendingCounters(prev => {
            const exists = prev.find(c => c.id === counter.id);
            if (exists) {
              return prev.map(c => c.id === counter.id ? counter : c);
            }
            return [...prev, counter];
          });
        } else {
          // Counter status changed to non-pending, remove it
          setPendingCounters(prev => prev.filter(c => c.id !== counter.id));
        }
      } else if (event.type === 'delete') {
        setPendingCounters(prev => prev.filter(c => c.id !== counter.id));
      }
    });

    return () => unsub?.();
  }, [room?.id]);

  // Refresh deal when room updates (to pick up updated proposed_terms after counter acceptance)
  useEffect(() => {
    if (!dealId || !room?.id) return;

    const unsub = base44.entities.Room.subscribe((event) => {
      const updatedRoom = event?.data;
      if (!updatedRoom || updatedRoom.id !== room.id) return;

      // Update room state to trigger UI refresh with new proposed_terms
      setRoom(updatedRoom);

      // Also refresh deal if room proposed_terms changed
      if (updatedRoom.proposed_terms && updatedRoom.proposed_terms !== room.proposed_terms) {
        setDeal(prev => prev ? {
          ...prev,
          proposed_terms: updatedRoom.proposed_terms
        } : prev);
      }
    });

    return () => unsub?.();
  }, [dealId, room?.id]);

  if (loadingProfile || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64 mx-auto" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-[#808080]">No deal data found</p>
          <button onClick={() => navigate(createPageUrl('NewDeal'))} className="mt-4 text-[#E3C567] hover:underline">Start over</button>
        </div>
      </div>
    );
  }

  // After investor signs, handle differently for new vs editing deals
  const handlePostSigningNavigation = async () => {
    // Clear sessionStorage
    sessionStorage.removeItem('newDealDraft');
    sessionStorage.removeItem('selectedAgentIds');


    // Clear caches
    queryClient.invalidateQueries({ queryKey: ['rooms', profile?.id] });
    queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });

    if (dealId) {
      // EDITING: Deal and room already exist. Update the agreement reference.
      console.log('[MyAgreement] Investor re-signed edited deal - updating agreement links');
      toast.success('Agreement signed! Sending updated agreement to agents...');

      // Wait briefly for the automation to link things, then navigate
      setTimeout(() => {
        navigate(createPageUrl('Pipeline'), { replace: true });
      }, 2000);
    } else {
      // NEW DEAL: automation will create deal and invites
      console.log('[MyAgreement] Investor signed - automation will create deal and invites');
      toast.success('Agreement signed! Your deal is being created and sent to agents...');

      setTimeout(() => {
        navigate(createPageUrl('Pipeline'), { replace: true });
      }, 2000);
    }
  };



  return (
    <div className="min-h-screen bg-transparent px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => navigate(createPageUrl('NewDeal'))}
          className="text-[#808080] hover:text-[#E3C567] text-sm"
        >
          ← Back
        </button>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#E3C567]">Generate & Sign Agreement</h1>
          <p className="text-sm text-[#808080]">Review your selected agents and sign to send the deal</p>
        </div>

        {/* Selected Agents - Before Signing */}
        {agentProfiles.length > 0 && !agreement?.investor_signed_at && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-[#E3C567] mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Selected Agents ({agentProfiles.length})
            </h2>
            <div className="space-y-3">
              {agentProfiles.map(agent => (
                <div key={agent.id} className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[#FAFAFA] font-semibold">{agent.full_name}</p>
                    <p className="text-sm text-[#808080]">{agent.email}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-[#34D399]" />
                </div>
              ))}
            </div>
            <p className="text-xs text-[#808080] mt-4">
              {agentProfiles.length > 1 
                ? 'After you sign, select which agent you want to work with.'
                : 'After you sign, the deal will be sent to this agent.'}
            </p>
          </div>
        )}



        <SimpleAgreementPanel 
          key={`${draft?.id}-${room?.id}`}
          dealId={draft?.id}
          dealData={deal}
          draftId={draft?.id}
          roomId={room?.id}
          agreement={agreement}
          room={room}
          profile={profile}
          pendingCounters={pendingCounters}
          setPendingCounters={setPendingCounters}
          onInvestorSigned={handlePostSigningNavigation}
          onCounterUpdate={() => {}}
          onRoomUpdate={(updatedRoom) => {
            if (updatedRoom) setRoom(updatedRoom);
          }}
        />

        {/* Deal Summary */}
         {deal && (
           <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-5">
             <h2 className="text-lg font-bold text-[#E3C567] mb-4">Deal Summary</h2>
             <div className="grid grid-cols-2 gap-4 text-sm">
               <div>
                 <p className="text-[#808080]">Property</p>
                 <p className="text-[#FAFAFA] font-semibold">{deal.city}, {deal.state}</p>
               </div>
               <div>
                 <p className="text-[#808080]">Price</p>
                 <p className="text-[#FAFAFA] font-semibold">${(deal.purchase_price || deal.purchasePrice || 0).toLocaleString()}</p>
               </div>
               <div>
                 <p className="text-[#808080]">Seller's Agent Compensation</p>
                 <p className="text-[#FAFAFA] font-semibold">
                   {(() => {
                     const terms = deal.proposed_terms || {};
                     const type = terms.seller_commission_type || deal.sellerCommissionType || 'percentage';
                     const pct = terms.seller_commission_percentage ?? deal.sellerCommissionPercentage;
                     const flat = terms.seller_flat_fee ?? deal.sellerFlatFee;
                     if (type === 'flat_fee' || type === 'flat') {
                       return flat != null ? `$${Number(flat).toLocaleString()}` : '—';
                     }
                     return pct != null ? `${pct}%` : '—';
                   })()}
                 </p>
               </div>
               <div>
                 <p className="text-[#808080]">Buyer's Agent Compensation</p>
                 <p className="text-[#FAFAFA] font-semibold">
                   {(() => {
                     const terms = deal.proposed_terms || {};
                     const type = terms.buyer_commission_type || deal.buyerCommissionType || 'percentage';
                     const pct = terms.buyer_commission_percentage ?? deal.buyerCommissionPercentage;
                     const flat = terms.buyer_flat_fee ?? deal.buyerFlatFee;
                     if (type === 'flat_fee' || type === 'flat') {
                       return flat != null ? `$${Number(flat).toLocaleString()}` : '—';
                     }
                     return pct != null ? `${pct}%` : '—';
                   })()}
                 </p>
               </div>
               <div>
                 <p className="text-[#808080]">Agreement Length</p>
                 <p className="text-[#FAFAFA] font-semibold">
                   {(() => {
                     const terms = deal.proposed_terms || {};
                     const len = terms.agreement_length ?? deal.agreementLength;
                     return len != null ? `${len} days` : '—';
                   })()}
                 </p>
               </div>
               <div className="col-span-2">
                 <p className="text-[#808080]">Walkthrough Slots</p>
                 {(() => {
                   const slots = (deal.walkthroughSlots || []).filter(s => s.date && s.date.length >= 8);
                   if (slots.length === 0) return <p className="text-[#FAFAFA] font-semibold">—</p>;
                   return (
                     <div className="space-y-1">
                       {slots.map((slot, idx) => {
                         const time = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ');
                         return (
                           <p key={idx} className="text-[#FAFAFA] font-semibold text-sm">
                             {slot.date}
                             {time && <span className="text-[#808080] ml-2">{time}</span>}
                           </p>
                         );
                       })}
                     </div>
                   );
                 })()}
               </div>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
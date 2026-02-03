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
  const [loading, setLoading] = useState(true);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [agentProfiles, setAgentProfiles] = useState([]);
  const [selectedAgentForSigning, setSelectedAgentForSigning] = useState(null);
  const [room, setRoom] = useState(null);
  const [pendingCounters, setPendingCounters] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const loadedRef = useRef(false);

  // Load deal data from sessionStorage and create DealDraft
  useEffect(() => {
    if (!profile || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        // Load deal data from sessionStorage
        const draftData = sessionStorage.getItem('newDealDraft');
        if (!draftData) {
          toast.error('No deal data found. Please start over.');
          navigate(createPageUrl('Pipeline'), { replace: true });
          return;
        }

        const dealData = JSON.parse(draftData);
        const agentIds = dealData.selectedAgentIds || [];

        if (agentIds.length === 0) {
          toast.error('No agents selected. Please start over.');
          navigate(createPageUrl('Pipeline'), { replace: true });
          return;
        }

        // Create DealDraft entity to store temporarily until signing
        const cleanedPrice = String(dealData.purchasePrice || "").replace(/[$,\s]/g, "").trim();
        
        const draft = await base44.entities.DealDraft.create({
          investor_profile_id: profile.id,
          property_address: dealData.propertyAddress,
          city: dealData.city,
          state: dealData.state,
          zip: dealData.zip,
          county: dealData.county,
          purchase_price: Number(cleanedPrice),
          closing_date: dealData.closingDate,
          contract_date: dealData.contractDate,
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
          seller_commission_type: dealData.sellerCommissionType,
          seller_commission_percentage: dealData.sellerCommissionPercentage ? Number(dealData.sellerCommissionPercentage) : null,
          seller_flat_fee: dealData.sellerFlatFee ? Number(dealData.sellerFlatFee) : null,
          buyer_commission_type: dealData.buyerCommissionType,
          buyer_commission_percentage: dealData.buyerCommissionPercentage ? Number(dealData.buyerCommissionPercentage) : null,
          buyer_flat_fee: dealData.buyerFlatFee ? Number(dealData.buyerFlatFee) : null,
          agreement_length: dealData.agreementLength ? Number(dealData.agreementLength) : null,
          contract_url: dealData.contractUrl || null,
          special_notes: dealData.specialNotes || null,
          selected_agent_ids: agentIds
        });

        console.log('[MyAgreement] Created DealDraft:', draft.id);
        
        setDraftId(draft.id);
        setDeal(dealData);
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

  // Subscribe to real-time agreement updates (ONLY base agreement, not room-scoped)
  useEffect(() => {
    if (!dealId) return;

    const unsub = base44.entities.LegalAgreement.subscribe((event) => {
      const a = event?.data;
      if (!a) return;
      if (a.deal_id !== dealId) return;
      if (a.room_id != null) return; // ONLY base agreement updates
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

  if (loadingProfile || loading || !deal) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64 mx-auto" />
      </div>
    );
  }

  // After investor signs, automation will handle deal creation
  const handlePostSigningNavigation = async () => {
    console.log('[MyAgreement] Investor signed - automation will create deal');
    
    // Clear sessionStorage
    sessionStorage.removeItem('newDealDraft');
    sessionStorage.removeItem('selectedAgentIds');

    // Clear caches
    queryClient.invalidateQueries({ queryKey: ['rooms', profile?.id] });
    queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });

    // Show success message
    toast.success('Agreement signed! Your deal is being created...');

    // Wait a moment for automation to complete, then navigate
    setTimeout(() => {
      navigate(createPageUrl('Pipeline'), { replace: true });
    }, 2000);
  };



  return (
    <div className="min-h-screen bg-transparent px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => navigate(createPageUrl('Pipeline'))}
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
          dealId={null}
          dealData={deal}
          draftId={draftId}
          roomId={room?.id}
          agreement={agreement}
          room={room}
          profile={profile}
          pendingCounters={pendingCounters}
          setPendingCounters={setPendingCounters}
          onInvestorSigned={handlePostSigningNavigation}
          onCounterUpdate={(updatedDeal) => {
            if (updatedDeal) setDeal(updatedDeal);
          }}
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
               <div className="col-span-2">
                 <p className="text-[#808080]">Buyer Commission</p>
                 <p className="text-[#FAFAFA] font-semibold">
                   {(room?.proposed_terms || deal.proposed_terms)?.buyer_commission_type === 'percentage'
                     ? `${(room?.proposed_terms || deal.proposed_terms)?.buyer_commission_percentage}%`
                     : `$${((room?.proposed_terms || deal.proposed_terms)?.buyer_flat_fee || 0).toLocaleString()}`}
                 </p>
               </div>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
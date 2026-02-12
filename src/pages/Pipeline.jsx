import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LegalFooterLinks from "@/components/LegalFooterLinks";
import { FileText, Calendar, TrendingUp, CheckCircle, Plus, Home, Clock, XCircle, Circle, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCachedDeal } from "@/components/utils/dealCache";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SetupChecklist from "@/components/SetupChecklist";
import HelpPanel from "@/components/HelpPanel";
import { PIPELINE_STAGES, normalizeStage, getStageLabel, stageOrder } from "@/components/pipelineStages";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { getPriceAndComp } from "@/components/utils/dealCompDisplay";

function PipelineContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { profile, loading, onboarded } = useCurrentProfile();
  const [helpOpen, setHelpOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin';
  const isAgent = !isAdmin && profile?.user_role === 'agent';
  const isInvestor = profile?.user_role === 'investor' || isAdmin;

  // Gating
  const gateRef = useRef(false);
  useEffect(() => {
    if (loading || ready) return;
    if (gateRef.current) return;
    if (!profile) { gateRef.current = true; navigate(createPageUrl("PostAuth"), { replace: true }); return; }
    if (profile.role === 'admin') { setReady(true); return; }
    if (!onboarded) {
      gateRef.current = true;
      navigate(createPageUrl(profile.user_role === 'agent' ? "AgentOnboarding" : "InvestorOnboarding"), { replace: true });
      return;
    }
    const isPaid = profile.subscription_status === 'active' || profile.subscription_status === 'trialing';
    if (profile.user_role === 'investor' && !isPaid) { gateRef.current = true; navigate(createPageUrl("Pricing"), { replace: true }); return; }
    const kyc = profile.kyc_status || profile.identity_status || 'unverified';
    if (kyc !== 'approved' && kyc !== 'verified' && !profile.identity_verified_at) { gateRef.current = true; navigate(createPageUrl("IdentityVerification"), { replace: true }); return; }
    if (!profile.nda_accepted) { gateRef.current = true; navigate(createPageUrl("NDA"), { replace: true }); return; }
    setReady(true);
  }, [loading, profile, onboarded]);

  // Load deals
  const { data: dealsData = [], isLoading: loadingDeals, refetch: refetchDeals } = useQuery({
    queryKey: ['pipelineDeals', profile?.id],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await base44.functions.invoke('getPipelineDealsForUser');
      const deals = res.data?.deals || [];
      // Dedup by ID
      const map = new Map();
      deals.filter(d => d?.id && d.status !== 'archived').forEach(d => {
        const prev = map.get(d.id);
        if (!prev || new Date(d.updated_date || 0) > new Date(prev.updated_date || 0)) map.set(d.id, d);
      });
      return [...map.values()].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!profile?.id && ready,
    refetchOnWindowFocus: true,
  });

  // Load rooms for matching
  const { data: rooms = [], refetch: refetchRooms } = useQuery({
    queryKey: ['rooms', profile?.id],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await base44.functions.invoke('listMyRoomsEnriched');
      return res.data?.rooms || [];
    },
    enabled: !!profile?.id && ready,
  });

  // Real-time refresh for agents
  useEffect(() => {
    if (!profile?.id) return;
    const unsubs = [];
    unsubs.push(base44.entities.Room.subscribe(() => { refetchDeals(); refetchRooms(); }));
    unsubs.push(base44.entities.Deal.subscribe(() => { refetchDeals(); }));
    if (isAgent) unsubs.push(base44.entities.DealInvite.subscribe(() => { refetchDeals(); refetchRooms(); }));
    return () => unsubs.forEach(u => { try { u(); } catch (_) {} });
  }, [profile?.id, isAgent]);

  // Post-signing redirect refresh
  useEffect(() => {
    if (new URLSearchParams(location.search).get('signed') === '1') {
      refetchDeals(); refetchRooms();
    }
  }, [location.search]);

  // Merge deals with rooms
  const deals = useMemo(() => {
    const roomMap = new Map();
    (rooms || []).forEach(r => {
      if (!r?.deal_id) return;
      if (isAgent) {
        const agentInRoom = (r.agent_ids || []).includes(profile?.id) || r.agentId === profile?.id || r.counterparty_role === 'investor';
        if (!agentInRoom) return;
      }
      const prev = roomMap.get(r.deal_id);
      const score = (x) => (x.is_fully_signed ? 3 : x.request_status === 'accepted' ? 2 : 1);
      if (!prev || score(r) > score(prev)) roomMap.set(r.deal_id, r);
    });

    return (dealsData || []).map(deal => {
      const room = roomMap.get(deal.id);
      const isSigned = room?.agreement_status === 'fully_signed' || room?.request_status === 'signed' || deal.is_fully_signed;
      const hasAgent = room?.request_status === 'accepted' || room?.request_status === 'signed' || room?.request_status === 'locked';

      let counterparty = 'Not Assigned';
      if (isSigned) counterparty = room?.counterparty_name || (isAgent ? 'Investor' : 'Agent');
      else if (hasAgent) counterparty = isAgent ? 'Pending Signatures' : 'Pending Agent Signature';

      return {
        id: deal.id, deal_id: deal.id, room_id: room?.id || null,
        title: deal.title, property_address: deal.property_address,
        city: deal.city, state: deal.state, budget: deal.purchase_price,
        pipeline_stage: isSigned ? normalizeStage(deal.pipeline_stage || 'connected_deals') : normalizeStage(deal.pipeline_stage || 'new_deals'),
        customer_name: counterparty,
        agent_request_status: room?.request_status,
        agreement_status: room?.agreement_status,
        created_date: deal.created_date, updated_date: deal.updated_date,
        closing_date: deal.key_dates?.closing_date,
        is_fully_signed: isSigned, is_orphan: !hasAgent,
        locked_agent_id: deal.locked_agent_id, locked_room_id: deal.locked_room_id,
        seller_name: deal.seller_info?.seller_name,
        selected_agent_ids: deal.selected_agent_ids,
        proposed_terms: (() => {
          // Only merge agent-specific counter terms when deal is fully signed
          const base = room?.proposed_terms || deal.proposed_terms || {};
          if (!isSigned) return base;
          if (isAgent && room?.agent_terms?.[profile?.id]) {
            return { ...base, ...room.agent_terms[profile.id] };
          }
          if (isInvestor && room?.agent_terms) {
            const ids = Object.keys(room.agent_terms);
            if (ids.length === 1) return { ...base, ...room.agent_terms[ids[0]] };
          }
          return base;
        })(),
        room_agent_terms: room?.agent_terms || null,
        room_agent_ids: room?.agent_ids || [],
        agreement: room?.agreement || null,
        investor_signed_at: room?.agreement?.investor_signed_at || null,
        pending_counter_offer: room?.pending_counter_offer || null
      };
    }).filter(d => {
      if (!isAgent) return true;
      if (d.locked_agent_id && d.locked_agent_id !== profile.id) return false;
      if (d.agent_request_status === 'rejected' || d.agent_request_status === 'voided') return false;
      return true;
    });
  }, [dealsData, rooms, profile?.id, isAgent]);

  const handleDealClick = async (deal) => {
    if (deal.room_id) {
      navigate(`${createPageUrl("Room")}?roomId=${deal.room_id}`);
    } else {
      const roomArr = await base44.entities.Room.filter({ deal_id: deal.deal_id });
      if (roomArr?.length) navigate(`${createPageUrl("Room")}?roomId=${roomArr[0].id}`);
      else toast.error('Room not ready yet. Please try again in a moment.');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const newStage = normalizeStage(result.destination.droppableId);
    await base44.entities.Deal.update(result.draggableId, { pipeline_stage: newStage });
    refetchDeals();
  };

  const pipelineStages = useMemo(() => PIPELINE_STAGES.filter(s => s.id !== 'canceled').map(s => ({
    ...s,
    icon: s.id === 'new_deals' ? FileText : s.id === 'connected_deals' ? CheckCircle : s.id === 'active_listings' ? TrendingUp : s.id === 'in_closing' ? Clock : CheckCircle,
    label: s.id === 'completed' ? 'Completed/Canceled' : s.label
  })), []);

  const dealsByStage = useMemo(() => {
    const m = new Map();
    pipelineStages.forEach(s => m.set(s.id, []));
    deals.forEach(d => { const stage = d.pipeline_stage === 'canceled' ? 'completed' : d.pipeline_stage; (m.get(stage) || m.get('new_deals')).push(d); });
    return m;
  }, [deals]);

  const getDaysInPipeline = (d) => { if (!d) return 'N/A'; return `${Math.floor((new Date() - new Date(d)) / 86400000)}d`; };

  if (loading || !profile || !ready) {
    return <div className="min-h-screen bg-transparent flex flex-col"><Header profile={profile} /><div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" /></div></div>;
  }

  // Setup check
  const setupDone = isInvestor ? (!!profile.onboarding_completed_at && !!profile.nda_accepted) : (!!profile.onboarding_completed_at && !!profile.nda_accepted && (profile.identity_status === 'approved' || profile.identity_status === 'verified'));

  return (
    <>
      <Header profile={profile} />
      <div className="h-screen bg-transparent flex flex-col pt-4">
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="max-w-[1800px] mx-auto">
            {!setupDone && <div className="mb-6"><SetupChecklist profile={profile} /></div>}

            <div className="flex items-center justify-between mb-8">
              <div><h1 className="text-3xl font-bold text-[#E3C567]">Dashboard</h1><p className="text-sm text-[#808080] mt-1">Manage your deals</p></div>
              <div className="flex items-center gap-3">
                {isInvestor && <Button onClick={() => { try { sessionStorage.removeItem('newDealDraft'); } catch (_) {} navigate(createPageUrl("NewDeal")); }} className="bg-[#E3C567] text-black hover:bg-[#D4AF37] rounded-full"><Plus className="w-4 h-4 mr-2" />New Deal</Button>}
                <Button onClick={() => setHelpOpen(true)} className="bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#1F1F1F] rounded-full">Tutorials</Button>
              </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                {pipelineStages.map(stage => {
                  const stageDeals = dealsByStage.get(stage.id) || [];
                  const Icon = stage.icon;
                  return (
                    <div key={stage.id} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-4 flex flex-col md:h-[400px]">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#1F1F1F]">
                        <div className="w-8 h-8 rounded-lg bg-[#E3C567]/10 flex items-center justify-center text-[#E3C567]"><Icon className="w-4 h-4" /></div>
                        <div><h3 className="text-[#FAFAFA] font-bold text-sm">{stage.label}</h3><p className="text-xs text-[#808080]">{stageDeals.length} deals</p></div>
                      </div>
                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className={`md:flex-1 md:overflow-y-auto space-y-3 pr-2 ${snapshot.isDraggingOver ? 'bg-[#E3C567]/5' : ''}`}>
                            {stageDeals.length === 0 ? <div className="h-full flex items-center justify-center text-[#333] text-sm">{snapshot.isDraggingOver ? 'Drop here' : 'No deals'}</div> : stageDeals.map((deal, index) => (
                              <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`bg-[#141414] border border-[#1F1F1F] p-4 rounded-xl hover:border-[#E3C567] transition-all ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-[#E3C567]' : ''}`}>
                                    <div className="flex justify-between items-start mb-2">
                                      <h4 className="text-[#FAFAFA] font-bold text-sm line-clamp-2">{isAgent && !deal.is_fully_signed ? `${deal.city}, ${deal.state}` : deal.property_address}</h4>
                                      <span className="text-[10px] bg-[#222] text-[#808080] px-2 py-0.5 rounded-full">{getDaysInPipeline(deal.created_date)}</span>
                                    </div>
                                    <div className="flex flex-col gap-2 mb-3">
                                      <div className="flex items-center gap-1 text-xs text-[#666]"><Home className="w-3 h-3" />{deal.city}, {deal.state}</div>
                                      {deal.budget > 0 && <div className="text-xs text-[#34D399] font-semibold">${deal.budget.toLocaleString()}</div>}
                                    {(() => {
                                      // Show seller comp for agents, buyer comp for investors
                                      // Use room agent_terms (set by accepted counters) for accurate display
                                      const roomData = deal.room_agent_terms ? { agent_terms: deal.room_agent_terms, proposed_terms: deal.proposed_terms } : null;
                                      const dealData = { proposed_terms: deal.proposed_terms, purchase_price: deal.budget };
                                      const agentId = isAgent ? profile?.id : (deal.room_agent_ids?.[0] || null);
                                      let compLabel = null;
                                      if (isAgent) {
                                        const { compLabel: sellerComp } = getPriceAndComp({ deal: dealData, room: roomData, side: 'seller', agentId });
                                        compLabel = sellerComp;
                                        if (!compLabel) {
                                          const { compLabel: buyerComp } = getPriceAndComp({ deal: dealData, room: roomData, side: 'buyer', agentId });
                                          compLabel = buyerComp;
                                        }
                                      } else {
                                        const { compLabel: buyerComp } = getPriceAndComp({ deal: dealData, room: roomData, side: 'buyer', agentId });
                                        compLabel = buyerComp;
                                      }
                                      return compLabel ? <div className="text-xs text-[#E3C567] font-semibold">{isAgent ? "Agent Comp" : "Comp"}: {compLabel}</div> : null;
                                    })()}
                                      {(() => {
                                        const badge = getAgreementStatusLabel({
                                          room: { agreement_status: deal.agreement_status, is_fully_signed: deal.is_fully_signed, investor_signed_at: deal.investor_signed_at, agreement: deal.agreement },
                                          agreement: deal.agreement || undefined,
                                          negotiation: deal.pending_counter_offer ? { status: deal.pending_counter_offer.from_role === 'agent' ? 'COUNTERED_BY_AGENT' : 'COUNTERED_BY_INVESTOR', last_actor: deal.pending_counter_offer.from_role } : undefined,
                                          role: isAgent ? 'agent' : (isAdmin ? 'investor' : 'investor')
                                        });
                                        return badge ? <span className={`text-[10px] border px-2 py-0.5 rounded-full w-fit ${badge.className}`}>{badge.label}</span> : null;
                                      })()}
                                      {deal.customer_name && !deal.is_orphan && <div className="text-xs text-[#10B981] flex items-center gap-1"><CheckCircle className="w-3 h-3" />{deal.customer_name}</div>}
                                    </div>
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-[#1F1F1F]">
                                      <Button onClick={e => { e.stopPropagation(); handleDealClick(deal); }} size="sm" className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs py-1.5 h-auto">Open Deal Room</Button>
                                      {isInvestor && <Button onClick={e => { e.stopPropagation(); sessionStorage.removeItem('newDealDraft'); navigate(`${createPageUrl("NewDeal")}?dealId=${deal.deal_id}`); }} size="sm" className="flex-1 bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#1F1F1F] rounded-full text-xs py-1.5 h-auto">Edit</Button>}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
            <LegalFooterLinks />
          </div>
        </div>
      </div>
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

export default function Pipeline() {
  return <AuthGuard requireAuth={true}><PipelineContent /></AuthGuard>;
}
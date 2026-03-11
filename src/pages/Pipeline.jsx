import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LegalFooterLinks from "@/components/LegalFooterLinks";
import { FileText, Calendar, TrendingUp, CheckCircle, Plus, Home, Clock, XCircle, Circle, Loader2, MessageSquare, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SetupChecklist from "@/components/SetupChecklist";
import HelpPanel from "@/components/HelpPanel";
import { PIPELINE_STAGES, normalizeStage, getStageLabel, stageOrder } from "@/components/pipelineStages";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { getPriceAndComp, getSellerCompLabel } from "@/components/utils/dealCompDisplay";
import { getDealNextStepLabel } from "@/components/utils/dealNextStepLabel";
import InlineReviewForm from "@/components/room/InlineReviewForm";
import InlineAgentReviewForm from "@/components/room/InlineAgentReviewForm";
import NotificationBell from "@/components/NotificationBell";

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

  // Gating — wait for auth to fully resolve before redirecting anywhere
  const gateRef = useRef(false);
  const gateAttempts = useRef(0);
  useEffect(() => {
    if (loading || ready) return;
    if (gateRef.current) return;
    if (!profile) {
      // On Safari refresh, profile can be null momentarily while auth resolves.
      // Wait up to ~3 seconds (6 attempts * 500ms) before giving up and redirecting.
      gateAttempts.current += 1;
      if (gateAttempts.current < 6) return; // will re-run when loading/profile changes
      gateRef.current = true;
      navigate(createPageUrl("PostAuth"), { replace: true });
      return;
    }
    if (profile.role === 'admin' || profile.user_role === 'admin') { setReady(true); return; }
    if (profile.user_role === 'agent' && profile.qualification_tier === 'conditional') {
      gateRef.current = true;
      navigate(createPageUrl("ConditionalReview"), { replace: true });
      return;
    }
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
    staleTime: 5_000,
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
  const { data: rooms = [], isLoading: loadingRooms, refetch: refetchRooms } = useQuery({
    queryKey: ['rooms', profile?.id],
    staleTime: 5_000,
    queryFn: async () => {
      const res = await base44.functions.invoke('listMyRoomsEnriched');
      return res.data?.rooms || [];
    },
    enabled: !!profile?.id && ready,
  });

  // Track previous deal stages for detecting transitions to completed/canceled
  const prevStagesRef = useRef(new Map());

  // Real-time refresh — debounced to avoid 429 rate limits during burst events
  const refetchTimerRef = useRef(null);
  const debouncedRefetch = () => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchDeals();
      refetchRooms();
    }, 2000);
  };

  useEffect(() => {
    if (!profile?.id) return;
    const unsubs = [];
    unsubs.push(base44.entities.Room.subscribe(() => debouncedRefetch()));
    unsubs.push(base44.entities.Deal.subscribe(() => debouncedRefetch()));
    unsubs.push(base44.entities.DealAppointments.subscribe(() => { queryClient.invalidateQueries({ queryKey: ['wtStatuses'] }); }));
    if (isAgent) unsubs.push(base44.entities.DealInvite.subscribe(() => debouncedRefetch()));
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      unsubs.forEach(u => { try { u(); } catch (_) {} });
    };
  }, [profile?.id, isAgent, isInvestor]);

  // Keep previous stages map in sync for detecting transitions
  useEffect(() => {
    if (dealsData?.length) {
      const map = new Map();
      dealsData.forEach(d => { if (d?.id) map.set(d.id, normalizeStage(d.pipeline_stage)); });
      prevStagesRef.current = map;
    }
  }, [dealsData]);

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
       // For investor: if deal has a locked agent, always show that agent's name
       if (isInvestor && deal.locked_agent_id && room?.counterparty_name && room?.counterparty_id === deal.locked_agent_id) {
         counterparty = room.counterparty_name;
       }

       return {
         id: deal.id, deal_id: deal.id, room_id: room?.id || null,
         title: deal.title, property_address: deal.property_address,
         city: deal.city, state: deal.state, budget: deal.purchase_price,
         estimated_list_price: deal.estimated_list_price || null,
         pipeline_stage: isSigned ? normalizeStage(deal.pipeline_stage || 'connected_deals') : normalizeStage(deal.pipeline_stage || 'new_deals'),
         customer_name: counterparty,
         agent_request_status: room?.request_status,
         agreement_status: room?.agreement_status,
         created_date: deal.created_date, updated_date: deal.updated_date,
         closing_date: deal.key_dates?.closing_date,
         is_fully_signed: isSigned, is_orphan: !hasAgent,
         locked_agent_id: deal.locked_agent_id, locked_room_id: deal.locked_room_id,
         investor_id: room?.investorId || deal.investor_id,
         seller_name: deal.seller_info?.seller_name,
          selected_agent_ids: deal.selected_agent_ids,
           documents: deal.documents || null,
           list_price_confirmed: deal.list_price_confirmed || false,
           walkthrough_scheduled: deal.walkthrough_scheduled,
          walkthrough_slots: deal.walkthrough_slots,
          walkthrough_date: deal.walkthrough_date,
          walkthrough_time: deal.walkthrough_time,
         proposed_terms: (() => {
           // Only merge agent-specific counter terms after an agent has signed the agreement
           const base = room?.proposed_terms || deal.proposed_terms || {};
           const agentHasSigned = room?.agreement_status === 'agent_signed' || room?.agreement_status === 'fully_signed' || isSigned;
           if (!agentHasSigned) return base;
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
         agreement_exhibit_a_terms: deal.agreement_exhibit_a_terms || room?.agreement?.exhibit_a_terms || null,
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

  const [navigating, setNavigating] = useState(false);
  const handleDealClick = async (deal) => {
    if (deal.room_id) {
      navigate(`${createPageUrl("Room")}?roomId=${deal.room_id}`);
      return;
    }
    // Fallback: find room via DealInvite (faster for agents) or Room filter
    setNavigating(true);
    try {
      if (isAgent && profile?.id) {
        const invites = await base44.entities.DealInvite.filter({ deal_id: deal.deal_id, agent_profile_id: profile.id });
        const invite = invites?.find(i => i.room_id && i.status !== 'VOIDED' && i.status !== 'EXPIRED');
        if (invite?.room_id) { navigate(`${createPageUrl("Room")}?roomId=${invite.room_id}`); return; }
      }
      const roomArr = await base44.entities.Room.filter({ deal_id: deal.deal_id });
      if (roomArr?.length) navigate(`${createPageUrl("Room")}?roomId=${roomArr[0].id}`);
      else toast.error('Room not ready yet. Please try again in a moment.');
    } finally {
      setNavigating(false);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const newStage = normalizeStage(result.destination.droppableId);
    const draggedDeal = deals.find(d => d.id === result.draggableId);
    if (!draggedDeal) return;
    
    const currentStage = normalizeStage(draggedDeal.pipeline_stage);
    
    // Block moving back to new_deals from connected_deals or beyond
    if (currentStage !== 'new_deals' && newStage === 'new_deals') {
      toast.error("Cannot move deal back to New Deals");
      return;
    }
    
    // Block moving out of new_deals unless agreement is fully signed
    if (currentStage === 'new_deals' && !draggedDeal.is_fully_signed) {
      toast.error("Agreement must be fully signed before moving this deal forward.");
      return;
    }
    
    // Block moving to connected_deals or beyond unless agreement is fully signed
    if (!draggedDeal.is_fully_signed && stageOrder(newStage) >= stageOrder('connected_deals')) {
      toast.error("Agreement must be fully signed before moving this deal forward.");
      return;
    }
    
    // Skip if dropped in same stage
    if (currentStage === newStage) return;
    
    await base44.entities.Deal.update(result.draggableId, { pipeline_stage: newStage });
    refetchDeals();
  };

  const pipelineStages = useMemo(() => PIPELINE_STAGES.filter(s => s.id !== 'canceled').map(s => ({
    ...s,
    icon: s.id === 'new_deals' ? FileText : s.id === 'connected_deals' ? CheckCircle : s.id === 'active_listings' ? TrendingUp : s.id === 'in_closing' ? Clock : CheckCircle,
    label: s.id === 'completed' ? 'Completed/Canceled' : s.label
  })), []);

  const roomsLoaded = !!(rooms && rooms.length >= 0 && !loadingRooms);
  const dealsByStage = useMemo(() => {
    const m = new Map();
    pipelineStages.forEach(s => m.set(s.id, []));
    deals.forEach(d => { const stage = d.pipeline_stage === 'canceled' ? 'completed' : d.pipeline_stage; (m.get(stage) || m.get('new_deals')).push(d); });
    return m;
  }, [deals]);

  // Load walkthrough statuses for all deals
  const dealIds = useMemo(() => deals.map(d => d.deal_id).filter(Boolean), [deals]);
  const { data: wtStatusMap = {} } = useQuery({
    queryKey: ['wtStatuses', dealIds.join(',')],
    staleTime: 10_000,
    queryFn: async () => {
      if (!dealIds.length) return {};
      const appts = await base44.entities.DealAppointments.filter({});
      const map = {};
      appts.forEach(a => { if (a.dealId && a.walkthrough?.status) map[a.dealId] = { status: a.walkthrough.status, updatedBy: a.walkthrough.updatedByUserId || null }; });
      return map;
    },
    enabled: dealIds.length > 0,
  });

  const getDaysInPipeline = (d) => { if (!d) return 'N/A'; return `${Math.floor((new Date() - new Date(d)) / 86400000)}d`; };

  if (loading || !profile || !ready || loadingDeals || loadingRooms) {
    return <div className="min-h-screen bg-transparent flex flex-col"><Header profile={profile} /><div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" /></div></div>;
  }

  // Setup check — admins always considered fully set up
  const setupDone = isAdmin || (isInvestor ? (!!profile.onboarding_completed_at && !!profile.nda_accepted) : (!!profile.onboarding_completed_at && !!profile.nda_accepted && (profile.identity_status === 'approved' || profile.identity_status === 'verified')));

  const pipelineBgUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/7f8a615de_1293AC3B-9FDA-4A13-BB91-671E9D0D7B14.png";
  // Pipeline uses same bg as Layout — the fixed bg in Layout already covers this page.
  // We skip the per-page bg layer so it doesn't double up.

  return (
    <>
      <Header profile={profile} />
      <div className="h-screen flex flex-col pt-4 relative">
        {/* Background handled by global Layout */}

        <div className="flex-1 overflow-auto px-6 md:px-8 pb-8 relative z-[1]">
          <div className="max-w-[1800px] mx-auto">
            {!setupDone && <div className="mb-8"><SetupChecklist profile={profile} /></div>}

            <div className="flex items-center justify-between mb-10">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#E3C567]" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>Dashboard</h1>
                <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em' }}>Manage your deals</p>
              </div>
              <div className="flex items-center gap-3">
                <NotificationBell />
                {isInvestor && <Button onClick={() => { try { sessionStorage.removeItem('newDealDraft'); } catch (_) {} navigate(createPageUrl("NewDeal")); }} className="bg-[#E3C567] text-black hover:bg-[#EDD89F] rounded-[14px] shadow-md transition-all duration-200 hover:-translate-y-0.5"><Plus className="w-4 h-4 mr-2" />New Deal</Button>}
                <Button onClick={() => setHelpOpen(true)} className="rounded-[14px] border transition-all duration-200 hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg, #17171B, #111114)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.80)' }}>Tutorials</Button>
              </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-7 mb-10">
                {pipelineStages.map(stage => {
                  const stageDeals = dealsByStage.get(stage.id) || [];
                  const Icon = stage.icon;
                  return (
                    <div
                      key={stage.id}
                      className="flex flex-col md:h-[420px] rounded-[16px] overflow-hidden min-h-0"
                      style={{
                        background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.60)',
                      }}
                    >
                      {/* Subtle accent top line */}
                      <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(201,162,39,0.5), rgba(245,208,111,0.3), transparent)' }} />
                      <div className="p-5 flex flex-col flex-1 min-h-0">
                        <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(227,197,103,0.10)' }}>
                            <Icon className="w-4 h-4 text-[#E3C567]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.90)' }}>{stage.label}</h3>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>{stageDeals.length} deals</p>
                          </div>
                        </div>
                        <Droppable droppableId={stage.id}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 overflow-y-auto space-y-3 pr-1 ${snapshot.isDraggingOver ? 'bg-[#E7C873]/5 rounded-lg' : ''}`} style={{ overscrollBehavior: 'contain', minHeight: 0 }}
                              onWheel={e => { const el = e.currentTarget; if (el.scrollHeight > el.clientHeight) { e.stopPropagation(); } }}>
                              {stageDeals.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                  {snapshot.isDraggingOver ? 'Drop here' : 'No deals'}
                                </div>
                              ) : stageDeals.map((deal, index) => (
                                <Draggable key={deal.id} draggableId={deal.id} index={index} isDragDisabled={stage.id === 'new_deals' || (!deal.is_fully_signed && stage.id === 'new_deals')}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="rounded-[14px] p-4 transition-all duration-200"
                                      style={{
                                        ...provided.draggableProps.style,
                                        background: snapshot.isDragging ? 'linear-gradient(180deg, #1E1E24 0%, #18181C 100%)' : 'linear-gradient(180deg, #151518 0%, #111114 100%)',
                                        border: snapshot.isDragging ? '1px solid rgba(227,197,103,0.25)' : '1px solid rgba(255,255,255,0.06)',
                                        boxShadow: snapshot.isDragging ? '0 14px 40px rgba(0,0,0,0.70), 0 0 0 1px rgba(227,197,103,0.2)' : '0 4px 16px rgba(0,0,0,0.40)',
                                        transform: snapshot.isDragging ? (provided.draggableProps.style?.transform || '') : (provided.draggableProps.style?.transform || ''),
                                      }}
                                      onMouseEnter={e => { if (!snapshot.isDragging) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.70)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}}
                                      onMouseLeave={e => { if (!snapshot.isDragging) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.40)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}}
                                    >
                                     <div className="space-y-3">
                                       <div>
                                         <div className="flex justify-between items-start mb-2 gap-2">
                                           <h4 className="font-semibold text-sm line-clamp-2" style={{ color: 'rgba(255,255,255,0.92)' }}>{isAgent && !deal.is_fully_signed ? `${deal.city}, ${deal.state}` : deal.property_address}</h4>
                                           <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.42)' }}>{getDaysInPipeline(deal.created_date)}</span>
                                         </div>
                                         <div className="flex flex-col gap-2 mb-3">
                                           <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}><Home className="w-3 h-3" />{deal.city}, {deal.state}</div>
                                           {isAgent
                                             ? (deal.estimated_list_price > 0 && <div className="text-xs text-[#2D8A6E] font-semibold">${deal.estimated_list_price.toLocaleString()}</div>)
                                             : (deal.budget > 0 && <div className="text-xs text-[#2D8A6E] font-semibold">${deal.budget.toLocaleString()}</div>)
                                           }
                                           {(() => {
                                             const exhibitTerms = deal.agreement_exhibit_a_terms || deal.agreement?.exhibit_a_terms || null;
                                             const comp = getSellerCompLabel(exhibitTerms, deal.proposed_terms);
                                             return comp ? <div className="text-xs text-[#E3C567] font-semibold">Agent Comp: {comp}</div> : null;
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
                                           {deal.customer_name && !deal.is_orphan && <div className="text-xs text-[#2D8A6E] flex items-center gap-1"><CheckCircle className="w-3 h-3" />{deal.customer_name}</div>}
                                         </div>
                                       </div>
                                       {(() => {
                                         const wtInfo = wtStatusMap[deal.deal_id] || null;
                                         const step = getDealNextStepLabel({ deal, isAgent, isInvestor, wtStatus: wtInfo?.status || wtInfo || null, wtProposedByProfileId: wtInfo?.updatedBy || null, myProfileId: profile?.id });
                                         if (!step) return null;
                                         return (
                                           <div className="flex items-center justify-between rounded-lg p-2" style={{ background: 'rgba(10,10,14,0.60)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                             <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.42)' }}>Next Steps</span>
                                             <span className={`text-xs font-semibold ${step.color}`}>{step.label}</span>
                                           </div>
                                         );
                                       })()}
                                       {(stage.id === 'completed' && (deal.pipeline_stage === 'completed' || deal.pipeline_stage === 'canceled')) && isInvestor && (
                                         <InlineReviewForm 
                                           dealId={deal.deal_id} 
                                           agentProfileId={deal.locked_agent_id || deal.room_agent_ids?.[0]}
                                           reviewerProfileId={profile?.id}
                                           onSubmitted={() => {}}
                                           compact={true}
                                         />
                                       )}
                                       {(stage.id === 'completed' && (deal.pipeline_stage === 'completed' || deal.pipeline_stage === 'canceled')) && isAgent && deal.investor_id && (
                                         <InlineAgentReviewForm 
                                           dealId={deal.deal_id}
                                           investorProfileId={deal.investor_id}
                                           reviewerProfileId={profile?.id}
                                           onSubmitted={() => {}}
                                           compact={true}
                                         />
                                       )}
                                     </div>
                                     <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                      <Button onClick={e => { e.stopPropagation(); handleDealClick(deal); }} size="sm" disabled={navigating} className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-[12px] text-xs py-1.5 h-auto shadow-sm transition-all duration-200 hover:-translate-y-0.5">{navigating ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Loading...</> : 'Open Deal Room'}</Button>
                                      {isInvestor && normalizeStage(deal.pipeline_stage) === 'new_deals' && <Button onClick={e => { e.stopPropagation(); sessionStorage.removeItem('newDealDraft'); navigate(`${createPageUrl("NewDeal")}?dealId=${deal.deal_id}`); }} size="sm" className="flex-1 rounded-[12px] text-xs py-1.5 h-auto transition-all duration-200 hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg, #17171B, #111114)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.80)' }}>Edit</Button>}
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
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
            <LegalFooterLinks />
          </div>
        </div>
      </div>
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} userRole={profile?.user_role} />
    </>
  );
}

export default function Pipeline() {
  return <AuthGuard requireAuth={true}><PipelineContent /></AuthGuard>;
}
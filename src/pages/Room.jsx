import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useRooms } from "@/components/useRooms";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Menu, Send, ArrowLeft, FileText, Shield, User, Users, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";

import { PIPELINE_STAGES, normalizeStage } from "@/components/pipelineStages";
import { getSellerCompLabel } from "@/components/utils/dealCompDisplay";
import RoomSidebar from "@/components/room/RoomSidebar";
import DealBoard from "@/components/room/DealBoard";
import SimpleMessageBoard from "@/components/chat/SimpleMessageBoard";
import PendingAgentsList from "@/components/PendingAgentsList";
import CounterpartyInfoBar from "@/components/room/CounterpartyInfoBar";
import WalkthroughScheduleModal from "@/components/room/WalkthroughScheduleModal";

export default function Room() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const roomId = params.get("roomId");
  const { profile, user, loading, onboarded, hasNDA, isPaidSubscriber, kycVerified } = useCurrentProfile();
  const { data: rooms = [] } = useRooms();
  const queryClient = useQueryClient();

  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState("");
  // activeView: 'board' | 'messages' | 'pending_agents'
  const [activeView, setActiveView] = useState('messages');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [deal, setDeal] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [walkthroughModalOpen, setWalkthroughModalOpen] = useState(false);
  const [hasWalkthroughAppt, setHasWalkthroughAppt] = useState(false);
  // Track which views have been mounted so they stay alive
  const [mountedViews, setMountedViews] = useState(new Set(['messages']));

  // Gating - redirect if not setup
  const gateChecked = useRef(false);
  useEffect(() => {
    if (loading || gateChecked.current) return;
    gateChecked.current = true;
    if (!profile || !onboarded) { navigate(createPageUrl("PostAuth"), { replace: true }); return; }
    if (profile.user_role === 'investor' && !isPaidSubscriber) { navigate(createPageUrl("Pricing"), { replace: true }); return; }
    if (!kycVerified) { navigate(createPageUrl("IdentityVerification"), { replace: true }); return; }
    if (!hasNDA) { navigate(createPageUrl("NDA"), { replace: true }); return; }
  }, [loading]);

  const isAgent = profile?.user_role === 'agent';
  const isInvestor = profile?.user_role === 'investor';
  const isSigned = currentRoom?.is_fully_signed || currentRoom?.agreement_status === 'fully_signed' || currentRoom?.request_status === 'locked' || deal?.is_fully_signed;
  const isChatEnabled = isSigned;

  // Keep views mounted once activated
  useEffect(() => {
    setMountedViews(prev => {
      if (prev.has(activeView)) return prev;
      const next = new Set(prev);
      next.add(activeView);
      return next;
    });
  }, [activeView]);

  // Load room + deal when roomId changes
  useEffect(() => {
    if (!roomId) { setRoomLoading(false); return; }

    // --- Phase 0: Instant render from enriched rooms cache ---
    const enrichedRoom = rooms?.find(r => r.id === roomId);
    const cachedIsSigned = enrichedRoom?.is_fully_signed || false;

    // Pick the right default view BEFORE any async work
    let defaultView;
    if (cachedIsSigned) {
      defaultView = 'messages';
    } else if (isAgent) {
      defaultView = 'board';
    } else {
      defaultView = 'pending_agents';
    }
    setActiveView(defaultView);
    setMountedViews(new Set([defaultView]));
    setPendingInvites([]);
    setSelectedInvite(null);

    // If we have enriched data, show it immediately (no blank screen)
    if (enrichedRoom) {
      setCurrentRoom(prev => {
        // Don't overwrite with less data if we already have richer data for this room
        if (prev?.id === roomId && prev?.investor_contact) return prev;
        return {
          id: enrichedRoom.id,
          deal_id: enrichedRoom.deal_id,
          title: enrichedRoom.title,
          property_address: enrichedRoom.property_address,
          city: enrichedRoom.city,
          state: enrichedRoom.state,
          budget: enrichedRoom.budget || 0,
          is_fully_signed: cachedIsSigned,
          request_status: enrichedRoom.request_status,
          agreement_status: enrichedRoom.agreement_status,
          counterparty_name: enrichedRoom.counterparty_name || (isAgent ? 'Investor' : 'Agent'),
          counterparty_headshot: enrichedRoom.counterparty_headshot || null,
          investorId: enrichedRoom.investorId,
          agent_ids: enrichedRoom.agent_ids || [],
          locked_agent_id: enrichedRoom.agentId || null,
          proposed_terms: enrichedRoom.proposed_terms || null,
          agent_terms: enrichedRoom.agent_terms || null,
          files: enrichedRoom.files || [],
          photos: enrichedRoom.photos || [],
        };
      });
      setRoomLoading(false); // Show UI immediately
    } else {
      setCurrentRoom(null);
      setDeal(null);
      setRoomLoading(true);
    }

    // --- Phase 1: Parallel fetch of full room + deal details ---
    const load = async () => {
      try {
        const dealId = enrichedRoom?.deal_id;

        // Fire all fetches in parallel — don't waterfall
        const roomPromise = base44.entities.Room.filter({ id: roomId }).then(arr => arr?.[0]);
        const dealPromise = dealId
          ? base44.functions.invoke('getDealDetailsForUser', { dealId }).then(r => r?.data).catch(() => null)
          : Promise.resolve(null);

        const [room, dealData] = await Promise.all([roomPromise, dealPromise]);
        if (!room) { setRoomLoading(false); return; }

        const roomIsLocked = room.agreement_status === 'fully_signed' || room.request_status === 'locked' || !!room.locked_agent_id;
        const resolvedIsSigned = dealData?.is_fully_signed || roomIsLocked;

        // If signing status changed from cache, update view
        if (resolvedIsSigned && defaultView !== 'messages') {
          setActiveView('messages');
          setMountedViews(prev => { const n = new Set(prev); n.add('messages'); return n; });
        }

        setCurrentRoom({
          ...room,
          title: (isAgent && !roomIsLocked) ? `${room.city || dealData?.city || 'City'}, ${room.state || dealData?.state || 'State'}` : (dealData?.title || room.title),
          property_address: (isAgent && dealData?.property_address === null && !roomIsLocked) ? null : (dealData?.property_address || room.property_address),
          city: dealData?.city || room.city,
          state: dealData?.state || room.state,
          budget: dealData?.purchase_price || room.budget,
          is_fully_signed: resolvedIsSigned,
          counterparty_name: enrichedRoom?.counterparty_name || room.counterparty_name || (isAgent ? (dealData?.investor_full_name || 'Investor') : (dealData?.agent_full_name || 'Agent')),
          counterparty_headshot: enrichedRoom?.counterparty_headshot || (isAgent ? dealData?.investor_contact?.headshotUrl : dealData?.agent_contact?.headshotUrl) || null,
          investor_contact: dealData?.investor_contact || null,
          agent_contact: dealData?.agent_contact || null,
          agent_terms: room.agent_terms || dealData?.room?.agent_terms || null,
          agent_ids: room.agent_ids || dealData?.room?.agent_ids || [],
          investorId: room.investorId,
          locked_agent_id: room.locked_agent_id,
        });
        if (dealData) setDeal(dealData);
        setRoomLoading(false);

        // --- Phase 2: Fetch invites in background (non-blocking) ---
        if (isInvestor && room.deal_id && !roomIsLocked) {
          base44.entities.DealInvite.filter({ deal_id: room.deal_id }).then(async (rawInvites) => {
            const activeInvites = (rawInvites || []).filter(i => i.status !== 'VOIDED' && i.status !== 'EXPIRED' && i.status !== 'LOCKED');
            if (activeInvites.length === 0) return;
            // Batch-fetch all agent profiles at once instead of one-by-one
            const agentIds = activeInvites.map(i => i.agent_profile_id).filter(Boolean);
            const agentProfiles = agentIds.length > 0
              ? await base44.entities.Profile.filter({ id: { $in: agentIds } }).catch(() => [])
              : [];
            const profileMap = new Map(agentProfiles.map(p => [p.id, p]));
            const enriched = activeInvites.map(inv => {
              const agent = profileMap.get(inv.agent_profile_id);
              return {
                ...inv,
                agent: agent ? { id: agent.id, full_name: agent.full_name, brokerage: agent.agent?.brokerage, rating: null, completed_deals: agent.agent?.investment_deals_last_12m } : { id: inv.agent_profile_id, full_name: 'Agent' },
                agreement_status: room.agent_agreement_status?.[inv.agent_profile_id] || 'sent'
              };
            });
            setPendingInvites(enriched);
          }).catch(() => {});
        }
      } catch (e) { console.error('[Room] Load error:', e); setRoomLoading(false); }
    };
    load();
  }, [roomId, profile?.user_role, rooms]);

  // Open agreement tab from URL
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'agreement') setActiveView('board');
  }, [roomId, location.search]);

  // Post-signing refresh
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('signed') === '1' && roomId) {
      const refresh = async () => {
        await new Promise(r => setTimeout(r, 1500));
        const [roomArr, dealRes] = await Promise.all([
          base44.entities.Room.filter({ id: roomId }).catch(() => []),
          currentRoom?.deal_id ? base44.functions.invoke('getDealDetailsForUser', { dealId: currentRoom.deal_id }).catch(() => ({})) : Promise.resolve({})
        ]);
        if (roomArr?.[0]) setCurrentRoom(prev => ({ ...prev, ...roomArr[0] }));
        if (dealRes?.data) setDeal(dealRes.data);
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
      };
      refresh();
    }
  }, [location.search, roomId]);

  // Sync counterparty headshot from enriched rooms when they load
  useEffect(() => {
    if (!roomId || !rooms?.length) return;
    const enriched = rooms.find(r => r.id === roomId);
    if (enriched?.counterparty_headshot) {
      setCurrentRoom(prev => prev ? { ...prev, counterparty_headshot: enriched.counterparty_headshot, counterparty_name: enriched.counterparty_name || prev.counterparty_name } : prev);
    }
  }, [roomId, rooms]);

  // Real-time room updates
  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.Room.subscribe(e => {
      if (e?.data?.id === roomId) {
        const updated = e.data;
        setCurrentRoom(prev => {
          const merged = prev ? { ...prev, ...updated } : updated;
          // Derive is_fully_signed from real-time data
          if (updated.agreement_status === 'fully_signed' || updated.request_status === 'locked') {
            merged.is_fully_signed = true;
          }
          return merged;
        });
        // If room just became locked, clear pending agents
        if (updated.request_status === 'locked' || updated.agreement_status === 'fully_signed') {
          setPendingInvites([]);
          if (activeView === 'pending_agents') setActiveView('messages');
        }
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId]);

  // Real-time deal updates (e.g. walkthrough confirmed in chat)
  useEffect(() => {
    if (!deal?.id) return;
    const unsub = base44.entities.Deal.subscribe(e => {
      if (e?.data?.id === deal.id) {
        // Re-fetch deal from server to get full documents (subscription events may not include all fields)
        base44.functions.invoke('getDealDetailsForUser', { dealId: deal.id })
          .then(res => {
            if (res?.data) {
              setDeal(prev => {
                if (!prev) return res.data;
                // Always merge: server data + any local docs we already have
                const mergedDocs = { ...(prev.documents || {}), ...(res.data.documents || {}) };
                return { ...prev, ...res.data, documents: mergedDocs };
              });
            }
          })
          .catch(() => {
            // Fallback: merge event data preserving existing documents
            setDeal(prev => {
              if (!prev) return e.data;
              const merged = { ...prev, ...e.data };
              if (prev.documents) {
                merged.documents = { ...prev.documents, ...(e.data.documents || {}) };
              }
              return merged;
            });
          });
        if (e?.data?.walkthrough_scheduled) setHasWalkthroughAppt(true);
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  // Check if walkthrough is scheduled from deal fields
  useEffect(() => {
    if (!deal?.id) return;
    if (deal?.walkthrough_scheduled && (deal?.walkthrough_date || deal?.walkthrough_time)) {
      setHasWalkthroughAppt(true);
    }
  }, [deal?.id, deal?.walkthrough_scheduled, deal?.walkthrough_date, deal?.walkthrough_time]);

  const counterpartName = useMemo(() => {
    if (isAgent) return deal?.investor_full_name || currentRoom?.counterparty_name || 'Investor';
    if (isSigned) return deal?.agent_full_name || currentRoom?.counterparty_name || 'Agent';
    return 'Agent';
  }, [isSigned, isAgent, deal, currentRoom]);

  // Compute seller agent comp label from agreement exhibit_a_terms (same source as KeyTermsPanel)
  const roomSellerComp = useMemo(() => {
    const enrichedRoom = rooms?.find(r => r.id === roomId);
    const exhibitTerms = enrichedRoom?.agreement?.exhibit_a_terms || null;
    const proposedTerms = currentRoom?.proposed_terms || enrichedRoom?.proposed_terms || deal?.proposed_terms || null;
    return getSellerCompLabel(exhibitTerms, proposedTerms);
  }, [rooms, roomId, currentRoom?.proposed_terms, deal?.proposed_terms]);

  const filteredRooms = useMemo(() => {
    return (rooms || []).filter(r => r?.deal_id);
  }, [rooms]);

  return (
    <div className="fixed inset-0 bg-transparent flex overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-[320px] bg-[#0D0D0D] border-r border-[#1F1F1F] z-40 transform transition-transform shadow-xl ${drawer ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 flex flex-col`}>
        <RoomSidebar
          rooms={filteredRooms}
          activeRoomId={roomId}
          userRole={profile?.user_role}
          search={search}
          onSearchChange={setSearch}
          onRoomClick={(r) => {
            setCurrentRoom({ id: r.id, city: r.city, state: r.state, budget: r.budget, is_fully_signed: r.is_fully_signed });
            setDeal(null);
            navigate(`${createPageUrl("Room")}?roomId=${r.id}`);
            setDrawer(false);
          }}
        />
      </div>

      {/* Main Area */}
      <div className="flex-1 md:ml-[320px] flex flex-col bg-black overflow-hidden">
        {/* Header */}
        <div className="h-18 border-b border-[#1F1F1F] flex items-center px-5 bg-[#0D0D0D] shadow-sm flex-shrink-0 z-10">
          <button className="mr-4 md:hidden text-[#808080]" onClick={() => setDrawer(s => !s)}><Menu className="w-6 h-6" /></button>
          <Button onClick={() => { queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] }); navigate(createPageUrl("Pipeline")); }} className="mr-4 bg-[#0D0D0D] border border-[#1F1F1F] hover:border-[#E3C567] hover:bg-[#0D0D0D] text-[#FAFAFA] rounded-full">
            <ArrowLeft className="w-4 h-4" /><span className="hidden md:inline ml-2">Pipeline</span>
          </Button>
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#E3C567]/20 flex items-center justify-center mr-4">
            {currentRoom?.counterparty_headshot ? (
              <img src={currentRoom.counterparty_headshot} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-[#E3C567]" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#FAFAFA]">{(isSigned || isAgent) ? counterpartName : 'Agent'}</h2>
            <div className="flex items-center gap-3">
              {isSigned ? (
                <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">✓ Working Together</span>
              ) : (
                <span className="bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 px-3 py-1 rounded-full text-xs font-medium">Awaiting Signatures</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {roomId && (
              <>
                <Button
                  onClick={() => { if (isInvestor && !isSigned && pendingInvites.length > 0 && !selectedInvite) return; setActiveView('board'); }}
                  disabled={isInvestor && !isSigned && pendingInvites.length > 0 && !selectedInvite}
                  title={isInvestor && !isSigned && pendingInvites.length > 0 && !selectedInvite ? "Select an agent first" : ""}
                  className={`rounded-full font-semibold ${activeView === 'board' ? "bg-[#E3C567] text-black" : "bg-[#1F1F1F] text-[#FAFAFA]"}`}
                >
                  <FileText className="w-4 h-4 mr-2" />Deal Board
                </Button>
                {isInvestor && pendingInvites.length > 0 && !isSigned && (
                  <Button onClick={() => setActiveView('pending_agents')} className={`rounded-full font-semibold ${activeView === 'pending_agents' ? "bg-[#E3C567] text-black" : "bg-[#1F1F1F] text-[#FAFAFA]"}`}>
                    <Users className="w-4 h-4 mr-2" />Pending Agents ({pendingInvites.length})
                  </Button>
                )}
                {isSigned && (
                  <Button onClick={() => setActiveView('messages')} className={`rounded-full font-semibold ${activeView === 'messages' ? "bg-[#E3C567] text-black" : "bg-[#1F1F1F] text-[#FAFAFA]"}`}>
                    <Send className="w-4 h-4 mr-2" />Messages
                  </Button>
                )}
                {isInvestor && isSigned && (currentRoom?.locked_agent_id || currentRoom?.agent_ids?.length > 0) && (
                  <Button
                    onClick={() => {
                      const agentId = currentRoom.locked_agent_id || currentRoom.agent_ids?.[0];
                      if (agentId) navigate(`${createPageUrl("AgentProfile")}?profileId=${agentId}`);
                    }}
                    className="rounded-full font-semibold bg-[#1F1F1F] text-[#FAFAFA]"
                  >
                    <User className="w-4 h-4 mr-2" />Agent Profile
                  </Button>
                )}
                {isAgent && currentRoom?.investorId && (
                  <Button
                    onClick={() => navigate(`${createPageUrl("InvestorProfile")}?profileId=${currentRoom.investorId}`)}
                    className="rounded-full font-semibold bg-[#1F1F1F] text-[#FAFAFA]"
                  >
                    <User className="w-4 h-4 mr-2" />Investor Profile
                  </Button>
                )}
              </>
            )}
          </div>
        </div>



        {/* Deal Summary Bar (messages view only) */}
        {activeView === 'messages' && currentRoom && !roomLoading && (
          <>
            {(isSigned || isAgent) && (
              <CounterpartyInfoBar
                counterparty={isInvestor
                  ? { ...deal?.agent_contact, name: deal?.agent_full_name }
                  : { ...deal?.investor_contact, name: deal?.investor_full_name }
                }
              />
            )}
            <div className="bg-[#111111] border-b border-[#1F1F1F] py-3 px-6 flex items-center justify-center gap-4 flex-shrink-0">
              {isInvestor && isSigned && deal?.id && !hasWalkthroughAppt && normalizeStage(deal?.pipeline_stage) === 'connected_deals' && (
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E3C567] hover:text-[#EDD89F] transition-colors group border border-[#E3C567]/30 rounded-full px-3 py-1.5"
                  onClick={(e) => { e.stopPropagation(); setWalkthroughModalOpen(true); }}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule Walk-through
                </button>
              )}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${isSigned ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
                  <span className="font-bold text-[#FAFAFA] text-sm">
                    {isAgent && !isSigned ? `${currentRoom.city || 'City'}, ${currentRoom.state || 'State'}` : (currentRoom.title || currentRoom.property_address || 'Deal')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-[#CCC]">{[currentRoom.city, currentRoom.state].filter(Boolean).join(', ')}</span>
                  {currentRoom.budget > 0 && <><span className="text-[#333]">|</span><span className="text-[#34D399] font-mono">${currentRoom.budget.toLocaleString()}</span></>}
                  {isSigned && roomSellerComp && <><span className="text-[#333]">|</span><span className="text-[#E3C567] font-semibold">Agent Comp: {roomSellerComp}</span></>}
                </div>
              </div>
              {isInvestor && isSigned && deal?.id && !['active_listings', 'in_closing', 'completed'].includes(normalizeStage(deal.pipeline_stage)) && (
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#10B981] hover:text-[#34D399] transition-colors group border border-[#10B981]/30 rounded-full px-3 py-1.5"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const dealIdVal = deal.id;
                    setDeal(prev => prev ? { ...prev, pipeline_stage: 'active_listings' } : prev);
                    try {
                      await base44.functions.invoke('updateDealDocuments', { dealId: dealIdVal, pipeline_stage: 'active_listings' });
                      queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
                      toast.success('Moved to Active Listings');
                    } catch (err) {
                      setDeal(prev => prev ? { ...prev, pipeline_stage: deal.pipeline_stage } : prev);
                      toast.error("Failed to update stage");
                    }
                  }}
                >
                  Has this agreement been listed?
                  <CheckCircle2 className="w-4 h-4 group-hover:scale-125 transition-transform" />
                </button>
              )}
            </div>
          </>
        )}

        {/* Content — keep views mounted once activated to avoid re-fetching */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          {/* Deal Board */}
          {mountedViews.has('board') && (
            <div style={{ display: activeView === 'board' ? 'block' : 'none' }}>
              <DealBoard
                deal={deal}
                room={currentRoom}
                profile={profile}
                roomId={roomId}
                selectedAgentProfileId={selectedInvite?.agent_profile_id}
                onInvestorSigned={async () => {
                  if (!currentRoom?.deal_id) return;
                  try {
                    await base44.functions.invoke('createInvitesAfterInvestorSign', { deal_id: currentRoom.deal_id });
                    queryClient.invalidateQueries({ queryKey: ['rooms'] });
                  } catch (e) { console.error('[Room] Invite creation failed:', e); }
                }}
              />
            </div>
          )}

          {/* Pending Agents */}
          {activeView === 'pending_agents' && isInvestor && pendingInvites.length > 0 && !isSigned && (
            <PendingAgentsList
              invites={pendingInvites}
              selectedInviteId={selectedInvite?.id}
              onSelectAgent={(invite) => {
                setSelectedInvite(invite);
                setActiveView('board');
              }}
            />
          )}

          {/* Messages */}
          {mountedViews.has('messages') && (
            <div className="max-w-4xl mx-auto w-full h-full flex flex-col" style={{ display: activeView === 'messages' ? 'flex' : 'none' }}>
              {/* Signing banners */}
              {isAgent && !isSigned && (currentRoom?.agreement_status === 'investor_signed' || deal?.is_fully_signed === false) && (
                <div className="mb-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5 flex items-start justify-between gap-3 flex-shrink-0">
                  <div className="flex items-start gap-3"><Shield className="w-5 h-5 text-[#60A5FA] mt-0.5" /><div><h3 className="text-md font-bold text-[#60A5FA] mb-1">Review & Sign</h3><p className="text-sm text-[#FAFAFA]/80">Investor has signed. Review terms and sign to lock in.</p></div></div>
                  <Button onClick={() => setActiveView('board')} className="bg-[#E3C567] text-black rounded-full font-semibold">My Agreement</Button>
                </div>
              )}
              {isInvestor && !isSigned && (
                <div className="mb-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5 flex items-start justify-between gap-3 flex-shrink-0">
                  <div className="flex items-start gap-3"><Shield className="w-5 h-5 text-[#60A5FA] mt-0.5" /><div><h3 className="text-md font-bold text-[#60A5FA] mb-1">Review & Sign</h3><p className="text-sm text-[#FAFAFA]/80">Open My Agreement to review and sign.</p></div></div>
                  <Button onClick={() => setActiveView('board')} className="bg-[#E3C567] text-black rounded-full font-semibold">My Agreement</Button>
                </div>
              )}

              <SimpleMessageBoard roomId={roomId} profile={profile} user={user} isChatEnabled={isChatEnabled} isSigned={isSigned} dealId={deal?.id} />
              <WalkthroughScheduleModal
                open={walkthroughModalOpen}
                onOpenChange={setWalkthroughModalOpen}
                deal={deal}
                roomId={roomId}
                profile={profile}
                onScheduled={(updates) => setDeal(prev => prev ? { ...prev, ...updates } : prev)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
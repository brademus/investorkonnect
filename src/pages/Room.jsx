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
import RoomSidebar from "@/components/room/RoomSidebar";
import DealBoard from "@/components/room/DealBoard";
import SimpleMessageBoard from "@/components/chat/SimpleMessageBoard";
import PendingAgentsList from "@/components/PendingAgentsList";
import CounterpartyInfoBar from "@/components/room/CounterpartyInfoBar";
import WalkthroughInlineScheduler from "@/components/room/WalkthroughInlineScheduler";

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
  const [showBoard, setShowBoard] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [deal, setDeal] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [showPendingAgents, setShowPendingAgents] = useState(true); // default to showing agents for investor
  const [walkthroughExpanded, setWalkthroughExpanded] = useState(false);

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

  // Load room + deal when roomId changes
  useEffect(() => {
    if (!roomId) { setRoomLoading(false); return; }
    setShowBoard(false);
    setDeal(null);
    setCurrentRoom(null);
    setRoomLoading(true);
    setPendingInvites([]);
    setSelectedInvite(null);
    setShowPendingAgents(true);

    const load = async () => {
      try {
        const roomArr = await base44.entities.Room.filter({ id: roomId });
        const room = roomArr?.[0];
        if (!room) { setRoomLoading(false); return; }

        let dealData = null;
        if (room.deal_id) {
          try {
            const res = await base44.functions.invoke('getDealDetailsForUser', { dealId: room.deal_id });
            dealData = res?.data;
          } catch (_) {}
        }

        const roomIsLocked = room.agreement_status === 'fully_signed' || room.request_status === 'locked' || !!room.locked_agent_id;
        setCurrentRoom({
          ...room,
          title: (isAgent && !roomIsLocked) ? `${room.city || dealData?.city || 'City'}, ${room.state || dealData?.state || 'State'}` : (dealData?.title || room.title),
          property_address: (isAgent && dealData?.property_address === null && !roomIsLocked) ? null : (dealData?.property_address || room.property_address),
          city: dealData?.city || room.city,
          state: dealData?.state || room.state,
          budget: dealData?.purchase_price || room.budget,
          is_fully_signed: dealData?.is_fully_signed || roomIsLocked,
          counterparty_name: room.counterparty_name || (isAgent ? (dealData?.investor_full_name || 'Investor') : (dealData?.agent_full_name || 'Agent'))
        });
        if (dealData) setDeal(dealData);

        // For investors: load pending agent invites (only if deal not locked)
        const isLocked = room.locked_agent_id || room.agreement_status === 'fully_signed' || room.request_status === 'locked';
        if (isInvestor && room.deal_id && !isLocked) {
          try {
            const invites = await base44.entities.DealInvite.filter({ deal_id: room.deal_id });
            const activeInvites = invites.filter(i => i.status !== 'VOIDED' && i.status !== 'EXPIRED' && i.status !== 'LOCKED');
            // Load agent profiles for each invite
            const enriched = await Promise.all(activeInvites.map(async (inv) => {
              try {
                const agentProfiles = await base44.entities.Profile.filter({ id: inv.agent_profile_id });
                const agent = agentProfiles?.[0];
                return {
                  ...inv,
                  agent: agent ? {
                    id: agent.id,
                    full_name: agent.full_name,
                    brokerage: agent.agent?.brokerage,
                    rating: null,
                    completed_deals: agent.agent?.investment_deals_last_12m
                  } : { id: inv.agent_profile_id, full_name: 'Agent' },
                  agreement_status: room.agent_agreement_status?.[inv.agent_profile_id] || 'sent'
                };
              } catch (_) {
                return { ...inv, agent: { id: inv.agent_profile_id, full_name: 'Agent' }, agreement_status: 'sent' };
              }
            }));
            setPendingInvites(enriched);
            // If deal is locked (has a winning agent), auto-select that agent and go to messages
            if (room.locked_agent_id || room.agreement_status === 'fully_signed') {
              setShowPendingAgents(false);
            }
          } catch (e) { console.error('[Room] Failed to load invites:', e); }
        }
      } catch (e) { console.error('[Room] Load error:', e); }
      finally { setRoomLoading(false); }
    };
    load();
  }, [roomId, profile?.user_role]);

  // Open agreement tab from URL
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'agreement') setShowBoard(true);
  }, [roomId, location.search]);

  // Post-signing refresh
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('signed') === '1' && roomId) {
      const refresh = async () => {
        await new Promise(r => setTimeout(r, 1500));
        const roomArr = await base44.entities.Room.filter({ id: roomId });
        if (roomArr?.[0]) setCurrentRoom(prev => ({ ...prev, ...roomArr[0] }));
        if (currentRoom?.deal_id) {
          const res = await base44.functions.invoke('getDealDetailsForUser', { dealId: currentRoom.deal_id }).catch(() => ({}));
          if (res?.data) setDeal(res.data);
        }
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
      };
      refresh();
    }
  }, [location.search, roomId]);

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
          setShowPendingAgents(false);
        }
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId]);

  const counterpartName = useMemo(() => {
    if (isSigned) return isInvestor ? (deal?.agent_full_name || currentRoom?.counterparty_name || 'Agent') : (deal?.investor_full_name || currentRoom?.counterparty_name || 'Investor');
    return isInvestor ? 'Agent' : 'Investor';
  }, [isSigned, isInvestor, deal, currentRoom]);

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
          <Button onClick={() => { queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] }); navigate(createPageUrl("Pipeline")); }} variant="outline" className="mr-4 bg-[#0D0D0D] border-[#1F1F1F] hover:border-[#E3C567] text-[#FAFAFA] rounded-full">
            <ArrowLeft className="w-4 h-4" /><span className="hidden md:inline ml-2">Pipeline</span>
          </Button>
          <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center mr-4"><User className="w-6 h-6 text-[#E3C567]" /></div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#FAFAFA]">{isSigned ? counterpartName : (isInvestor ? 'Agent' : 'Investor')}</h2>
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
                <Button onClick={() => { setShowBoard(true); setShowPendingAgents(false); }} className={`rounded-full font-semibold ${showBoard && !showPendingAgents ? "bg-[#E3C567] text-black" : "bg-[#1F1F1F] text-[#FAFAFA]"}`}>
                  <FileText className="w-4 h-4 mr-2" />Deal Board
                </Button>
                {isInvestor && pendingInvites.length > 0 && !isSigned && (
                  <Button onClick={() => { setShowBoard(false); setShowPendingAgents(true); }} className={`rounded-full font-semibold ${showPendingAgents && !showBoard ? "bg-[#E3C567] text-black" : "bg-[#1F1F1F] text-[#FAFAFA]"}`}>
                    <Users className="w-4 h-4 mr-2" />Pending Agents ({pendingInvites.length})
                  </Button>
                )}
                <Button onClick={() => { setShowBoard(false); setShowPendingAgents(false); }} className={`rounded-full font-semibold ${!showBoard && !showPendingAgents ? "bg-[#E3C567] text-black" : "bg-[#1F1F1F] text-[#FAFAFA]"}`}>
                  <Send className="w-4 h-4 mr-2" />Messages
                </Button>
              </>
            )}
          </div>
        </div>



        {/* Deal Summary Bar (messages view only) */}
        {!showBoard && currentRoom && !roomLoading && (
          <>
            <div className="bg-[#111111] border-b border-[#1F1F1F] py-3 px-6 flex items-center justify-center gap-4 flex-shrink-0">
              {isInvestor && isSigned && deal?.id && !deal?.walkthrough_scheduled && normalizeStage(deal?.pipeline_stage) === 'connected_deals' && (
                walkthroughExpanded ? (
                  <WalkthroughInlineScheduler
                    deal={deal}
                    roomId={roomId}
                    profile={profile}
                    onScheduled={(updates) => { setDeal(prev => prev ? { ...prev, ...updates } : prev); setWalkthroughExpanded(false); }}
                    onCancel={() => setWalkthroughExpanded(false)}
                  />
                ) : (
                  <button
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E3C567] hover:text-[#EDD89F] transition-colors group border border-[#E3C567]/30 rounded-full px-3 py-1.5"
                    onClick={(e) => { e.stopPropagation(); setWalkthroughExpanded(true); }}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Schedule Walk-through
                  </button>
                )
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
                </div>
              </div>
              {isInvestor && isSigned && deal?.id && !['active_listings', 'in_closing', 'completed'].includes(normalizeStage(deal.pipeline_stage)) && (
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#10B981] hover:text-[#34D399] transition-colors group border border-[#10B981]/30 rounded-full px-3 py-1.5"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const dealId = deal.id;
                    setDeal(prev => prev ? { ...prev, pipeline_stage: 'active_listings' } : prev);
                    try {
                      await base44.entities.Deal.update(dealId, { pipeline_stage: 'active_listings' });
                      queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
                      toast.success('Moved to Active Listings');
                    } catch (e) {
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
            {isSigned && (
              <CounterpartyInfoBar
                counterparty={isInvestor
                  ? { ...deal?.agent_contact, name: deal?.agent_full_name }
                  : { ...deal?.investor_contact, name: deal?.investor_full_name }
                }
              />
            )}
          </>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          {showBoard ? (
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
          ) : isInvestor && showPendingAgents && pendingInvites.length > 0 && !isSigned ? (
            <PendingAgentsList
              invites={pendingInvites}
              selectedInviteId={selectedInvite?.id}
              onSelectAgent={(invite) => {
                setSelectedInvite(invite);
                setShowBoard(true);
                setShowPendingAgents(false);
              }}
            />
          ) : (
            <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
              {/* Signing banners */}
              {isAgent && !isSigned && (currentRoom?.agreement_status === 'investor_signed' || deal?.is_fully_signed === false) && (
                <div className="mb-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5 flex items-start justify-between gap-3 flex-shrink-0">
                  <div className="flex items-start gap-3"><Shield className="w-5 h-5 text-[#60A5FA] mt-0.5" /><div><h3 className="text-md font-bold text-[#60A5FA] mb-1">Review & Sign</h3><p className="text-sm text-[#FAFAFA]/80">Investor has signed. Review terms and sign to lock in.</p></div></div>
                  <Button onClick={() => setShowBoard(true)} className="bg-[#E3C567] text-black rounded-full font-semibold">My Agreement</Button>
                </div>
              )}
              {isInvestor && !isSigned && (
                <div className="mb-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5 flex items-start justify-between gap-3 flex-shrink-0">
                  <div className="flex items-start gap-3"><Shield className="w-5 h-5 text-[#60A5FA] mt-0.5" /><div><h3 className="text-md font-bold text-[#60A5FA] mb-1">Review & Sign</h3><p className="text-sm text-[#FAFAFA]/80">Open My Agreement to review and sign.</p></div></div>
                  <Button onClick={() => setShowBoard(true)} className="bg-[#E3C567] text-black rounded-full font-semibold">My Agreement</Button>
                </div>
              )}

              <SimpleMessageBoard roomId={roomId} profile={profile} user={user} isChatEnabled={isChatEnabled} />

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
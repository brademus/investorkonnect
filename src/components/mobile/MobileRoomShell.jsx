import React, { useState } from "react";
import MobileRoomHeader from "./MobileRoomHeader";
import MobileRoomList from "./MobileRoomList";
import DealBoard from "@/components/room/DealBoard";
import SimpleMessageBoard from "@/components/chat/SimpleMessageBoard";
import PendingAgentsList from "@/components/PendingAgentsList";
import CounterpartyInfoBar from "@/components/room/CounterpartyInfoBar";
import WalkthroughScheduleModal from "@/components/room/WalkthroughScheduleModal";
import { normalizeStage } from "@/components/pipelineStages";
import { Calendar, ChevronDown, ChevronUp, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MobileRoomShell({
  roomId, currentRoom, deal, profile, user,
  isAgent, isInvestor, isSigned, isChatEnabled, roomLoading,
  pendingInvites, selectedInvite,
  hasWalkthroughAppt, walkthroughModalOpen, setWalkthroughModalOpen,
  onBack, onInvestorSigned, patchDeal, counterpartName, roomSellerComp,
  unreadMsgCount, onSelectPendingInvite,
  rooms, userRole, onSwitchRoom,
  activeTab, setActiveTab
}) {
  const showPendingAgents = isInvestor && pendingInvites.length > 1 && !isSigned;
  const segments = [];
  segments.push({ id: "board", label: "Deal Board" });
  if (showPendingAgents) segments.push({ id: "agents", label: `Agents (${pendingInvites.length})` });
  if (isSigned) segments.push({ id: "messages", label: "Messages", badge: unreadMsgCount > 0 ? unreadMsgCount : null });

  // Fallback if parent hasn't set activeTab yet, or current tab isn't in the segments list
  const currentTab = segments.some(s => s.id === activeTab) ? activeTab : "board";

  const [dealInfoOpen, setDealInfoOpen] = useState(false);
  const [roomsDrawerOpen, setRoomsDrawerOpen] = useState(false);

  return (
    <>
      <MobileRoomHeader
        currentRoom={currentRoom}
        counterpartName={counterpartName}
        isSigned={isSigned}
        isAgent={isAgent}
        onBack={onBack}
        onOpenRoomsDrawer={() => setRoomsDrawerOpen(true)}
      />

      {/* Segmented control */}
      <div className="flex gap-1 px-2 py-1.5 bg-[#0D0D0D] border-b border-[#1F1F1F] flex-shrink-0">
        {segments.map((seg) => (
          <button
            key={seg.id}
            onClick={() => setActiveTab(seg.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              currentTab === seg.id ? "bg-[#E3C567] text-black" : "bg-[#1F1F1F] text-[#FAFAFA]"
            }`}
          >
            {seg.label}
            {seg.badge && (
              <span className="min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {seg.badge > 99 ? "99+" : seg.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {/* Deal Board */}
        {currentTab === "board" && (
          <div className="px-3 py-3 flex-1">
            <DealBoard
              deal={deal}
              room={currentRoom}
              profile={profile}
              roomId={roomId}
              patchDealCache={patchDeal}
              selectedAgentProfileId={isAgent ? profile?.id : selectedInvite?.agent_profile_id}
              onInvestorSigned={onInvestorSigned}
            />
          </div>
        )}

        {/* Pending Agents */}
        {currentTab === "agents" && showPendingAgents && (
          <div className="px-3 py-3 flex-1">
            <PendingAgentsList
              invites={pendingInvites}
              selectedInviteId={selectedInvite?.id}
              onSelectAgent={(invite) => {
                onSelectPendingInvite(invite);
                setActiveTab("board");
              }}
            />
          </div>
        )}

        {/* Messages */}
        {currentTab === "messages" && isSigned && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Collapsible deal info */}
            <button
              onClick={() => setDealInfoOpen(!dealInfoOpen)}
              className="flex items-center justify-between px-4 py-2.5 bg-[#111111] border-b border-[#1F1F1F] flex-shrink-0"
            >
              <span className="text-xs font-medium text-[#808080]">Deal info</span>
              {dealInfoOpen ? <ChevronUp className="w-4 h-4 text-[#808080]" /> : <ChevronDown className="w-4 h-4 text-[#808080]" />}
            </button>
            {dealInfoOpen && (
              <div className="bg-[#111111] border-b border-[#1F1F1F] px-4 py-3 flex-shrink-0 space-y-2">
                {(isSigned || isAgent) && (
                  <CounterpartyInfoBar
                    counterparty={isInvestor
                      ? { ...deal?.agent_contact, name: deal?.agent_full_name }
                      : { ...deal?.investor_contact, name: deal?.investor_full_name }
                    }
                    showContactInfo={isSigned}
                  />
                )}
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="text-[#CCC]">{[currentRoom?.city, currentRoom?.state].filter(Boolean).join(", ")}</span>
                  {isAgent
                    ? currentRoom?.estimated_list_price > 0 && <span className="text-[#34D399] font-mono">${currentRoom.estimated_list_price.toLocaleString()}</span>
                    : currentRoom?.budget > 0 && <span className="text-[#34D399] font-mono">${currentRoom.budget.toLocaleString()}</span>
                  }
                  {roomSellerComp && <span className="text-[#E3C567] font-semibold">Agent Comp: {roomSellerComp}</span>}
                </div>
                {isInvestor && isSigned && deal?.id && !hasWalkthroughAppt && normalizeStage(deal?.pipeline_stage) === "connected_deals" && (
                  <button
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E3C567] border border-[#E3C567]/30 rounded-full px-3 py-1.5"
                    onClick={() => setWalkthroughModalOpen(true)}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Schedule Walk-through
                  </button>
                )}
              </div>
            )}

            {/* Signing banners */}
            <div className="px-4 flex-shrink-0">
              {isAgent && !isSigned && (currentRoom?.agreement_status === "investor_signed" || deal?.is_fully_signed === false) && (
                <div className="my-3 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2"><Shield className="w-4 h-4 text-[#60A5FA] mt-0.5" /><div><h3 className="text-sm font-bold text-[#60A5FA] mb-0.5">Review & Sign</h3><p className="text-xs text-[#FAFAFA]/80">Investor has signed. Review terms and sign to lock in.</p></div></div>
                  <Button onClick={() => setActiveTab("board")} size="sm" className="bg-[#E3C567] text-black rounded-full font-semibold text-xs">My Agreement</Button>
                </div>
              )}
              {isInvestor && !isSigned && (
                <div className="my-3 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2"><Shield className="w-4 h-4 text-[#60A5FA] mt-0.5" /><div><h3 className="text-sm font-bold text-[#60A5FA] mb-0.5">Review & Sign</h3><p className="text-xs text-[#FAFAFA]/80">Open My Agreement to review and sign.</p></div></div>
                  <Button onClick={() => setActiveTab("board")} size="sm" className="bg-[#E3C567] text-black rounded-full font-semibold text-xs">My Agreement</Button>
                </div>
              )}
            </div>

            {/* Messages area */}
            <div className="flex-1 px-4 pb-safe min-h-0 flex flex-col">
              <SimpleMessageBoard roomId={roomId} profile={profile} user={user} isChatEnabled={isChatEnabled} isSigned={isSigned} dealId={deal?.id} />
            </div>
          </div>
        )}
      </div>

      <WalkthroughScheduleModal
        open={walkthroughModalOpen}
        onOpenChange={setWalkthroughModalOpen}
        deal={deal}
        roomId={roomId}
        profile={profile}
        onScheduled={(updates) => {
          if (patchDeal && deal?.id) patchDeal(deal.id, updates);
        }}
      />

      {/* Rooms drawer */}
      {roomsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setRoomsDrawerOpen(false)} />
          {/* panel */}
          <div className="relative w-[85%] max-w-[340px] h-full bg-[#0D0D0D] border-r border-[#1F1F1F] flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between h-12 px-3 border-b border-[#1F1F1F] flex-shrink-0">
              <span className="text-sm font-semibold text-[#E3C567]">Switch Deal</span>
              <button onClick={() => setRoomsDrawerOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#1F1F1F]">
                <X className="w-5 h-5 text-[#FAFAFA]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MobileRoomList
                rooms={rooms || []}
                userRole={userRole}
                search=""
                onSearchChange={() => {}}
                onRoomClick={(r) => {
                  setRoomsDrawerOpen(false);
                  onSwitchRoom(r);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
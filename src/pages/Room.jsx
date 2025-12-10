import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { listMessages, listMyRooms, sendMessage, roomUpdate } from "@/components/functions";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Logo } from "@/components/Logo";
import { useRooms } from "@/components/useRooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContractWizard from "@/components/ContractWizard";
import { 
  Menu, Send, Loader2, ArrowLeft, FileText, Shield, Search, Info, User, Plus
} from "lucide-react";
import EscrowPanel from "@/components/EscrowPanel";

// Use shared rooms hook for consistency across pages
function useMyRooms() {
  const { data: rooms, isLoading: loading } = useRooms();
  return { rooms, loading };
}

function useMessages(roomId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [items]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let lastFetch = null;

    const fetchMessages = async () => {
      try {
        // Load from sessionStorage first
        const storedMessages = JSON.parse(sessionStorage.getItem(`room_messages_${roomId}`) || '[]');
        
        const params = { room_id: roomId };
        if (lastFetch) params.after = lastFetch;
        const response = await listMessages(params);
        const apiMessages = response.data?.items || [];
        
        // Merge API messages with stored messages (avoid duplicates)
        const apiIds = new Set(apiMessages.map(m => m.id));
        const uniqueStored = storedMessages.filter(m => !apiIds.has(m.id));
        const allMessages = [...apiMessages, ...uniqueStored].sort((a, b) => 
          new Date(a.created_date) - new Date(b.created_date)
        );
        
        if (!cancelled) {
          setItems(allMessages);
          if (allMessages.length > 0) lastFetch = allMessages[allMessages.length - 1].created_date;
        }
      } catch (error) {
        // Fallback to sessionStorage only
        const storedMessages = JSON.parse(sessionStorage.getItem(`room_messages_${roomId}`) || '[]');
        if (!cancelled) setItems(storedMessages);
      }
      finally { if (!cancelled) setLoading(false); }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [roomId]);

  return { items, loading, setItems, messagesEndRef };
}

export default function Room() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const roomId = params.get("roomId");
  const { profile } = useCurrentProfile();
  const { rooms } = useMyRooms();
  const { items: messages, loading, setItems, messagesEndRef } = useMessages(roomId);
  const [drawer, setDrawer] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showEscrow, setShowEscrow] = useState(false);
  const [searchConversations, setSearchConversations] = useState("");
  const [showBoard, setShowBoard] = useState(false);

  const currentRoom = rooms.find(r => r.id === roomId) || null;
  const counterpartName = currentRoom?.counterparty_name || location.state?.initialCounterpartyName || "Chat";

  const send = async () => {
    const t = text.trim();
    if (!t || !roomId || sending) return;
    setText("");
    setSending(true);
    const optimistic = {
      id: `msg-${Date.now()}`,
      room_id: roomId,
      body: t,
      sender_profile_id: profile?.id || "me",
      created_date: new Date().toISOString()
    };
    setItems(prev => [...prev, optimistic]);
    
    // Save to sessionStorage for persistence
    const storedMessages = JSON.parse(sessionStorage.getItem(`room_messages_${roomId}`) || '[]');
    storedMessages.push(optimistic);
    sessionStorage.setItem(`room_messages_${roomId}`, JSON.stringify(storedMessages));
    
    try {
      const response = await sendMessage({ room_id: roomId, body: t });
      if (!response.data?.ok) {
        // API failed but we keep local message - it's already in sessionStorage
        console.log('Message saved locally, API sync pending');
      }
    } catch (error) {
      // Keep the message in UI and sessionStorage even if API fails
      console.log('Message saved locally:', error.message);
    } finally { setSending(false); }
  };

  const handleLockIn = async () => {
    if (!currentRoom?.suggested_deal_id) return;
    try {
      // Call the specialized lock-in function that handles cleanup of other rooms
      await base44.functions.invoke('lockInDealAgent', { 
        room_id: roomId, 
        deal_id: currentRoom.suggested_deal_id
      });
      
      // Force reload to refresh room list and UI state
      window.location.reload();
    } catch (error) {
      console.error("Failed to lock in agent:", error);
    }
  };

  const filteredRooms = rooms.filter(r => {
    // Only show active conversations (exclude orphan deals/potential matches)
    if (r.is_orphan) return false;
    
    if (!searchConversations) return true;
    return r.counterparty_name?.toLowerCase().includes(searchConversations.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-transparent flex">
      {/* Left Sidebar - Conversation List */}
      <div 
        className={`fixed inset-y-0 left-0 w-[320px] bg-[#0D0D0D] border-r border-[#1F1F1F] z-40 transform transition-transform shadow-xl ${
          drawer ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-[#1F1F1F]">
          <div className="flex items-center gap-3 mb-5">
            <Logo size="default" showText={false} linkTo={createPageUrl("Dashboard")} />
            <h2 className="text-xl font-bold text-[#E3C567]">Messages</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
            <Input
              placeholder="Search conversations..."
              value={searchConversations}
              onChange={(e) => setSearchConversations(e.target.value)}
              className="h-11 pl-11 rounded-full bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] focus:border-[#E3C567] focus:ring-[#E3C567]/20"
            />
          </div>
        </div>
        
        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.map(r => {
            const isActive = r.id === roomId;
            return (
              <button
                key={r.id}
                onClick={() => {
                  navigate(`${createPageUrl("Room")}?roomId=${r.id}`);
                  setDrawer(false);
                }}
                className={`w-full text-left px-5 py-4 transition-all duration-200 flex items-center gap-4 border-b border-[#1F1F1F] ${
                  isActive 
                    ? "bg-[#E3C567]/20 border-l-4 border-l-[#E3C567]" 
                    : "hover:bg-[#141414] border-l-4 border-l-transparent"
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User className="w-6 h-6 text-[#E3C567]" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[15px] font-semibold text-[#FAFAFA] truncate">
                      {r.counterparty_name || `Room ${r.id.slice(0, 6)}`}
                    </p>
                    <span className="text-xs text-[#808080] flex-shrink-0 ml-2">
                      {new Date(r.created_date || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  {(r.property_address || r.title) && (
                    <p className="text-sm text-[#E3C567] truncate font-medium">
                      {r.property_address || r.title}
                    </p>
                  )}
                  {r.budget && (
                    <p className="text-sm text-[#34D399] font-semibold mt-0.5">
                      ${r.budget.toLocaleString()}
                    </p>
                  )}
                  {!r.property_address && !r.title && !r.budget && (
                    <p className="text-sm text-[#808080] truncate">
                      {r.counterparty_role || "Active room"}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Main Area - Active Conversation */}
      <div className="flex-1 md:ml-[320px] flex flex-col bg-black">
        {/* Conversation Header */}
        <div className="h-18 border-b border-[#1F1F1F] flex items-center px-5 bg-[#0D0D0D] shadow-sm">
          <button 
            className="mr-4 md:hidden text-[#6B7280] hover:text-[#111827] transition-colors"
            onClick={() => setDrawer(s => !s)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <button
            className="mr-4 w-10 h-10 rounded-full bg-[#1F1F1F] flex items-center justify-center text-[#808080] hover:bg-[#333333] hover:text-[#FAFAFA] transition-all"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* Avatar */}
          <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center mr-4 shadow-sm">
            <User className="w-6 h-6 text-[#E3C567]" />
          </div>
          
          {/* Name and Status */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#FAFAFA]">{counterpartName}</h2>
            <div className="flex items-center gap-3">
              <span className="bg-[#1F1F1F] text-[#808080] border border-[#333] px-2 py-0.5 rounded text-xs">
                Choosing agent
              </span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {roomId && 
             (currentRoom?.deal_id || currentRoom?.suggested_deal_id) && 
             !currentRoom?.deal_assigned_agent_id && (
              <Button
                onClick={handleLockIn}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-bold px-5"
              >
                Lock in this agent
              </Button>
            )}
            
            {roomId && (
              <Button
                onClick={() => setShowBoard(!showBoard)}
                className={`rounded-full font-semibold transition-all ${
                  showBoard 
                    ? "bg-[#E3C567] hover:bg-[#EDD89F] text-black" 
                    : "bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
                }`}
              >
                <FileText className="w-4 h-4 mr-2" />
                Deal Board
              </Button>
            )}
          </div>
        </div>

        {/* Persistent Deal Header */}
        {!showBoard && !loading && currentRoom && (
          <div className="bg-[#111111] border-b border-[#1F1F1F] py-3 px-6 flex flex-col items-center justify-center shadow-md z-10">
            {/* Row 1: Status & Title */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#E3C567]"></span>
              <span className="font-bold text-[#FAFAFA] text-sm">
                {currentRoom.title || `Chat with ${counterpartName}`}
              </span>
              <span className="text-[#555] text-xs">•</span>
              <span className="text-[#808080] text-xs uppercase tracking-wider font-semibold">
                {currentRoom.pipeline_stage ? currentRoom.pipeline_stage.replace(/_/g, ' ') : 'GENERAL'}
              </span>
            </div>
            
            {/* Row 2: Address & Price */}
            <div className="flex items-center gap-3 text-xs opacity-90">
               <div className="flex items-center gap-1.5 text-[#CCC]">
                 {/* Fallback to title if address is missing, as title often contains the address in this app */}
                 <span>{currentRoom.property_address || currentRoom.title || "No Property Address"}</span>
               </div>
               
               {currentRoom.budget > 0 && (
                 <>
                   <span className="text-[#333]">|</span>
                   <span className="text-[#34D399] font-mono font-medium">
                     ${currentRoom.budget.toLocaleString()}
                   </span>
                 </>
               )}
            </div>
          </div>
        )}

        {/* Message Thread or Deal Board */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {showBoard ? (
            /* Deal Board View */
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-[#E3C567] mb-1">Deal Board</h3>
                <p className="text-sm text-[#808080]">Documents, files, and important information for this deal</p>
              </div>

              {/* Pipeline Progress */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Deal Progress</h4>
                <div className="space-y-3">
                  {[
                    { id: 'new_contract', label: 'Contract Walkthrough', color: '#E3C567' },
                    { id: 'walkthrough_scheduled', label: 'Walkthrough Scheduled', color: '#60A5FA' },
                    { id: 'evaluate_deal', label: 'Evaluate Deal', color: '#F59E0B' },
                    { id: 'marketing', label: 'Marketing', color: '#DB2777' },
                    { id: 'closing', label: 'Ready to Close', color: '#34D399' }
                  ].map((stage, idx) => {
                    const isActive = currentRoom?.pipeline_stage === stage.id;
                    const isPast = [
                      'new_contract', 'walkthrough_scheduled', 'evaluate_deal', 'marketing', 'closing'
                    ].indexOf(currentRoom?.pipeline_stage) > idx;
                    
                    return (
                      <div key={stage.id} className="flex items-center gap-3">
                        <div 
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                            isActive 
                              ? 'ring-2 ring-offset-2 ring-offset-black' 
                              : isPast 
                              ? 'bg-[#34D399]' 
                              : 'bg-[#1F1F1F]'
                          }`}
                          style={isActive ? { backgroundColor: stage.color, ringColor: stage.color } : {}}
                        >
                          <span className="text-sm font-bold text-white">
                            {isPast ? '✓' : idx + 1}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            isActive ? 'text-[#FAFAFA]' : isPast ? 'text-[#808080]' : 'text-[#666666]'
                          }`}>
                            {stage.label}
                          </p>
                          {isActive && (
                            <p className="text-xs text-[#E3C567]">Current Stage</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Escrow Section - Hidden */}
              {/* 
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#E3C567]" />
                  Escrow & Payments
                </h4>
                <EscrowPanel 
                  room={currentRoom} 
                  profile={profile}
                  onUpdate={() => window.location.reload()}
                />
              </div> 
              */}

              {/* Contracts Section */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#E3C567]" />
                    Contracts & Documents
                  </h4>
                  <Button
                    onClick={() => setWizardOpen(true)}
                    className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Generate Contract
                  </Button>
                </div>
                <p className="text-sm text-[#808080]">
                  Create and manage contracts for this deal using AI-powered tools.
                </p>
              </div>

              {/* Files Section */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#E3C567]" />
                  Uploaded Files
                </h4>
                <div className="text-center py-8">
                  <p className="text-sm text-[#808080]">No files uploaded yet</p>
                  <p className="text-xs text-[#666666] mt-1">Share files through messages</p>
                </div>
              </div>

              {/* Important Information */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#E3C567]" />
                  Important Information
                </h4>
                <div className="space-y-3">
                  {currentRoom?.property_address && (
                    <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                      <span className="text-sm text-[#808080]">Property</span>
                      <span className="text-sm text-[#FAFAFA] font-medium">{currentRoom.property_address}</span>
                    </div>
                  )}
                  {currentRoom?.budget && (
                    <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                      <span className="text-sm text-[#808080]">Budget</span>
                      <span className="text-sm text-[#34D399] font-semibold">${currentRoom.budget.toLocaleString()}</span>
                    </div>
                  )}
                  {currentRoom?.pipeline_stage && (
                    <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                      <span className="text-sm text-[#808080]">Stage</span>
                      <span className="text-sm text-[#FAFAFA] font-medium capitalize">{currentRoom.pipeline_stage.replace('_', ' ')}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-[#808080]">Deal Started</span>
                    <span className="text-sm text-[#FAFAFA] font-medium">
                      {new Date(currentRoom?.created_date || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Messages View */
            <div className="flex flex-col min-h-full space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 text-[#E3C567] animate-spin mx-auto mb-3" />
                    <p className="text-sm text-[#808080]">Loading messages...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-[#E3C567]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send className="w-8 h-8 text-[#E3C567]" />
                    </div>
                    <p className="text-[#808080]">No messages yet. Say hello!</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m) => {
                    const isMe = m.sender_profile_id === profile?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div className="max-w-[70%]">
                          <div
                            className={`px-5 py-3.5 shadow-sm ${
                              isMe
                                ? "bg-[#E3C567] text-black rounded-2xl rounded-br-md"
                                : "bg-[#0D0D0D] text-[#FAFAFA] rounded-2xl rounded-bl-md border border-[#1F1F1F]"
                            }`}
                          >
                            <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
                          </div>
                          <p className={`text-xs text-[#808080] mt-1.5 ${isMe ? 'text-right' : 'text-left'}`}>
                            {new Date(m.created_date).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          )}
        </div>

        {/* Message Input Area */}
        <div className="px-5 py-4 bg-[#0D0D0D] border-t border-[#1F1F1F] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message..."
                className="h-12 pl-5 pr-4 rounded-full bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] text-[15px] focus:border-[#E3C567] focus:ring-[#E3C567]/20"
                disabled={sending}
              />
            </div>
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="w-12 h-12 bg-[#E3C567] hover:bg-[#EDD89F] disabled:bg-[#1F1F1F] disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all shadow-lg shadow-[#E3C567]/30 disabled:shadow-none hover:shadow-xl hover:-translate-y-0.5"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      <ContractWizard 
        roomId={roomId} 
        open={wizardOpen} 
        onClose={() => setWizardOpen(false)} 
      />
    </div>
  );
}
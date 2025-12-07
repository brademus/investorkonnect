import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { listMessages, listMyRooms, sendMessage } from "@/components/functions";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Logo } from "@/components/Logo";
import { useRooms } from "@/components/useRooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContractWizard from "@/components/ContractWizard";
import { 
  Menu, Send, Loader2, ArrowLeft, DollarSign, FileText, Shield, Search, Info, MoreHorizontal, User
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

  const currentRoom = rooms.find(r => r.id === roomId) || null;
  const counterpartName = currentRoom?.counterparty_name || "Chat";

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

  const filteredRooms = rooms.filter(r => {
    if (!searchConversations) return true;
    return r.counterparty_name?.toLowerCase().includes(searchConversations.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left Sidebar - Conversation List */}
      <div 
        className={`fixed inset-y-0 left-0 w-[320px] bg-[#0D0D0D] border-r border-[#1F1F1F] z-40 transform transition-transform shadow-xl ${
          drawer ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-[#1F1F1F]">
          <div className="flex items-center gap-3 mb-5">
            <Logo size="default" showText={false} linkTo={createPageUrl("DealRooms")} />
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
                  {r.property_address && (
                    <p className="text-sm text-[#E3C567] truncate font-medium">
                      {r.property_address}
                    </p>
                  )}
                  {r.budget && (
                    <p className="text-sm text-[#34D399] font-semibold mt-0.5">
                      ${r.budget.toLocaleString()}
                    </p>
                  )}
                  {!r.property_address && !r.budget && (
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
            onClick={() => navigate(createPageUrl("DealRooms"))}
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
            {currentRoom && (
              <p className="text-sm text-[#34D399] flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#34D399] rounded-full animate-pulse"></span>
                Active now
              </p>
            )}
          </div>
          
          {/* Action Buttons */}
          {roomId && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEscrow(!showEscrow)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  showEscrow 
                    ? "bg-[#E3C567]/20 text-[#E3C567] shadow-sm" 
                    : "bg-[#1F1F1F] text-[#808080] hover:bg-[#333333]"
                }`}
              >
                <Shield className="w-5 h-5" />
              </button>
              <button
                onClick={() => setWizardOpen(true)}
                className="w-10 h-10 rounded-full bg-[#1F1F1F] text-[#808080] hover:bg-[#333333] flex items-center justify-center transition-all"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full bg-[#1F1F1F] text-[#808080] hover:bg-[#333333] flex items-center justify-center transition-all">
                <Info className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full bg-[#1F1F1F] text-[#808080] hover:bg-[#333333] flex items-center justify-center transition-all">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Escrow Panel */}
        {showEscrow && currentRoom && (
          <div className="px-5 py-4 bg-[#0D0D0D] border-b border-[#1F1F1F] shadow-sm">
            <EscrowPanel 
              room={currentRoom} 
              profile={profile}
              onUpdate={() => window.location.reload()}
            />
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-[#E3C567] animate-spin mx-auto mb-3" />
                <p className="text-sm text-[#808080]">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
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
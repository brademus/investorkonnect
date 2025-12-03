import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { listMessages, listMyRooms, sendMessage } from "@/components/functions";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContractWizard from "@/components/ContractWizard";
import { 
  Menu, Send, Loader2, ArrowLeft, DollarSign, FileText, Shield, Search, Info, MoreHorizontal, User
} from "lucide-react";
import EscrowPanel from "@/components/EscrowPanel";

function useMyRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadRooms = async () => {
      try {
        // Load demo rooms from sessionStorage
        const demoRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        
        const response = await listMyRooms();
        const apiRooms = response.data?.items || [];
        
        // Merge demo rooms with API rooms (avoid duplicates)
        const apiIds = new Set(apiRooms.map(r => r.id));
        const uniqueDemoRooms = demoRooms.filter(r => !apiIds.has(r.id));
        
        if (!cancelled) setRooms([...apiRooms, ...uniqueDemoRooms]);
      } catch (error) {
        // Fallback to demo rooms only
        const demoRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        if (!cancelled) setRooms(demoRooms);
      }
      finally { if (!cancelled) setLoading(false); }
    };
    loadRooms();
    return () => { cancelled = true; };
  }, []);

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
    <div className="min-h-screen bg-[#FAF7F2] flex">
      {/* Left Sidebar - Conversation List */}
      <div 
        className={`fixed inset-y-0 left-0 w-[320px] bg-white border-r border-[#E5E7EB] z-40 transform transition-transform shadow-xl ${
          drawer ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3 mb-5">
            <Logo size="default" showText={false} linkTo={createPageUrl("DealRooms")} />
            <h2 className="text-xl font-bold text-[#111827]">Messages</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <Input
              placeholder="Search conversations..."
              value={searchConversations}
              onChange={(e) => setSearchConversations(e.target.value)}
              className="h-11 pl-11 rounded-full bg-[#F9FAFB] border-[#E5E7EB] focus:border-[#D3A029] focus:ring-[#D3A029]/20"
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
                className={`w-full text-left px-5 py-4 transition-all duration-200 flex items-center gap-4 border-b border-[#F3F4F6] ${
                  isActive 
                    ? "bg-[#FFFBEB] border-l-4 border-l-[#D3A029]" 
                    : "hover:bg-[#F9FAFB] border-l-4 border-l-transparent"
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User className="w-6 h-6 text-[#D3A029]" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[15px] font-semibold text-[#111827] truncate">
                      {r.counterparty_name || `Room ${r.id.slice(0, 6)}`}
                    </p>
                    <span className="text-xs text-[#9CA3AF] flex-shrink-0 ml-2">
                      {new Date(r.created_date || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B7280] truncate">
                    {r.counterparty_role || "Active room"}
                  </p>
                </div>
              </button>
            );
          })}
          
          <Link 
            to={createPageUrl("DealRooms")} 
            className="flex items-center gap-2 px-5 py-4 text-sm font-semibold text-[#D3A029] hover:bg-[#FFFBEB] transition-colors"
          >
            <span className="text-lg">+</span> New Deal Room
          </Link>
        </div>
      </div>

      {/* Right Main Area - Active Conversation */}
      <div className="flex-1 md:ml-[320px] flex flex-col bg-[#FAF7F2]">
        {/* Conversation Header */}
        <div className="h-18 border-b border-[#E5E7EB] flex items-center px-5 bg-white shadow-sm">
          <button 
            className="mr-4 md:hidden text-[#6B7280] hover:text-[#111827] transition-colors"
            onClick={() => setDrawer(s => !s)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <button
            className="mr-4 w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] hover:bg-[#E5E7EB] hover:text-[#111827] transition-all"
            onClick={() => navigate(createPageUrl("DealRooms"))}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* Avatar */}
          <div className="w-12 h-12 bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] rounded-full flex items-center justify-center mr-4 shadow-sm">
            <User className="w-6 h-6 text-[#D3A029]" />
          </div>
          
          {/* Name and Status */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#111827]">{counterpartName}</h2>
            {currentRoom && (
              <p className="text-sm text-[#10B981] flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></span>
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
                    ? "bg-[#FEF3C7] text-[#D3A029] shadow-sm" 
                    : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                }`}
              >
                <Shield className="w-5 h-5" />
              </button>
              <button
                onClick={() => setWizardOpen(true)}
                className="w-10 h-10 rounded-full bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] flex items-center justify-center transition-all"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] flex items-center justify-center transition-all">
                <Info className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] flex items-center justify-center transition-all">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Escrow Panel */}
        {showEscrow && currentRoom && (
          <div className="px-5 py-4 bg-white border-b border-[#E5E7EB] shadow-sm">
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
                <Loader2 className="w-10 h-10 text-[#D3A029] animate-spin mx-auto mb-3" />
                <p className="text-sm text-[#6B7280]">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#FEF3C7] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-[#D3A029]" />
                </div>
                <p className="text-[#6B7280]">No messages yet. Say hello!</p>
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
                            ? "bg-[#D3A029] text-white rounded-2xl rounded-br-md"
                            : "bg-white text-[#111827] rounded-2xl rounded-bl-md border border-[#E5E7EB]"
                        }`}
                      >
                        <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
                      </div>
                      <p className={`text-xs text-[#9CA3AF] mt-1.5 ${isMe ? 'text-right' : 'text-left'}`}>
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
        <div className="px-5 py-4 bg-white border-t border-[#E5E7EB] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
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
                className="h-12 pl-5 pr-4 rounded-full bg-[#F9FAFB] border-[#E5E7EB] text-[15px] focus:border-[#D3A029] focus:ring-[#D3A029]/20"
                disabled={sending}
              />
            </div>
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="w-12 h-12 bg-[#D3A029] hover:bg-[#B98413] disabled:bg-[#E5E7EB] disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all shadow-lg shadow-[#D3A029]/30 disabled:shadow-none hover:shadow-xl hover:-translate-y-0.5"
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
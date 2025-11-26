import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { listMessages, listMyRooms, sendMessage } from "@/components/functions";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
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
        const response = await listMyRooms();
        if (!cancelled) setRooms(response.data?.items || []);
      } catch (error) {}
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
        const params = { room_id: roomId };
        if (lastFetch) params.after = lastFetch;
        const response = await listMessages(params);
        const newMessages = response.data?.items || [];
        if (!cancelled) {
          if (lastFetch) setItems(prev => [...prev, ...newMessages]);
          else setItems(newMessages);
          if (newMessages.length > 0) lastFetch = newMessages[newMessages.length - 1].created_date;
        }
      } catch (error) {}
      finally { if (!cancelled) setLoading(false); }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
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
      id: `tmp-${Date.now()}`,
      room_id: roomId,
      body: t,
      sender_profile_id: profile?.id || "me",
      created_date: new Date().toISOString()
    };
    setItems(prev => [...prev, optimistic]);
    try {
      const response = await sendMessage({ room_id: roomId, body: t });
      if (!response.data?.ok) throw new Error(response.data?.error || "Failed to send");
    } catch (error) {
      setItems(prev => prev.filter(m => m.id !== optimistic.id));
      setText(t);
    } finally { setSending(false); }
  };

  const filteredRooms = rooms.filter(r => {
    if (!searchConversations) return true;
    return r.counterparty_name?.toLowerCase().includes(searchConversations.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-white flex" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      {/* Left Sidebar - Conversation List */}
      <div 
        className={`fixed inset-y-0 left-0 w-[360px] bg-[#F9F9F9] border-r border-[#E5E5E5] z-40 transform transition-transform ${
          drawer ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-[#E5E5E5]">
          <h2 className="text-[24px] font-bold text-black mb-4">Messages</h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
            <Input
              placeholder="Search conversations..."
              value={searchConversations}
              onChange={(e) => setSearchConversations(e.target.value)}
              className="h-10 pl-10 rounded-full bg-white border-none"
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
                className={`w-full text-left px-6 py-4 transition-all duration-200 flex items-center gap-4 ${
                  isActive 
                    ? "bg-white border-l-4 border-l-[#D4AF37]" 
                    : "hover:bg-white border-l-4 border-l-transparent"
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 bg-[#E5E5E5] rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-[#666666]" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[16px] font-bold text-black truncate">
                      {r.counterparty_name || `Room ${r.id.slice(0, 6)}`}
                    </p>
                    <span className="text-[12px] text-[#999999] flex-shrink-0 ml-2">
                      {new Date(r.created_date || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[14px] text-[#666666] truncate">
                    {r.counterparty_role || "Active room"}
                  </p>
                </div>
              </button>
            );
          })}
          
          <Link 
            to={createPageUrl("DealRooms")} 
            className="block px-6 py-4 text-sm text-[#D4AF37] font-medium hover:bg-white"
          >
            + New Deal Room
          </Link>
        </div>
      </div>

      {/* Right Main Area - Active Conversation */}
      <div className="flex-1 md:ml-[360px] flex flex-col bg-white">
        {/* Conversation Header */}
        <div className="h-20 border-b border-[#E5E5E5] flex items-center px-5 bg-white">
          <button 
            className="mr-4 md:hidden text-[#666666] hover:text-black"
            onClick={() => setDrawer(s => !s)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <button
            className="mr-4 text-[#666666] hover:text-black"
            onClick={() => navigate(createPageUrl("DealRooms"))}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* Avatar */}
          <div className="w-12 h-12 bg-[#E5E5E5] rounded-full flex items-center justify-center mr-4">
            <User className="w-6 h-6 text-[#666666]" />
          </div>
          
          {/* Name and Status */}
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-black">{counterpartName}</h2>
            {currentRoom && (
              <p className="text-[14px] text-[#00A699]">Active now</p>
            )}
          </div>
          
          {/* Action Buttons */}
          {roomId && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEscrow(!showEscrow)}
                className={`p-2 rounded-lg transition-colors ${
                  showEscrow ? "bg-[#D4AF37]/10 text-[#D4AF37]" : "text-[#666666] hover:bg-[#F9F9F9]"
                }`}
              >
                <Shield className="w-5 h-5" />
              </button>
              <button
                onClick={() => setWizardOpen(true)}
                className="p-2 rounded-lg text-[#666666] hover:bg-[#F9F9F9] transition-colors"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg text-[#666666] hover:bg-[#F9F9F9] transition-colors">
                <Info className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg text-[#666666] hover:bg-[#F9F9F9] transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Escrow Panel */}
        {showEscrow && currentRoom && (
          <div className="px-4 py-3 bg-[#F9F9F9] border-b border-[#E5E5E5]">
            <EscrowPanel 
              room={currentRoom} 
              profile={profile}
              onUpdate={() => window.location.reload()}
            />
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-4 bg-white">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto mb-2" />
                <p className="text-sm text-[#666666]">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-[#666666]">No messages yet. Say hello!</p>
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
                        className={`px-4 py-3 ${
                          isMe
                            ? "bg-[#D4AF37] text-white rounded-[20px] rounded-br-sm"
                            : "bg-[#F0F0F0] text-black rounded-[20px] rounded-bl-sm"
                        }`}
                      >
                        <p className="text-[14px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
                      </div>
                      <p className={`text-[12px] text-[#999999] mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
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
        <div className="h-20 border-t border-[#E5E5E5] px-4 py-4 bg-white flex items-center">
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
              className="h-12 pl-5 pr-14 rounded-full bg-[#F5F5F5] border-none text-[14px]"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#D4AF37] hover:bg-[#C19A2E] disabled:bg-[#E5E5E5] rounded-full flex items-center justify-center transition-colors"
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
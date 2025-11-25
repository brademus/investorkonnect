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
  Menu, Send, Loader2, ArrowLeft, DollarSign, FileText, Shield
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
        if (!cancelled) {
          setRooms(response.data?.items || []);
        }
      } catch (error) {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
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

  useEffect(() => {
    scrollToBottom();
  }, [items]);

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
          if (lastFetch) {
            // Append new messages
            setItems(prev => [...prev, ...newMessages]);
          } else {
            // Initial load
            setItems(newMessages);
          }
          
          if (newMessages.length > 0) {
            lastFetch = newMessages[newMessages.length - 1].created_date;
          }
        }
      } catch (error) {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Initial load
    fetchMessages();

    // Poll every 3 seconds
    const interval = setInterval(fetchMessages, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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

  const currentRoom = rooms.find(r => r.id === roomId) || null;
  const counterpartName = currentRoom?.counterparty_name || "Chat";

  const send = async () => {
    const t = text.trim();
    if (!t || !roomId || sending) return;
    
    setText("");
    setSending(true);

    // Optimistic add
    const optimistic = {
      id: `tmp-${Date.now()}`,
      room_id: roomId,
      body: t,
      sender_profile_id: profile?.id || "me",
      created_date: new Date().toISOString()
    };
    setItems(prev => [...prev, optimistic]);

    try {
      const response = await sendMessage({
        room_id: roomId,
        body: t
      });

      if (!response.data?.ok) {
        throw new Error(response.data?.error || "Failed to send");
      }
    } catch (error) {
      // Revert optimistic
      setItems(prev => prev.filter(m => m.id !== optimistic.id));
      setText(t);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-slate-50 border-r border-slate-200 z-40 transform transition-transform ${
        drawer ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}>
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Your Chats</h2>
        </div>
        <div className="px-2 py-2 space-y-1 overflow-y-auto h-[calc(100vh-5rem)]">
          {rooms.map(r => (
            <button
              key={r.id}
              onClick={() => {
                navigate(`${createPageUrl("Room")}?roomId=${r.id}`);
                setDrawer(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                r.id === roomId 
                  ? "bg-blue-100 text-blue-900" 
                  : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <div className="text-sm font-medium truncate">
                {r.counterparty_name || `Room ${r.id.slice(0, 6)}`}
              </div>
              <div className="text-xs text-slate-500 capitalize">
                {r.counterparty_role || "active"}
              </div>
            </button>
          ))}
          <Link 
            to={createPageUrl("DealRooms")} 
            className="block px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            + New Deal Room
          </Link>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 md:ml-72 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 flex items-center px-4 bg-white">
          <button 
            className="mr-3 md:hidden text-slate-600 hover:text-slate-900"
            onClick={() => setDrawer(s => !s)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <button
            className="mr-3 text-slate-600 hover:text-slate-900"
            onClick={() => navigate(createPageUrl("DealRooms"))}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">{counterpartName}</h2>
            {currentRoom && (
              <p className="text-xs text-slate-500 capitalize">
                {currentRoom.counterparty_role}
              </p>
            )}
          </div>
          {roomId && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEscrow(!showEscrow)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ${
                  showEscrow 
                    ? "bg-blue-100 text-blue-700 border-blue-300" 
                    : "text-slate-700 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <Shield className="w-4 h-4" />
                Escrow
              </button>
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                <FileText className="w-4 h-4" />
                Contract
              </button>
              <Link 
                to={`${createPageUrl("Room")}?roomId=${roomId}&tab=payments`}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <DollarSign className="w-4 h-4" />
                Payments
              </Link>
            </div>
          )}
        </div>

        {/* Escrow Panel */}
        {showEscrow && currentRoom && (
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-200">
            <EscrowPanel 
              room={currentRoom} 
              profile={profile}
              onUpdate={() => {
                // Trigger room refresh
                window.location.reload();
              }}
            />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-600">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-600">No messages yet. Say hello!</p>
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
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        isMe
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-slate-200 text-slate-900"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                      <div className={`text-[10px] mt-1 ${isMe ? "text-blue-100" : "text-slate-500"}`}>
                        {new Date(m.created_date).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-4 bg-white">
          <div className="flex gap-3">
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
              className="flex-1"
              disabled={sending}
            />
            <Button 
              onClick={send} 
              disabled={!text.trim() || sending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
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
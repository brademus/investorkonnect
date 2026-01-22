import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { toast } from "sonner";

export default function SimpleMessageBoard({ roomId, profile, user, isChatEnabled }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const rows = await base44.entities.Message.filter({ room_id: roomId }, "created_date");
        if (!cancelled) {
          setMessages(rows || []);
          scrollToBottom();
        }
      } catch (e) {
        // keep silent
      }
    };

    load();
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      const data = event?.data;
      if (!data || data.room_id !== roomId) return;
      if (event.type === "create") {
        setMessages((prev) => {
          if (!data?.id) return prev;
          // If the real message already exists, do nothing
          if (prev.some((m) => m.id === data.id)) return prev;
          // If we have an optimistic copy for this message, replace it instead of appending
          const hasOptimisticMatch = prev.some(
            (m) => m._optimistic && m.sender_profile_id === data.sender_profile_id && m.body === data.body
          );
          if (hasOptimisticMatch) {
            return prev.map((m) =>
              m._optimistic && m.sender_profile_id === data.sender_profile_id && m.body === data.body ? data : m
            );
          }
          return [...prev, data];
        });
        scrollToBottom();
      } else if (event.type === "delete") {
        setMessages((prev) => prev.filter((m) => m.id !== event.id));
      } else if (event.type === "update") {
        setMessages((prev) => prev.map((m) => (m.id === event.id ? { ...m, ...data } : m)));
      }
    });

    return () => {
      cancelled = true;
      try { unsubscribe && unsubscribe(); } catch (_) {}
    };
  }, [roomId]);

  const isMe = (m) => m?.sender_profile_id && m.sender_profile_id === profile?.id;

  const send = async () => {
    const body = text.trim();
    if (!roomId || !body) return;
    if (!isChatEnabled) {
      toast.error("Chat unlocks after the request is accepted.");
      return;
    }

    // optimistic add
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      room_id: roomId,
      sender_profile_id: profile?.id,
      body,
      created_date: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    scrollToBottom();

    setSending(true);
    try {
      const res = await base44.functions.invoke("sendMessage", { room_id: roomId, body });
      if (!res?.data?.ok) {
        throw new Error(res?.data?.error || "Failed to send");
      }
      const real = res?.data?.message;
      if (real?.id) {
        setMessages((prev) => {
          // If subscription already added the real message, just drop the optimistic one
          if (prev.some((m) => m.id === real.id)) {
            return prev.filter((m) => m.id !== tempId);
          }
          // Otherwise replace optimistic with real
          return prev.map((m) => (m.id === tempId ? real : m));
        });
      }
    } catch (e) {
      // rollback optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(body);
      const apiErr = e?.response?.data?.error || e?.message;
      toast.error(apiErr || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${isMe(m) ? "justify-end" : "justify-start"}`}>
            <div className={`px-4 py-2 rounded-2xl max-w-[70%] ${isMe(m) ? "bg-[#E3C567] text-black rounded-br-md" : "bg-[#0D0D0D] text-[#FAFAFA] border border-[#1F1F1F] rounded-bl-md"}`}>
              <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="mt-4">
        {isChatEnabled ? (
          <div className="flex items-center gap-2">
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
              
            />
            <Button onClick={send} disabled={!text.trim()} className="w-12 h-12 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full">
              <Send className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="px-5 py-3 bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl text-sm text-[#808080]">
            Chat unlocks after the request is accepted.
          </div>
        )}
      </div>
    </div>
  );
}
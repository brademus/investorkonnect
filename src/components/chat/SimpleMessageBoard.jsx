import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { validateImage, validateSafeDocument } from "@/components/utils/fileValidation";
import WalkthroughMessageCard from "@/components/room/WalkthroughMessageCard";

function isFromMe(m, user, profile) {
  if (m?._isMe) return true;
  if (user?.id && m?.sender_user_id === user.id) return true;
  if (profile?.id && m?.sender_profile_id === profile.id) return true;
  const myEmail = (profile?.email || '').toLowerCase().trim();
  const createdBy = (m?.created_by || '').toLowerCase().trim();
  return myEmail && createdBy && myEmail === createdBy;
}

export default function SimpleMessageBoard({ roomId, profile, user, isChatEnabled, isSigned }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const scroll = () => endRef.current?.scrollIntoView({ behavior: "auto" });

  // Load + subscribe
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const load = async () => {
      const rows = await base44.entities.Message.filter({ room_id: roomId }, "created_date");
      if (!cancelled) {
        setMessages((rows || []).map(r => ({ ...r, _isMe: isFromMe(r, user, profile) })));
        setTimeout(scroll, 0);
      }
    };
    load();
    const unsub = base44.entities.Message.subscribe((event) => {
      const d = event?.data;
      if (!d || d.room_id !== roomId) return;
      const msg = { ...d, _isMe: isFromMe(d, user, profile) };
      if (event.type === "create") {
        setMessages(prev => {
          if (prev.some(m => m.id === d.id)) return prev;
          const optMatch = prev.findIndex(m => m._optimistic && m.sender_profile_id === d.sender_profile_id && m.body === d.body);
          if (optMatch >= 0) return prev.map((m, i) => i === optMatch ? msg : m);
          return [...prev, msg];
        });
        scroll();
      } else if (event.type === "delete") setMessages(prev => prev.filter(m => m.id !== event.id));
      else if (event.type === "update") setMessages(prev => prev.map(m => m.id === event.id ? { ...m, ...msg } : m));
    });
    return () => { cancelled = true; try { unsub(); } catch (_) {} };
  }, [roomId, user?.id, profile?.id]);

  const send = async () => {
    const body = text.trim();
    if (!roomId || !body || !isChatEnabled) return;
    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, room_id: roomId, sender_profile_id: profile?.id, body, created_date: new Date().toISOString(), _optimistic: true, _isMe: true }]);
    setText(""); scroll();
    setSending(true);
    try {
      const res = await base44.functions.invoke("sendMessage", { room_id: roomId, body });
      if (!res?.data?.ok) throw new Error(res?.data?.error || "Failed");
      const real = res?.data?.message;
      if (real?.id) setMessages(prev => prev.some(m => m.id === real.id) ? prev.filter(m => m.id !== tempId) : prev.map(m => m.id === tempId ? { ...real, _isMe: true } : m));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(body);
      toast.error(e?.response?.data?.error || e?.message || "Failed to send");
    } finally { setSending(false); }
  };

  const uploadFile = async (type) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (type === 'photo') input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const valid = type === 'photo' ? validateImage(file) : validateSafeDocument(file);
      if (!valid.valid) { toast.error(valid.error); return; }
      toast.info('Uploading...');
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.Message.create({
          room_id: roomId, sender_profile_id: profile?.id,
          body: `${type === 'photo' ? '📷' : '📎'} ${file.name}`,
          metadata: { type, file_url, file_name: file.name, file_type: file.type, file_size: file.size }
        });
        // Also save photos to room.photos so they appear in the Photos tab
        if (type === 'photo') {
          try {
            const roomArr = await base44.entities.Room.filter({ id: roomId });
            const rm = roomArr?.[0];
            if (rm) {
              const existing = rm.photos || [];
              if (!existing.some(p => p.url === file_url)) {
                await base44.entities.Room.update(roomId, {
                  photos: [...existing, { name: file.name, url: file_url, uploaded_by: profile?.id, uploaded_by_name: profile?.full_name || profile?.email, uploaded_at: new Date().toISOString() }]
                });
              }
            }
          } catch (_) { /* non-critical */ }
        }
        toast.success('Uploaded');
      } catch (_) { toast.error('Upload failed'); }
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map(m => {
          const isMe = m._isMe || isFromMe(m, user, profile);
          const isPhoto = m?.metadata?.type === 'photo' || (m?.metadata?.file_type || '').startsWith('image/');
          const isFile = m?.metadata?.type === 'file' && !(m?.metadata?.file_type || '').startsWith('image/');
          const isWalkthroughRequest = m?.metadata?.type === 'walkthrough_request';
          const isWalkthroughResponse = m?.metadata?.type === 'walkthrough_response';
          const isAgent = profile?.user_role === 'agent';

          // Always show walkthrough messages even before chat is unlocked
          // Hide regular messages when chat is not enabled
          if (!isChatEnabled && !isWalkthroughRequest && !isWalkthroughResponse) return null;

          if (isWalkthroughRequest) {
            return (
              <div key={m.id} className={"flex px-4 " + (isMe ? "justify-end" : "justify-start")}>
                <WalkthroughMessageCard message={m} isAgent={isAgent} isRecipient={!isMe} roomId={roomId} profile={profile} isSigned={isSigned} />
              </div>
            );
          }

          return (
            <div key={m.id} className={"flex px-4 " + (isMe ? "justify-end" : "justify-start")}>
              <div className={"px-4 py-2 rounded-2xl max-w-[70%] " + (isMe ? "bg-[#E3C567] text-black rounded-br-md" : "bg-[#0D0D0D] text-[#FAFAFA] border border-[#1F1F1F] rounded-bl-md")}>
                {isPhoto && m?.metadata?.file_url ? (
                  <div><img src={m.metadata.file_url} alt="" className="rounded-lg max-w-full max-h-64 mb-2 cursor-pointer" onClick={() => window.open(m.metadata.file_url, '_blank')} /><p className="text-[15px] whitespace-pre-wrap">{m.body}</p></div>
                ) : isFile && m?.metadata?.file_url ? (
                  <a href={m.metadata.file_url} download className={"flex items-center gap-2 text-[15px] hover:underline " + (isMe ? "text-black" : "text-[#E3C567]")}>📎 {m.metadata.file_name || 'Download'}</a>
                ) : (
                  <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="mt-4">
        {isChatEnabled ? (
          <div className="flex items-center gap-2">
            <button onClick={() => uploadFile('photo')} className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333] rounded-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-[#808080]" /></button>
            <button onClick={() => uploadFile('file')} className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333] rounded-full flex items-center justify-center"><FileText className="w-5 h-5 text-[#808080]" /></button>
            <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a message..." className="h-12 pl-5 rounded-full bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] focus:border-[#E3C567]" />
            <Button onClick={send} disabled={!text.trim()} className="w-12 h-12 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"><Send className="w-5 h-5" /></Button>
          </div>
        ) : (
          <div className="px-5 py-3 bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl text-sm text-[#808080]">Messaging unlocks after both parties sign the agreement.</div>
        )}
      </div>
    </div>
  );
}
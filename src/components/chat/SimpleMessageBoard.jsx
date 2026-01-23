import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { validateImage, validateSafeDocument } from "@/components/utils/fileValidation";

// Robust sender detection to avoid side-flip on first paint
const isMessageFromMe = (m, authUser, currentProfile) => {
  if (m?._isMe === true) return true;
  const authUserId = authUser?.id;
  if (authUserId && (m?.sender_user_id === authUserId || m?.senderUserId === authUserId)) return true;
  const myProfileId = currentProfile?.id;
  if (myProfileId && (m?.sender_profile_id === myProfileId || m?.senderProfileId === myProfileId || m?.sender_id === myProfileId)) return true;
  const myEmail = (currentProfile?.email || '').toLowerCase().trim();
  const createdBy = (m?.created_by || '').toLowerCase().trim();
  if (myEmail && createdBy && myEmail === createdBy) return true;
  return false;
};

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
          const annotated = (rows || []).map(r => ({ ...r, _isMe: isMessageFromMe(r, user, profile) }));
          setMessages(annotated);
          setTimeout(() => scrollToBottom(), 0);
        }
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    };

    load();
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      let data = event?.data;
      data = data ? { ...data, _isMe: isMessageFromMe(data, user, profile) } : data;
      if (!data || data.room_id !== roomId) return;
      if (event.type === "create") {
        setMessages((prev) => {
          if (!data?.id) return prev;
          if (prev.some((m) => m.id === data.id)) return prev;
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
  }, [roomId, user?.id, profile?.id, profile?.email]);



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
      sender_user_id: user?.id,
      body,
      created_date: new Date().toISOString(),
      _optimistic: true,
      _isMe: true,
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
      <div className="flex-1 overflow-y-auto space-y-4 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1F1F1F #0D0D0D' }}>
        <style>{`::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background-color: #1F1F1F; border-radius: 3px; }`}</style>
        {messages.map((m) => {
          const isMe = m?._isMe===true||isMessageFromMe(m,user,profile);
          const isPhotoMessage = m?.metadata?.type === 'photo' || (m?.metadata?.type === 'file' && (m?.metadata?.file_type || '').startsWith('image/'));
          const isFileMessage = m?.metadata?.type === 'file' && !(m?.metadata?.file_type || '').startsWith('image/');
          return (
            <div key={m.id} className={"flex px-4 " + (isMe ? "justify-end" : "justify-start")}>
              <div className={"px-4 py-2 rounded-2xl max-w-[70%] " + (isMe ? "bg-[#E3C567] text-black rounded-br-md" : "bg-[#0D0D0D] text-[#FAFAFA] border border-[#1F1F1F] rounded-bl-md")}>
                {isPhotoMessage && m?.metadata?.file_url ? (
                  <div>
                    <img 
                      src={m.metadata.file_url} 
                      alt={m.metadata.file_name || "photo"}
                      className="rounded-lg max-w-full h-auto max-h-64 mb-2 cursor-pointer"
                      onClick={() => window.open(m.metadata.file_url, '_blank')}
                    />
                    <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  </div>
                ) : isFileMessage && m?.metadata?.file_url ? (
                  <a 
                    href={m.metadata.file_url}
                    download={m.metadata.file_name || 'download'}
                    className={"flex items-center gap-2 text-[15px] hover:underline " + (isMe ? "text-black" : "text-[#E3C567]")}
                  >
                    📎 {m.metadata.file_name || 'Download file'}
                  </a>
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
            {/* Upload Photo Button */}
            <button
              onClick={async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.multiple = true;
                input.onchange = async (e) => {
                  const files = Array.from(e.target.files);
                  if (files.length === 0) return;
                  
                  // Validate all files
                  for (const file of files) {
                    const validation = validateImage(file);
                    if (!validation.valid) {
                      toast.error(validation.error);
                      return;
                    }
                  }
                  
                  toast.info(`Uploading ${files.length} photo(s)...`);
                  try {
                    const uploads = await Promise.all(
                      files.map(async (file) => {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        return {
                          name: file.name,
                          url: file_url,
                          uploaded_by: profile?.id,
                          uploaded_by_name: profile?.full_name || profile?.email,
                          uploaded_at: new Date().toISOString(),
                          size: file.size,
                          type: file.type
                        };
                      })
                    );
                    
                    // Create message for each photo
                    for (const upload of uploads) {
                      await base44.entities.Message.create({
                        room_id: roomId,
                        sender_profile_id: profile?.id,
                        body: `📷 Uploaded photo: ${upload.name}`,
                        metadata: {
                          type: 'photo',
                          file_url: upload.url,
                          file_name: upload.name,
                          file_type: upload.type
                        }
                      });
                    }
                    
                    toast.success(`${files.length} photo(s) uploaded`);
                  } catch (error) {
                    toast.error('Upload failed');
                  }
                };
                input.click();
              }}
              className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333] rounded-full flex items-center justify-center transition-colors"
              title="Upload photos"
            >
              <ImageIcon className="w-5 h-5 text-[#808080]" />
            </button>

            {/* Upload File Button */}
            <button
              onClick={async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  const validation = validateSafeDocument(file);
                  if (!validation.valid) {
                    toast.error(validation.error);
                    return;
                  }
                  
                  toast.info('Uploading file...');
                  try {
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    
                    await base44.entities.Message.create({
                      room_id: roomId,
                      sender_profile_id: profile?.id,
                      body: `📎 Uploaded file: ${file.name}`,
                      metadata: {
                        type: 'file',
                        file_url: file_url,
                        file_name: file.name,
                        file_size: file.size,
                        file_type: file.type
                      }
                    });
                    
                    toast.success('File uploaded');
                  } catch (error) {
                    toast.error('Upload failed');
                  }
                };
                input.click();
              }}
              className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333] rounded-full flex items-center justify-center transition-colors"
              title="Upload file"
            >
              <FileText className="w-5 h-5 text-[#808080]" />
            </button>

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
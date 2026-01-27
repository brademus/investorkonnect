import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import SimpleMessageBoard from '@/components/chat/SimpleMessageBoard';
import { useMessages } from '@/components/hooks/useMessages';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

/**
 * Messages tab - extracted from Room.js
 * Pure subscription-based, no polling
 */
export default function RoomMessagesPanel({ roomId, profile }) {
  const { messages, addMessage } = useMessages(roomId);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    setSending(true);
    try {
      const newMessage = await base44.entities.Message.create({
        room_id: roomId,
        sender_profile_id: profile.id,
        body: messageText
      });
      addMessage(newMessage);
      setMessageText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-auto">
        <SimpleMessageBoard messages={messages} profile={profile} />
      </div>
      <div className="border-t border-[#1F1F1F] p-4 flex gap-2">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 bg-[#141414] border border-[#1F1F1F] rounded-lg px-3 py-2 text-[#FAFAFA]"
          disabled={sending}
        />
        <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()} className="bg-[#E3C567]">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
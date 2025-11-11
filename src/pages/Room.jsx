
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import PaymentSchedulePanel from "@/components/PaymentSchedulePanel";
import {
  Shield, Loader2, Send, FileText, 
  AlertTriangle, CheckCircle, Upload, MessageCircle, DollarSign
} from "lucide-react";
import { toast } from "sonner";

export default function Room() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const messagesEndRef = useRef(null);
  const roomId = new URLSearchParams(window.location.search).get('id');
  const tab = new URLSearchParams(window.location.search).get('tab');

  useEffect(() => {
    if (!roomId) {
      navigate(createPageUrl("Dashboard"));
      return;
    }
    loadRoom();
    // Poll for new messages every 5 seconds (only when on messages tab)
    const interval = setInterval(() => {
      if (activeTab === 'messages') {
        loadRoom();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, activeTab]); // Added activeTab to dependency array for clarity

  useEffect(() => {
    // Set active tab from URL param
    if (tab === 'payments') {
      setActiveTab('payments');
    }
  }, [tab]);

  useEffect(() => {
    if (activeTab === 'messages') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const loadRoom = async () => {
    try {
      const params = new URLSearchParams({ roomId });
      const response = await base44.functions.invoke('roomGet', params);
      setRoom(response.data.room);
      setMessages(response.data.messages);
      setLoading(false);
    } catch (error) {
      console.error('Load room error:', error);
      toast.error("Failed to load room");
      setLoading(false);
    }
  };

  const handleNdaToggle = async (accept) => {
    try {
      await base44.functions.invoke('roomUpdate', {
        roomId,
        ndaAccept: accept
      });
      loadRoom();
      toast.success(accept ? "NDA accepted" : "NDA acceptance revoked");
    } catch (error) {
      console.error('NDA toggle error:', error);
      toast.error("Failed to update NDA status");
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setSending(true);
    try {
      await base44.functions.invoke('messagePost', {
        roomId,
        kind: 'text',
        text: newMessage
      });
      
      setNewMessage('');
      loadRoom();
    } catch (error) {
      console.error('Send message error:', error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check NDA requirement
    if (!room.ndaAcceptedInvestor || !room.ndaAcceptedAgent) {
      toast.error("Both parties must accept NDA before sharing files");
      return;
    }

    try {
      setSending(true);
      
      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      
      // Send file message
      await base44.functions.invoke('messagePost', {
        roomId,
        kind: 'file',
        text: file.name,
        fileUrl: uploadResponse.file_url
      });
      
      toast.success("File uploaded");
      loadRoom();
    } catch (error) {
      console.error('File upload error:', error);
      toast.error("Failed to upload file");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Room not found</h3>
          <Button onClick={() => navigate(createPageUrl("Dashboard"))}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const bothNdaAccepted = room.ndaAcceptedInvestor && room.ndaAcceptedAgent;
  const currentUserNdaAccepted = room.currentUserRole === 'investor' 
    ? room.ndaAcceptedInvestor 
    : room.ndaAcceptedAgent;

  // Get profile IDs for payment schedule
  const currentProfileId = room.currentUserRole === 'investor' 
    ? room.investor.profileId 
    : room.agent.profileId;
  
  const investorProfileId = room.investor?.profileId || null;
  const agentProfileId = room.agent?.profileId || null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {room.currentUserRole === 'investor' ? room.agent.name : room.investor.name}
              </h1>
              <p className="text-sm text-slate-600">
                {room.currentUserRole === 'investor' ? room.agent.company : room.investor.company}
              </p>
            </div>
            <div className="flex gap-2">
              {room.agent.vetted && (
                <Badge className="bg-emerald-100 text-emerald-800">
                  <Shield className="w-3 h-3 mr-1" />
                  Vetted Agent
                </Badge>
              )}
              {bothNdaAccepted ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  NDA Signed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  NDA Pending
                </Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 border-b border-slate-200 -mb-px">
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'messages'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageCircle className="w-4 h-4 inline mr-2" />
              Messages
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'payments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Payments
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* NDA Banner */}
        {!bothNdaAccepted && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">NDA Required</h3>
                <p className="text-orange-800 mb-4">
                  Both parties must accept the NDA before sharing files or sensitive information. 
                  File uploads are disabled until both parties agree.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="nda-accept"
                      checked={currentUserNdaAccepted}
                      onCheckedChange={handleNdaToggle}
                    />
                    <Label htmlFor="nda-accept" className="cursor-pointer font-medium">
                      I agree to the Non-Disclosure Agreement
                    </Label>
                  </div>
                  <div className="text-sm text-orange-700">
                    Status: 
                    {room.ndaAcceptedInvestor && <span className="ml-2">✓ Investor agreed</span>}
                    {room.ndaAcceptedAgent && <span className="ml-2">✓ Agent agreed</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <>
            {/* Messages */}
            <div className="bg-white rounded-xl border border-slate-200 mb-6">
              <div className="h-[500px] overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSystem = msg.kind === 'system';
                    const isMe = msg.senderUserId !== 'system' && 
                      ((room.currentUserRole === 'investor' && room.investor.userId === msg.senderUserId) ||
                       (room.currentUserRole === 'agent' && room.agent.userId === msg.senderUserId));
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-full">
                            {msg.text}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isMe ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'} rounded-2xl px-4 py-3`}>
                          <div className="text-xs opacity-70 mb-1">{msg.senderName}</div>
                          {msg.kind === 'file' ? (
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <a 
                                href={msg.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                {msg.text}
                              </a>
                            </div>
                          ) : (
                            <p className="text-sm">{msg.text}</p>
                          )}
                          <div className="text-xs opacity-60 mt-1">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex gap-3">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  disabled={sending}
                />
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={!bothNdaAccepted || sending}
                />
                <Button
                  onClick={() => document.getElementById('file-upload').click()}
                  variant="outline"
                  size="icon"
                  disabled={!bothNdaAccepted || sending}
                  title={!bothNdaAccepted ? "Both parties must accept NDA first" : "Upload file"}
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {!bothNdaAccepted && (
                <p className="text-xs text-slate-500 mt-2">
                  File uploads disabled until both parties accept NDA
                </p>
              )}
            </div>
          </>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            {!bothNdaAccepted ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">NDA Required</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  Both parties must accept the NDA before accessing payment schedules. 
                  This ensures confidentiality of deal terms.
                </p>
              </div>
            ) : (
              <PaymentSchedulePanel
                dealId={room.dealId}
                currentProfileId={currentProfileId}
                currentRole={room.currentUserRole}
                investorProfileId={investorProfileId}
                agentProfileId={agentProfileId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

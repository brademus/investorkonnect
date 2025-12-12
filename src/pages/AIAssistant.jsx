import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Loader2, Sparkles, Bot } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Header } from "@/components/Header";
import { AuthGuard } from "@/components/AuthGuard";

function AIAssistantContent() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your Investor Konnect AI assistant. I can help you with:\n\n• Platform navigation and features\n• Deal room management\n• Contract questions\n• Payment and billing\n• Matching and verification\n\nWhat can I help you with?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { profile, role } = useCurrentProfile();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const context = `User is a ${role} on Investor Konnect platform. Profile: ${JSON.stringify({
        name: profile?.full_name,
        markets: profile?.markets,
        onboarded: profile?.onboarding_completed_at ? 'yes' : 'no',
        kycStatus: profile?.kyc_status,
        hasNDA: profile?.nda_accepted
      })}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a helpful support agent for Investor Konnect, a platform connecting real estate investors with vetted agents.

User Context: ${context}

User Question: ${userMessage}

Provide a helpful, concise answer about:
- How to use platform features (deal rooms, contracts, payments, matching)
- Account and verification steps
- Billing and subscription questions
- Best practices for closing deals

Keep answers short (2-3 sentences) and actionable. If you don't know something specific about the platform, suggest contacting support@investorkonnect.com.`
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact support@investorkonnect.com for assistance.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-transparent">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Back Button */}
          <Link 
            to={createPageUrl("Dashboard")} 
            className="inline-flex items-center gap-2 text-[#808080] hover:text-[#E3C567] mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-[#E3C567]/20 rounded-2xl flex items-center justify-center border border-[#E3C567]/30">
              <Bot className="w-7 h-7 text-[#E3C567]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#E3C567]">AI Assistant</h1>
              <p className="text-[#808080]">Get instant help with platform questions</p>
            </div>
          </div>

          {/* Chat Container */}
          <div className="bg-[#0D0D0D] rounded-2xl border border-[#1F1F1F] shadow-[0_18px_45px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-[#0D0D0D]">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 bg-[#E3C567]/20 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-[#E3C567]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-[#E3C567] text-black'
                        : 'bg-[#141414] border border-[#1F1F1F] text-[#FAFAFA]'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-[#E3C567]/20 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-[#E3C567]" />
                  </div>
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 text-[#E3C567] animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#1F1F1F] bg-[#0D0D0D]">
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about the platform..."
                  disabled={loading}
                  className="flex-1 h-12 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080]"
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="h-12 px-6 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-bold"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-[#666] mt-3 text-center">
                Powered by AI • Responses may not be 100% accurate
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AIAssistant() {
  return (
    <AuthGuard requireAuth={true}>
      <AIAssistantContent />
    </AuthGuard>
  );
}
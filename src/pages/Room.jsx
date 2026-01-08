import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { listMyRooms, roomUpdate } from "@/components/functions";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Logo } from "@/components/Logo";
import { useRooms } from "@/components/useRooms";
import { useQueryClient } from "@tanstack/react-query";
import { getOrCreateDealRoom } from "@/components/dealRooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContractWizard from "@/components/ContractWizard";
import LoadingAnimation from "@/components/LoadingAnimation";
import ContractLayers from "@/components/ContractLayers";
import DocumentChecklist from "@/components/DocumentChecklist";
import LegalAgreementPanel from "@/components/LegalAgreementPanel";
import { validateImage, validateSafeDocument } from "@/components/utils/fileValidation";
import { PIPELINE_STAGES, normalizeStage, getStageLabel, stageOrder } from "@/components/pipelineStages";
import { 
  Menu, Send, Loader2, ArrowLeft, FileText, Shield, Search, Info, User, Plus, Image, CheckCircle
} from "lucide-react";
import EscrowPanel from "@/components/EscrowPanel";
import { toast } from "sonner";

// Use shared rooms hook with aggressive caching
function useMyRooms() {
  const { data: rooms, isLoading: loading } = useRooms();
  return { 
    rooms: rooms || [], 
    loading: loading && (!rooms || rooms.length === 0) // Only show loading if no cached data
  };
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

    const fetchMessages = async () => {
      try {
        const messages = await base44.entities.Message.filter(
          { room_id: roomId },
          'created_date' // Sort ascending (oldest first)
        );

        if (!cancelled) {
          setItems(prev => {
            // Keep optimistic messages temporarily
            const optimisticMessages = prev.filter(m => m._isOptimistic);

            // Remove optimistic messages that match new real messages
            const activeOptimistic = optimisticMessages.filter(opt => {
              return !messages.some(real => 
                real.body === opt.body && 
                real.sender_profile_id === opt.sender_profile_id &&
                Math.abs(new Date(real.created_date) - new Date(opt.created_date)) < 5000
              );
            });

            // Create a map of all real message IDs for deduplication
            const realMessageIds = new Set(messages.map(m => m.id));

            // Combine real messages + active optimistic, remove duplicates by ID
            const combined = [...messages, ...activeOptimistic];
            const seen = new Set();
            const deduplicated = combined.filter(m => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });

            // Sort by created_date
            return deduplicated.sort(
              (a, b) => new Date(a.created_date) - new Date(b.created_date)
            );
          });
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
      finally { if (!cancelled) setLoading(false); }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
    return () => { cancelled = true; clearInterval(interval); };
  }, [roomId]);

  return { items, loading, setItems, messagesEndRef };
}

// Memoized sidebar header to prevent flickering
const SidebarHeader = React.memo(({ onSearchChange, searchValue }) => {
  return (
    <div className="p-5 border-b border-[#1F1F1F]">
      <div className="flex items-center gap-3 mb-5">
        <Logo size="default" showText={false} linkTo={createPageUrl("Dashboard")} />
        <h2 className="text-xl font-bold text-[#E3C567]">Messages</h2>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
        <Input
          placeholder="Search conversations..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 pl-11 rounded-full bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] focus:border-[#E3C567] focus:ring-[#E3C567]/20"
        />
      </div>
    </div>
  );
});

// Memoized conversation item to prevent flickering
const ConversationItem = React.memo(({ room, isActive, onClick, userRole }) => {
  // Determine if agent can see full address (check if agreement is fully signed)
  const canSeeFullAddress = userRole === 'investor' || room.is_fully_signed;
  
  return (
    <button
      onClick={onClick}
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
        {/* Show price and city for agents, or full name for investors ONLY AFTER FULLY SIGNED */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-[15px] font-semibold text-[#FAFAFA] truncate">
            {userRole === 'agent' && room.budget > 0 && room.city 
              ? `$${room.budget.toLocaleString()} • ${room.city}`
              : room.is_fully_signed 
              ? (room.counterparty_name || `Room ${room.id.slice(0, 6)}`)
              : (userRole === 'investor' ? 'Agent' : 'Investor')
            }
          </p>
          <span className="text-xs text-[#808080] flex-shrink-0 ml-2">
            {new Date(room.created_date || Date.now()).toLocaleDateString()}
          </span>
        </div>
        
        {/* Location line - show city/state for agents until signed, full address for investors */}
        {(room.city || room.property_address) && (
          <p className="text-sm text-[#E3C567] truncate font-medium">
            {canSeeFullAddress 
              ? (room.property_address || room.deal_title || room.title)
              : `${room.city || 'City'}, ${room.state || 'State'}`
            }
          </p>
        )}
        
        {/* Deal Budget - only show if not already in title */}
        {userRole === 'investor' && room.budget > 0 && (
          <p className="text-sm text-[#34D399] font-semibold mt-0.5">
            ${room.budget.toLocaleString()}
          </p>
        )}

        {/* Fallback state */}
        {!room.city && !room.property_address && !room.deal_title && !room.title && !room.budget && (
          <p className="text-sm text-[#808080] truncate">
            {room.counterparty_role || "Active room"}
          </p>
        )}
      </div>
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  const normalize = (val) => val || '';
  
  return (
    prevProps.room.id === nextProps.room.id &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.userRole === nextProps.userRole &&
    normalize(prevProps.room.counterparty_name) === normalize(nextProps.room.counterparty_name) &&
    normalize(prevProps.room.property_address) === normalize(nextProps.room.property_address) &&
    normalize(prevProps.room.city) === normalize(nextProps.room.city) &&
    normalize(prevProps.room.state) === normalize(nextProps.room.state) &&
    normalize(prevProps.room.deal_title) === normalize(nextProps.room.deal_title) &&
    normalize(prevProps.room.title) === normalize(nextProps.room.title) &&
    (prevProps.room.budget || 0) === (nextProps.room.budget || 0) &&
    prevProps.room.is_fully_signed === nextProps.room.is_fully_signed &&
    normalize(prevProps.room.created_date) === normalize(nextProps.room.created_date)
  );
});

export default function Room() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const roomId = params.get("roomId");
  const { profile } = useCurrentProfile();
  const { rooms } = useMyRooms();
  const { items: messages, loading, setItems, messagesEndRef } = useMessages(roomId);
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showEscrow, setShowEscrow] = useState(false);
  const [searchConversations, setSearchConversations] = useState("");
  const [showBoard, setShowBoard] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [deal, setDeal] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [investorTasks, setInvestorTasks] = useState([]);
  const [agentTasks, setAgentTasks] = useState([]);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [agreement, setAgreement] = useState(null);
  
  const loadAgreement = async () => {
    if (currentRoom?.deal_id) {
      try {
        // Reload deal details
        const response = await base44.functions.invoke('getDealDetailsForUser', {
          dealId: currentRoom.deal_id
        });
        if (response.data) setDeal(response.data);
        
        // Load legal agreement
        const params = new URLSearchParams({ deal_id: currentRoom.deal_id });
        const agreementResponse = await fetch(`/api/functions/getLegalAgreement?${params}`, {
          headers: { 'Authorization': `Bearer ${await base44.auth.getAccessToken()}` }
        });
        const agreementData = await agreementResponse.json();
        if (agreementData.agreement) {
          setAgreement(agreementData.agreement);
        }
      } catch (error) {
        console.error('Failed to reload deal:', error);
      }
    }
  };
  
  // Load agreement on mount and when deal changes or cache buster
  useEffect(() => {
    if (currentRoom?.deal_id) {
      loadAgreement();
    }
  }, [currentRoom?.deal_id, location.search]); // Reload when URL params change (after DocuSign return)

  // Fetch current room with server-side access control
  useEffect(() => {
    if (!roomId) return;
    
    const fetchCurrentRoom = async () => {
      setRoomLoading(true);
      try {
        const roomData = await base44.entities.Room.filter({ id: roomId });
        if (roomData && roomData.length > 0) {
          const room = roomData[0];
          
          // Use server-side access-controlled deal fetch
          if (room.deal_id) {
            try {
              const response = await base44.functions.invoke('getDealDetailsForUser', {
                dealId: room.deal_id
              });
              const deal = response.data;
              
              if (deal) {
                setDeal(deal); // Store redacted deal separately
                
                // Redact title for agents if not fully signed
                const displayTitle = profile?.user_role === 'agent' && !deal.is_fully_signed
                  ? `${deal.city || 'City'}, ${deal.state || 'State'}`
                  : deal.title;
                
                setCurrentRoom({
                  ...room,
                  title: displayTitle,
                  property_address: deal.property_address, // Already redacted by server
                  city: deal.city,
                  state: deal.state,
                  county: deal.county,
                  zip: deal.zip,
                  budget: deal.purchase_price,
                  pipeline_stage: deal.pipeline_stage,
                  closing_date: deal.key_dates?.closing_date,
                  deal_assigned_agent_id: deal.agent_id,
                  is_fully_signed: deal.is_fully_signed
                });
              } else {
                setCurrentRoom(room);
              }
            } catch (error) {
              console.error('Failed to fetch deal (access denied?):', error);
              setCurrentRoom(room);
            }
          } else {
            setCurrentRoom(room);
          }
        }
      } catch (error) {
        console.error('Failed to fetch room:', error);
      } finally {
        setRoomLoading(false);
      }
    };
    
    fetchCurrentRoom();
  }, [roomId]);

  const counterpartName = currentRoom?.counterparty_name || location.state?.initialCounterpartyName || "Chat";
  
  // Robust agent profile ID - check multiple sources
  const roomAgentProfileId =
    currentRoom?.agentId ||
    (currentRoom?.counterparty_role === 'agent' ? currentRoom?.counterparty_profile?.id : null) ||
    null;

  // Enforce exclusivity: redirect if trying to access non-active room for same deal
  useEffect(() => {
    if (!currentRoom || !profile) return;

    const dealId = currentRoom.deal_id;
    if (!dealId || profile.user_role !== 'investor') return;

    // Check if there's another room for this deal that's accepted/signed
    const checkExclusivity = async () => {
      try {
        const allRooms = await base44.entities.Room.filter({ deal_id: dealId });
        const activeRoom = allRooms.find(r => 
        r.request_status === 'accepted' && r.id !== roomId
        );

        if (activeRoom) {
          toast.error("Redirecting to active deal room");
          navigate(`${createPageUrl("Room")}?roomId=${activeRoom.id}`, { replace: true });
        }
      } catch (error) {
        console.error("Failed to check exclusivity:", error);
      }
    };

    checkExclusivity();
  }, [currentRoom, profile, roomId, navigate]);

  const send = async () => {
    const t = text.trim();
    if (!t || !roomId || sending) return;
    setText("");
    setSending(true);
    
    // Optimistic update - show message immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      room_id: roomId,
      sender_profile_id: profile?.id,
      body: t,
      created_date: new Date().toISOString(),
      _isOptimistic: true
    };
    setItems(prev => [...prev, optimisticMessage]);
    
    try {
      const response = await base44.functions.invoke('sendMessage', { 
        room_id: roomId, 
        body: t 
      });
      
      // Check for contact info violation
      if (response.data?.violations) {
        setItems(prev => prev.filter(m => m.id !== tempId));
        toast.error(response.data.error || 'Message blocked: Please do not share contact info until agreement is signed.');
        setSending(false);
        return;
      }
      
      if (!response.data?.ok) {
        throw new Error(response.data?.error || 'Message send failed');
      }
      
      // Log activity - async without blocking
      if (currentRoom?.deal_id) {
        base44.entities.Activity.create({
          type: 'message_sent',
          deal_id: currentRoom.deal_id,
          room_id: roomId,
          actor_id: profile?.id,
          actor_name: profile?.full_name || profile?.email,
          message: `${profile?.full_name || profile?.email} sent a message`
        }).catch(() => {}); // Silent fail - activity is nice-to-have
      }
      
      // Remove optimistic message immediately after successful send
      setItems(prev => prev.filter(m => m.id !== tempId));
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(`Failed to send: ${error.message}`);
      setItems(prev => prev.filter(m => m.id !== tempId));
    } finally { 
      setSending(false);
    }
  };

  // Removed - old lock-in logic replaced by request/accept/sign flow

  const generateTasks = async () => {
    if (!roomId || generatingTasks) return;
    
    setGeneratingTasks(true);
    try {
      // Get recent chat messages for context
      const recentMessages = messages.slice(-20).map(m => 
        `${m.sender_profile_id === profile?.id ? 'You' : 'Other'}: ${m.body}`
      ).join('\n');
      
      const dealContext = `
Property: ${currentRoom?.property_address || 'N/A'}
Price: $${(currentRoom?.budget || 0).toLocaleString()}
Stage: ${currentRoom?.pipeline_stage || 'new_deal_under_contract'}
Closing Date: ${currentRoom?.closing_date || 'TBD'}
Agent Locked: ${currentRoom?.deal_assigned_agent_id === roomAgentProfileId ? 'Yes' : 'No'}

Recent conversation:
${recentMessages || 'No messages yet'}
`;

      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      const investorPrompt = `Based on this real estate deal and conversation, generate 3-4 actionable next steps for the INVESTOR. Be specific and realistic. 
Use RELATIVE dates only (e.g., "Today", "Tomorrow", "This Week", "Next Monday", "By end of week") - DO NOT use specific calendar dates.
Today's date is ${today}.
Return as JSON array of objects with "label" and "due" fields.

${dealContext}`;

      const agentPrompt = `Based on this real estate deal and conversation, generate 3-4 actionable tasks for the AGENT working this deal today. Be specific and realistic.
Use RELATIVE dates only (e.g., "Today", "Tomorrow", "This Week", "Next Monday", "By end of week") - DO NOT use specific calendar dates.
Today's date is ${today}.
Return as JSON array of objects with "label" and "due" fields.

${dealContext}`;

      const [investorResponse, agentResponse] = await Promise.all([
        base44.integrations.Core.InvokeLLM({
          prompt: investorPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    due: { type: "string" }
                  }
                }
              }
            }
          }
        }),
        base44.integrations.Core.InvokeLLM({
          prompt: agentPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    due: { type: "string" }
                  }
                }
              }
            }
          }
        })
      ]);

      setInvestorTasks(investorResponse.tasks || []);
      setAgentTasks(agentResponse.tasks || []);
      toast.success('Tasks updated based on conversation');
    } catch (error) {
      console.error('Failed to generate tasks:', error);
      toast.error('Failed to generate tasks');
    } finally {
      setGeneratingTasks(false);
    }
  };

  // Generate tasks on first load if we have messages
  useEffect(() => {
    if (messages.length > 0 && investorTasks.length === 0 && agentTasks.length === 0 && !generatingTasks) {
      generateTasks();
    }
  }, [messages.length]);

  // Memoize filtered rooms to prevent unnecessary recalculations
  const filteredRooms = useMemo(() => {
    return (rooms || []).filter(r => {
      // Only show real conversations with valid counterparty
      if (r.is_orphan) return false;
      if (!r.counterparty_name || r.counterparty_name === 'Unknown') return false;
      
      if (!searchConversations) return true;
      return r.counterparty_name?.toLowerCase().includes(searchConversations.toLowerCase());
    });
  }, [rooms, searchConversations]);

  return (
    <div className="fixed inset-0 bg-transparent flex overflow-hidden">
      {/* Left Sidebar - Conversation List */}
      <div 
        className={`fixed inset-y-0 left-0 w-[320px] bg-[#0D0D0D] border-r border-[#1F1F1F] z-40 transform transition-transform shadow-xl ${
          drawer ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 flex flex-col`}
      >
        {/* Sidebar Header */}
        <SidebarHeader 
          searchValue={searchConversations}
          onSearchChange={setSearchConversations}
        />

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.map(r => {
            const handleClick = () => {
              navigate(`${createPageUrl("Room")}?roomId=${r.id}`);
              setDrawer(false);
            };
            
            return (
              <ConversationItem
                key={r.id}
                room={r}
                isActive={r.id === roomId}
                onClick={handleClick}
                userRole={profile?.user_role}
              />
            );
          })}
        </div>
      </div>

      {/* Right Main Area - Active Conversation */}
      <div className="flex-1 md:ml-[320px] flex flex-col bg-black overflow-hidden">
        {/* Conversation Header */}
        <div className="h-18 border-b border-[#1F1F1F] flex items-center px-5 bg-[#0D0D0D] shadow-sm flex-shrink-0 z-10">
          <button 
            className="mr-4 md:hidden text-[#6B7280] hover:text-[#111827] transition-colors"
            onClick={() => setDrawer(s => !s)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <Button
            onClick={() => navigate(createPageUrl("Pipeline"))}
            variant="outline"
            className="mr-4 bg-[#0D0D0D] border-[#1F1F1F] hover:border-[#E3C567] hover:bg-[#141414] text-[#FAFAFA] rounded-full flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Pipeline</span>
          </Button>
          
          {/* Avatar */}
          <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center mr-4 shadow-sm">
            <User className="w-6 h-6 text-[#E3C567]" />
          </div>
          
          {/* Name and Status */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#FAFAFA]">
              {currentRoom?.is_fully_signed ? counterpartName : (profile?.user_role === 'agent' ? 'Investor' : 'Agent')}
            </h2>
            <div className="flex items-center gap-3">
              {currentRoom?.is_fully_signed ? (
                <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Working Together
                </span>
              ) : currentRoom?.request_status === 'accepted' ? (
                <span className="bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 px-3 py-1 rounded-full text-xs font-medium">
                  Awaiting Agreement Signatures
                </span>
              ) : currentRoom?.request_status === 'requested' ? (
                <span className="bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 px-3 py-1 rounded-full text-xs font-medium">
                  Pending Response
                </span>
              ) : (
                <span className="bg-[#1F1F1F] text-[#808080] border border-[#333] px-2 py-0.5 rounded text-xs">
                  No Status
                </span>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {profile?.user_role === 'investor' && (roomAgentProfileId || currentRoom?.agentId || currentRoom?.counterparty_profile_id) && (
              <Button
                onClick={() => {
                  const agentId = roomAgentProfileId || currentRoom?.agentId || currentRoom?.counterparty_profile_id;
                  navigate(`${createPageUrl("AgentProfile")}?id=${agentId}${currentRoom?.deal_id ? `&dealId=${currentRoom.deal_id}` : ''}${roomId ? `&roomId=${roomId}` : ''}`);
                }}
                className="bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA] rounded-full font-semibold border border-[#333] hover:border-[#E3C567]"
              >
                <User className="w-4 h-4 mr-2" />
                Agent Profile
              </Button>
            )}
            
            {roomId && (
              <Button
                onClick={() => setShowBoard(!showBoard)}
                className={`rounded-full font-semibold transition-all ${
                  showBoard 
                    ? "bg-[#E3C567] hover:bg-[#EDD89F] text-black" 
                    : "bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
                }`}
              >
                <FileText className="w-4 h-4 mr-2" />
                Deal Board
              </Button>
            )}
          </div>
        </div>

        {/* Persistent Deal Header */}
        {!showBoard && currentRoom && ( // ONLY SHOW WHEN NOT ON DEAL BOARD
          <div className="bg-[#111111] border-b border-[#1F1F1F] py-3 px-6 flex flex-col items-center justify-center shadow-md flex-shrink-0 z-10">
            {roomLoading ? (
              <div className="animate-pulse flex items-center gap-2">
                <div className="h-3 w-3 bg-[#333] rounded-full"></div>
                <div className="h-4 w-48 bg-[#333] rounded"></div>
              </div>
            ) : (
              <>
                {/* Row 1: Status & Title */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${
                    currentRoom?.is_fully_signed ? 'bg-[#10B981]' : 
                    currentRoom?.request_status === 'accepted' ? 'bg-[#60A5FA]' : 
                    'bg-[#F59E0B]'
                  }`}></span>
                  <span className="font-bold text-[#FAFAFA] text-sm">
                    {/* Privacy: Hide full address from agents until agreement is fully signed */}
                    {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed
                      ? `${currentRoom.city || 'City'}, ${currentRoom.state || 'State'}`
                      : (currentRoom.title || `Chat with ${counterpartName}`)
                    }
                  </span>
                  <span className="text-[#555] text-xs">•</span>
                  <span className="text-[#808080] text-xs uppercase tracking-wider font-semibold">
                    {currentRoom?.is_fully_signed ? (
                      <span className="text-[#10B981]">Working Together</span>
                    ) : currentRoom?.request_status === 'accepted' ? (
                      <span className="text-[#F59E0B]">Awaiting Agreement Signatures</span>
                    ) : currentRoom?.request_status === 'requested' ? (
                      <span className="text-[#F59E0B]">Request Pending</span>
                    ) : (
                      currentRoom.pipeline_stage ? currentRoom.pipeline_stage.replace(/_/g, ' ') : 'GENERAL'
                    )}
                  </span>
                </div>

                {/* Row 2: Address & Price */}
                <div className="flex items-center gap-3 text-xs opacity-90">
                   <div className="flex items-center gap-1.5 text-[#CCC]">
                     <span>
                       {/* Privacy: Hide full address from agents until internal agreement is fully signed */}
                       {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed
                         ? `${currentRoom.city || 'City'}, ${currentRoom.state || 'State'}`
                         : (currentRoom.property_address || currentRoom.deal_title || currentRoom.title || "No Deal Selected")
                       }
                     </span>
                   </div>

                   {currentRoom.budget > 0 && (
                     <>
                       <span className="text-[#333]">|</span>
                       <span className="text-[#34D399] font-mono font-medium">
                         ${currentRoom.budget.toLocaleString()}
                       </span>
                     </>
                   )}
                   </div>
                   </>
                   )}
          </div>
        )}

        {/* Message Thread or Deal Board - SCROLLABLE MIDDLE */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          {showBoard ? (
            /* Deal Board View with Tabs */
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Tab Navigation */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-2 flex gap-2 overflow-x-auto">
                {[
                  { id: 'details', label: 'Property Details', icon: Info },
                  { id: 'agreement', label: 'My Agreement', icon: Shield },
                  { id: 'files', label: 'Files', icon: FileText },
                  { id: 'photos', label: 'Photos', icon: Image },
                  { id: 'activity', label: 'Events & Activity', icon: FileText }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-[#E3C567] text-black shadow-lg'
                          : 'bg-transparent text-[#808080] hover:bg-[#1F1F1F] hover:text-[#FAFAFA]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Auto-Generate Contract CTA (Investor Only) */}
                  {profile?.user_role === 'investor' && !agreement && currentRoom?.deal_id && (
                    <div className="bg-[#E3C567]/10 border border-[#E3C567]/30 rounded-2xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <Shield className="w-6 h-6 text-[#E3C567]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-[#E3C567] mb-2">
                            Ready to Formalize This Deal?
                          </h4>
                          <p className="text-sm text-[#FAFAFA]/90 mb-4">
                            Generate your Investor-Agent Operating Agreement to lock in terms, unlock full property details, and move forward with confidence.
                          </p>
                          <Button
                            onClick={() => setActiveTab('agreement')}
                            className="bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold rounded-full px-6 py-2.5 flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            Auto-Generate Contract
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Privacy Warning for Agents */}
                  {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-md font-bold text-[#F59E0B] mb-1">
                            {currentRoom?.request_status === 'accepted' 
                              ? 'Limited Access – Sign Agreement to Unlock Full Details' 
                              : 'Limited Access – Accept Request to Enable Chat'
                            }
                          </h4>
                          <p className="text-sm text-[#FAFAFA]/80">
                            {currentRoom?.request_status === 'accepted'
                              ? 'Full property address and seller details will be visible after both parties sign the agreement.'
                              : 'Accept this deal request to enable chat and view limited deal information. Full details unlock after signing the agreement.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                              {profile?.user_role === 'investor' ? (
                                /* INVESTOR DEAL BOARD */
                                <>
                                  {/* 1. DEAL HEADER */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <div className="flex items-start justify-between mb-4">
                                      <div className="flex-1">
                                        <h3 className="text-2xl font-bold text-[#E3C567] mb-2">
                                          {currentRoom?.property_address || 'Property Address'}
                                        </h3>
                                        <p className="text-sm text-[#808080] mb-3">
                          {[currentRoom?.city, currentRoom?.state].filter(Boolean).join(', ') || 'Location'}
                                        </p>
                                        <div className="text-3xl font-bold text-[#34D399] mb-4">
                                          ${(currentRoom?.budget || 0).toLocaleString()}
                                        </div>
                                        {currentRoom?.deal_assigned_agent_id === roomAgentProfileId ? (
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
                                              <User className="w-5 h-5 text-[#E3C567]" />
                                            </div>
                                            <div>
                                              <p className="text-xs text-[#808080] uppercase tracking-wider">Your Agent</p>
                                              <p className="text-sm font-semibold text-[#FAFAFA]">
                                                {currentRoom?.counterparty_name || 'Agent Name'}
                                              </p>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#808080]/20 rounded-full flex items-center justify-center">
                                              <User className="w-5 h-5 text-[#808080]" />
                                            </div>
                                            <div>
                                              <p className="text-xs text-[#808080] uppercase tracking-wider">Your Agent</p>
                                              <p className="text-sm font-semibold text-[#808080]">
                                                No agent selected
                                              </p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-shrink-0">
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">
                                          {currentRoom?.pipeline_stage ? currentRoom.pipeline_stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'New Deal'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 2. DEAL PROGRESS */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Deal Progress</h4>
                                    <div className="space-y-3">
                                      {PIPELINE_STAGES.map((stage, idx) => {
                                        const normalizedCurrent = normalizeStage(currentRoom?.pipeline_stage);
                                        const isActive = normalizedCurrent === stage.id;
                                        const currentOrder = stageOrder(normalizedCurrent);
                                        const isPast = stage.order < currentOrder;

                                        const stageColor = stage.id === 'new_listings' ? '#E3C567' :
                                                         stage.id === 'active_listings' ? '#60A5FA' :
                                                         stage.id === 'ready_to_close' ? '#34D399' :
                                                         '#EF4444';

                                        return (
                                          <div key={stage.id} className="flex items-center gap-3">
                                            <div 
                                              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                                isActive 
                                                  ? 'ring-2 ring-offset-2 ring-offset-black' 
                                                  : isPast 
                                                  ? 'bg-[#34D399]' 
                                                  : 'bg-[#1F1F1F]'
                                              }`}
                                              style={isActive ? { backgroundColor: stageColor, ringColor: stageColor } : {}}
                                            >
                                              <span className="text-sm font-bold text-white">
                                                {isPast ? '✓' : stage.order}
                                              </span>
                                            </div>
                                            <div className="flex-1">
                                              <p className={`text-sm font-medium ${
                                                isActive ? 'text-[#FAFAFA]' : isPast ? 'text-[#808080]' : 'text-[#666666]'
                                              }`}>
                                                {stage.label}
                                              </p>
                                              {isActive && (
                                                <p className="text-xs text-[#E3C567]">Current Stage</p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* 3. AI DEAL SUMMARY */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-3">Deal Summary</h4>
                                    <p className="text-sm text-[#FAFAFA] leading-relaxed">
                                      This is a single-family residential property located in {currentRoom?.city || 'your target market'}. 
                                      {currentRoom?.deal_assigned_agent_id === roomAgentProfileId ? (
                                        <>Your agent {currentRoom?.counterparty_name} is currently working on the initial walkthrough and evaluation. </>
                                      ) : (
                                        <>You are currently exploring this deal and selecting an agent. </>
                                      )}
                                      The property is under contract at ${(currentRoom?.budget || 0).toLocaleString()} with an estimated closing date of {currentRoom?.closing_date ? new Date(currentRoom.closing_date).toLocaleDateString() : 'TBD'}. 
                                      {currentRoom?.deal_assigned_agent_id === roomAgentProfileId ? (
                                        <>Next steps include completing the property inspection and finalizing financing details.</>
                                      ) : (
                                        <>Review the deal details and lock in an agent to proceed with the transaction.</>
                                      )}
                                    </p>
                                  </div>

                                  {/* 4. NEXT STEPS FOR YOU */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="text-lg font-semibold text-[#FAFAFA]">Next Steps For You</h4>
                                      <Button
                                        size="sm"
                                        disabled={generatingTasks}
                                        onClick={generateTasks}
                                        className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs"
                                      >
                                        {generatingTasks ? (
                                          <>
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                            Updating...
                                          </>
                                        ) : (
                                          'Refresh Tasks'
                                        )}
                                      </Button>
                                    </div>
                                    <div className="space-y-3">
                                      {investorTasks.length > 0 ? investorTasks.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F] hover:border-[#E3C567]/30 transition-all">
                                          <input 
                                            type="checkbox" 
                                            className="mt-0.5 w-4 h-4 rounded border-[#1F1F1F] bg-[#0D0D0D] text-[#E3C567] focus:ring-[#E3C567] focus:ring-offset-0"
                                          />
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-[#FAFAFA]">{item.label}</p>
                                            <p className="text-xs text-[#808080] mt-0.5">{item.due}</p>
                                          </div>
                                        </div>
                                      )) : (
                                        <p className="text-sm text-[#808080] text-center py-4">
                                          {generatingTasks ? 'Generating tasks...' : 'Click "Refresh Tasks" to generate action items'}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* 5. DEAL DETAILS */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
                                      <Info className="w-5 h-5 text-[#E3C567]" />
                                      Deal Details
                                    </h4>
                                    <div className="space-y-3">
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Property</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">{currentRoom?.property_address || '—'}</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Price / Budget</span>
                                        <span className="text-sm text-[#34D399] font-semibold">${(currentRoom?.budget || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Agent</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">{currentRoom?.counterparty_name || '—'}</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Walkthrough</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">TBD</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Closing Date</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {currentRoom?.closing_date ? new Date(currentRoom.closing_date).toLocaleDateString() : 'TBD'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2">
                                        <span className="text-sm text-[#808080]">Deal Started</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {new Date(currentRoom?.created_date || Date.now()).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                /* AGENT DEAL BOARD */
                                <>
                                  {/* 1. Deal Header (agent version) */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <div className="flex items-start justify-between mb-4">
                                      <div className="flex-1">
                                        <h3 className="text-2xl font-bold text-[#E3C567] mb-2">
                                          {/* Privacy: Hide full address from agents until internal agreement is fully signed */}
                                          {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed
                                            ? `Deal in ${currentRoom?.city || 'City'}, ${currentRoom?.state || 'State'}`
                                            : (currentRoom?.property_address || 'Property Address')
                                          }
                                        </h3>
                                        <p className="text-sm text-[#808080] mb-3">
                                          {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed
                                            ? `${currentRoom?.county ? currentRoom.county + ' County, ' : ''}${currentRoom?.city}, ${currentRoom?.state} ${currentRoom?.zip || ''}`
                                            : ([currentRoom?.city, currentRoom?.state].filter(Boolean).join(', ') || 'Location')
                                          }
                                        </p>
                                        <div className="text-3xl font-bold text-[#34D399] mb-4">
                                          ${(currentRoom?.budget || 0).toLocaleString()}
                                        </div>
                                        <div className="flex items-center gap-3 mb-2">
                                          <div className="w-10 h-10 bg-[#60A5FA]/20 rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5 text-[#60A5FA]" />
                                          </div>
                                          <div>
                                            <p className="text-xs text-[#808080] uppercase tracking-wider">Investor</p>
                                            <p className="text-sm font-semibold text-[#FAFAFA]">
                                              {currentRoom?.is_fully_signed 
                                                ? (currentRoom?.counterparty_name || 'Loading...')
                                                : 'Hidden until agreement signed'
                                              }
                                            </p>
                                          </div>
                                        </div>
                                        <p className="text-xs text-[#808080]">
                                          Days in stage: {Math.floor((Date.now() - new Date(currentRoom?.created_date || Date.now())) / (1000 * 60 * 60 * 24))}
                                        </p>
                                      </div>
                                      <div className="flex-shrink-0">
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">
                                          {currentRoom?.pipeline_stage ? currentRoom.pipeline_stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'New Deal'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 2. Deal Progress (agent controls) */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-3">Deal Progress</h4>
                                    <p className="text-xs text-[#808080] mb-4">Click to change stage</p>
                                    <div className="space-y-3">
                                      {PIPELINE_STAGES.map((stage, idx) => {
                                        const normalizedCurrent = normalizeStage(currentRoom?.pipeline_stage);
                                        const isActive = normalizedCurrent === stage.id;
                                        const currentOrder = stageOrder(normalizedCurrent);
                                        const isPast = stage.order < currentOrder;

                                        const stageColor = stage.id === 'new_listings' ? '#E3C567' :
                                                         stage.id === 'active_listings' ? '#60A5FA' :
                                                         stage.id === 'ready_to_close' ? '#34D399' :
                                                         '#EF4444';

                                        return (
                                          <button
                                            key={stage.id}
                                            onClick={async () => {
                                              if (currentRoom?.deal_id) {
                                                try {
                                                  await base44.entities.Deal.update(currentRoom.deal_id, {
                                                    pipeline_stage: stage.id
                                                  });
                                                  setCurrentRoom({ ...currentRoom, pipeline_stage: stage.id });
                                                  toast.success(`Deal moved to ${stage.label}`);
                                                  queryClient.invalidateQueries({ queryKey: ['rooms'] });
                                                } catch (error) {
                                                  toast.error('Failed to update stage');
                                                }
                                              }
                                            }}
                                            className="flex items-center gap-3 w-full text-left hover:bg-[#141414] p-2 rounded-lg transition-colors"
                                          >
                                            <div 
                                              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                                isActive 
                                                  ? 'ring-2 ring-offset-2 ring-offset-black' 
                                                  : isPast 
                                                  ? 'bg-[#34D399]' 
                                                  : 'bg-[#1F1F1F]'
                                              }`}
                                              style={isActive ? { backgroundColor: stageColor, ringColor: stageColor } : {}}
                                            >
                                              <span className="text-sm font-bold text-white">
                                                {isPast ? '✓' : stage.order}
                                              </span>
                                            </div>
                                            <div className="flex-1">
                                              <p className={`text-sm font-medium ${
                                                isActive ? 'text-[#FAFAFA]' : isPast ? 'text-[#808080]' : 'text-[#666666]'
                                              }`}>
                                                {stage.label}
                                              </p>
                                              {isActive && (
                                                <p className="text-xs text-[#E3C567]">Current Stage</p>
                                              )}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* 3. Today for This Deal */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="text-lg font-semibold text-[#FAFAFA]">Today for This Deal</h4>
                                      <Button
                                        size="sm"
                                        disabled={generatingTasks}
                                        onClick={generateTasks}
                                        className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs"
                                      >
                                        {generatingTasks ? (
                                          <>
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                            Updating...
                                          </>
                                        ) : (
                                          'Refresh Tasks'
                                        )}
                                      </Button>
                                    </div>
                                    <div className="space-y-2">
                                      {agentTasks.length > 0 ? agentTasks.map((task, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                                          <input 
                                            type="checkbox"
                                            className="mt-0.5 w-4 h-4 rounded border-[#1F1F1F] bg-[#0D0D0D] text-[#E3C567] focus:ring-[#E3C567] focus:ring-offset-0"
                                          />
                                          <div className="flex-1">
                                            <p className="text-sm text-[#FAFAFA]">{task.label}</p>
                                            <p className="text-xs text-[#808080] mt-0.5">{task.due}</p>
                                          </div>
                                        </div>
                                      )) : (
                                        <p className="text-sm text-[#808080] text-center py-4">
                                          {generatingTasks ? 'Generating tasks...' : 'Click "Refresh Tasks" to generate action items'}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* 4. Appointments & Walkthroughs */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="text-lg font-semibold text-[#FAFAFA]">Appointments & Walkthroughs</h4>
                                      <Button
                                        size="sm"
                                        className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs"
                                        onClick={() => toast.info('Add appointment feature coming soon')}
                                      >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Add
                                      </Button>
                                    </div>
                                    <div className="space-y-3">
                                      {[
                                        { date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), time: '10:00 AM', type: 'Walkthrough', note: 'Initial property tour with investor' },
                                        { date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), time: '2:00 PM', type: 'Inspection', note: 'Home inspection scheduled' }
                                      ].map((appt, idx) => (
                                        <div key={idx} className="p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                                          <div className="flex items-start justify-between mb-2">
                                            <div>
                                              <p className="text-sm font-semibold text-[#FAFAFA]">{appt.type}</p>
                                              <p className="text-xs text-[#808080]">{appt.date} at {appt.time}</p>
                                            </div>
                                            <span className="text-xs bg-[#E3C567]/20 text-[#E3C567] px-2 py-1 rounded border border-[#E3C567]/30">
                                              Upcoming
                                            </span>
                                          </div>
                                          <p className="text-xs text-[#FAFAFA]">{appt.note}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* 5. Agent Notes (Private) */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
                                        Agent Notes
                                        <span className="text-xs bg-[#EF4444]/20 text-[#EF4444] px-2 py-0.5 rounded border border-[#EF4444]/30">
                                          PRIVATE
                                        </span>
                                      </h4>
                                    </div>
                                    <textarea
                                      placeholder="Add private notes about this deal (only visible to you)..."
                                      className="w-full h-32 p-3 bg-[#141414] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] text-sm focus:border-[#E3C567] focus:ring-1 focus:ring-[#E3C567] resize-none"
                                      defaultValue=""
                                    />
                                    <Button
                                      size="sm"
                                      className="mt-3 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                                      onClick={() => toast.success('Notes saved (demo)')}
                                    >
                                      Save Notes
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
              )}

              {activeTab === 'agreement' && (
                <div className="space-y-6">
                  {/* Anti-Circumvention Notice */}
                  {!agreement && (
                    <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-[#60A5FA] mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-md font-bold text-[#60A5FA] mb-1">
                            Platform Protection Notice
                          </h4>
                          <p className="text-sm text-[#FAFAFA]/80">
                            To protect both parties, sharing contact information (emails, phone numbers, social handles) is restricted in chat until the agreement is signed. This ensures fair compensation and platform integrity.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* LegalAgreement Panel (v1.0.1) */}
                  {currentRoom?.deal_id && deal && (
                    <LegalAgreementPanel
                      deal={deal}
                      profile={profile}
                      onUpdate={() => {
                        loadAgreement();
                        queryClient.invalidateQueries({ queryKey: ['rooms'] });
                        queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
                      }}
                    />
                  )}
                  
                  {/* Agreement Status Info - Use live agreement data if available */}
                  {agreement && (
                    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
                          <Shield className="w-5 h-5 text-[#E3C567]" />
                          Agreement Status
                        </h4>
                        {agreement.status === 'fully_signed' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                            ✓ Fully Signed
                          </span>
                        ) : agreement.status === 'sent' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-[#60A5FA]/20 text-[#60A5FA] border border-[#60A5FA]/30">
                            Pending Signatures
                          </span>
                        ) : agreement.status === 'investor_signed' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">
                            Awaiting Agent
                          </span>
                        ) : agreement.status === 'agent_signed' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">
                            Awaiting Investor
                          </span>
                        ) : agreement.status === 'attorney_review_pending' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30">
                            Attorney Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-[#808080]/20 text-[#808080] border border-[#808080]/30">
                            Draft
                          </span>
                        )}
                      </div>
                      
                      {/* Status-specific messaging */}
                      {agreement.status === 'investor_signed' && (
                        <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 mb-4">
                          <p className="text-sm font-semibold text-[#60A5FA]">
                            {profile?.user_role === 'investor' 
                              ? 'You signed! Waiting for agent signature.'
                              : 'Investor signed - your turn to sign!'}
                          </p>
                        </div>
                      )}
                      
                      {agreement.status === 'agent_signed' && (
                        <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 mb-4">
                          <p className="text-sm font-semibold text-[#60A5FA]">
                            {profile?.user_role === 'agent'
                              ? 'You signed! Waiting for investor signature.'
                              : 'Agent signed - your turn to sign!'}
                          </p>
                        </div>
                      )}
                      
                      {agreement.status === 'fully_signed' && (
                        <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 mb-4">
                          <CheckCircle className="w-6 h-6 text-[#10B981] mx-auto mb-2" />
                          <p className="text-sm font-semibold text-[#10B981] text-center">Agreement Fully Signed</p>
                          <p className="text-xs text-[#808080] mt-1 text-center">Both parties have signed. Full details are now available.</p>
                        </div>
                      )}
                      
                      <p className="text-sm text-[#808080]">
                        See full agreement details in the Agreement tab above.
                      </p>
                    </div>
                  )}

                  {/* Key Terms */}
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <h5 className="text-md font-semibold text-[#FAFAFA] mb-4">Key Terms</h5>
                    <div className="space-y-4">
                      {/* Purchase Price */}
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#808080]">Purchase Price</p>
                          <p className="text-lg font-bold text-[#34D399] mt-1">
                            {currentRoom?.budget ? `$${currentRoom.budget.toLocaleString()}` : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Earnest Money */}
                      {deal?.seller_info?.earnest_money && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#808080]">Earnest Money</p>
                            <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                              ${deal.seller_info.earnest_money.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Closing Date */}
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#808080]">Target Closing Date</p>
                          <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                            {currentRoom?.closing_date ? new Date(currentRoom.closing_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}
                          </p>
                        </div>
                      </div>

                      {/* Seller's Agent Commission */}
                      {currentRoom?.proposed_terms?.seller_commission_type && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#808080]">Seller's Agent Compensation</p>
                            <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                              {currentRoom.proposed_terms.seller_commission_type === 'percentage' 
                                ? `${currentRoom.proposed_terms.seller_commission_percentage}% of purchase price`
                                : `$${currentRoom.proposed_terms.seller_flat_fee?.toLocaleString()} flat fee`
                              }
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Buyer's Agent Commission */}
                      {currentRoom?.proposed_terms?.buyer_commission_type && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#808080]">Buyer's Agent Compensation</p>
                            <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                              {currentRoom.proposed_terms.buyer_commission_type === 'percentage' 
                                ? `${currentRoom.proposed_terms.buyer_commission_percentage}% of purchase price`
                                : `$${currentRoom.proposed_terms.buyer_flat_fee?.toLocaleString()} flat fee`
                              }
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Signers - Privacy Protected */}
                      {deal?.seller_info?.seller_name && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#808080]">
                              Seller ({deal.seller_info.number_of_signers === '2' ? '2 Signers' : '1 Signer'})
                            </p>
                            {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed ? (
                              <p className="text-sm text-[#F59E0B] mt-1">Hidden until agreement fully signed</p>
                            ) : (
                              <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                                {deal.seller_info.seller_name}
                                {deal.seller_info.number_of_signers === '2' && deal.seller_info.second_signer_name && (
                                  <span className="text-[#808080]"> & {deal.seller_info.second_signer_name}</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Special Notes */}
                  {deal?.special_notes && (
                    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                      <h5 className="text-md font-semibold text-[#FAFAFA] mb-3">Special Notes</h5>
                      <p className="text-sm text-[#FAFAFA] leading-relaxed whitespace-pre-wrap">
                        {deal.special_notes}
                      </p>
                    </div>
                  )}

                  {/* Empty State */}
                  {!currentRoom?.budget && !currentRoom?.proposed_terms && (
                    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
                      <Shield className="w-12 h-12 text-[#808080] mx-auto mb-4 opacity-50" />
                      <p className="text-sm text-[#808080]">
                        No agreement terms available yet. Terms will appear once deal details are finalized.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'files' && (
                <div className="space-y-6">
                  {/* Contract Section */}
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <ContractLayers 
                      room={currentRoom} 
                      deal={deal}
                      onUpdate={() => {
                        const fetchCurrentRoom = async () => {
                          const roomData = await base44.entities.Room.filter({ id: roomId });
                          if (roomData && roomData.length > 0) {
                            const room = roomData[0];
                            if (room.deal_id) {
                              try {
                                const response = await base44.functions.invoke('getDealDetailsForUser', {
                                  dealId: room.deal_id
                                });
                                const deal = response.data;
                                if (deal) {
                                  setDeal(deal);
                                  setCurrentRoom({
                                    ...room,
                                    title: deal.title,
                                    property_address: deal.property_address,
                                    city: deal.city,
                                    state: deal.state,
                                    county: deal.county,
                                    zip: deal.zip,
                                    budget: deal.purchase_price,
                                    pipeline_stage: deal.pipeline_stage,
                                    closing_date: deal.key_dates?.closing_date,
                                    deal_assigned_agent_id: deal.agent_id,
                                    is_fully_signed: deal.is_fully_signed
                                  });
                                }
                              } catch (error) {
                                console.error('Failed to fetch deal:', error);
                              }
                            }
                          }
                        };
                        fetchCurrentRoom();
                      }}
                      userRole={profile?.user_role}
                    />
                  </div>

                  {/* Document Checklist */}
                  <DocumentChecklist 
                    deal={deal}
                    userRole={profile?.user_role}
                    onUpdate={() => {
                      const fetchDeal = async () => {
                        if (currentRoom?.deal_id) {
                          try {
                            const response = await base44.functions.invoke('getDealDetailsForUser', {
                              dealId: currentRoom.deal_id
                            });
                            if (response.data) setDeal(response.data);
                          } catch (error) {
                            console.error('Failed to fetch deal:', error);
                          }
                        }
                      };
                      fetchDeal();
                    }}
                  />

                  {/* Shared Files Section */}
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-[#FAFAFA]">Shared Files</h4>
                      <Button
                        onClick={async () => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.onchange = async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;

                            // Validate file before upload
                            const validation = validateSafeDocument(file);
                            if (!validation.valid) {
                              toast.error(validation.error);
                              return;
                            }
                            
                            toast.info('Uploading file...');
                            try {
                              const { file_url } = await base44.integrations.Core.UploadFile({ file });
                              const files = currentRoom?.files || [];
                              await base44.entities.Room.update(roomId, {
                                files: [...files, {
                                  name: file.name,
                                  url: file_url,
                                  uploaded_by: profile?.id,
                                  uploaded_by_name: profile?.full_name || profile?.email,
                                  uploaded_at: new Date().toISOString(),
                                  size: file.size,
                                  type: file.type
                                }]
                              });
                              
                              // Refresh room
                              const roomData = await base44.entities.Room.filter({ id: roomId });
                              if (roomData?.[0]) setCurrentRoom({ ...currentRoom, files: roomData[0].files });
                              toast.success('File uploaded');
                            } catch (error) {
                              toast.error('Upload failed');
                            }
                          };
                          input.click();
                        }}
                        className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Upload File
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {(currentRoom?.files || []).length === 0 ? (
                        <div className="text-center py-8">
                          <FileText className="w-12 h-12 text-[#808080] mx-auto mb-3 opacity-50" />
                          <p className="text-sm text-[#808080]">No files uploaded yet</p>
                        </div>
                      ) : (
                        (currentRoom?.files || []).map((file, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F] hover:border-[#E3C567]/30 transition-all">
                            <div className="w-10 h-10 bg-[#E3C567]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-[#E3C567]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#FAFAFA] truncate">{file.name}</p>
                              <p className="text-xs text-[#808080]">
                                {file.uploaded_by_name} • {new Date(file.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-[#1F1F1F] hover:bg-[#333] text-[#FAFAFA] px-3 py-1.5 rounded-full transition-colors"
                            >
                              Open
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'photos' && (
                <div className="space-y-6">
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-[#FAFAFA]">Property Photos</h4>
                      <Button
                        onClick={async () => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.multiple = true;
                          input.onchange = async (e) => {
                            const files = Array.from(e.target.files);
                            if (files.length === 0) return;

                            // Validate all files first
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
                              
                              const photos = currentRoom?.photos || [];
                              await base44.entities.Room.update(roomId, {
                                photos: [...photos, ...uploads]
                              });
                              
                              // Refresh room
                              const roomData = await base44.entities.Room.filter({ id: roomId });
                              if (roomData?.[0]) setCurrentRoom({ ...currentRoom, photos: roomData[0].photos });
                              toast.success(`${files.length} photo(s) uploaded`);
                            } catch (error) {
                              toast.error('Upload failed');
                            }
                          };
                          input.click();
                        }}
                        className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Upload Photos
                      </Button>
                    </div>

                    {(currentRoom?.photos || []).length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center mx-auto mb-4">
                          <Image className="w-8 h-8 text-[#808080]" />
                        </div>
                        <p className="text-sm text-[#808080]">No photos uploaded yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {(currentRoom?.photos || []).map((photo, idx) => (
                          <div key={idx} className="group relative aspect-square rounded-lg overflow-hidden bg-[#141414] border border-[#1F1F1F] hover:border-[#E3C567]/30 transition-all">
                            <img
                              src={photo.url}
                              alt={photo.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <a
                                href={photo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black px-4 py-2 rounded-full text-sm font-medium"
                              >
                                View Full Size
                              </a>
                              <p className="text-xs text-white/80 px-2 text-center">
                                {photo.uploaded_by_name} • {new Date(photo.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-6">
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Events & Activity</h4>
                    <div className="space-y-3">
                      {[
                        { date: currentRoom?.created_date, event: 'Deal created', user: profile?.user_role === 'investor' ? 'You' : (currentRoom?.is_fully_signed ? currentRoom?.counterparty_name : 'User') },
                        ...(currentRoom?.is_fully_signed ? [
                          { date: new Date().toISOString(), event: 'Agreement signed - Working together', user: 'Both parties' }
                        ] : [])
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                          <div className="w-2 h-2 bg-[#E3C567] rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm text-[#FAFAFA] font-medium">{item.event}</p>
                            <p className="text-xs text-[#808080] mt-1">
                              {item.user} • {new Date(item.date || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
                          ) : (
                            /* Messages View */
            <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
              {/* Deal Request Review Banner for Agents - ONLY show if status is explicitly 'requested' */}
              {profile?.user_role === 'agent' && currentRoom?.request_status === 'requested' && !currentRoom?.is_fully_signed && (
                <div className="mb-4 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl p-5 flex-shrink-0">
                  <div className="flex items-start gap-3 mb-4">
                    <Shield className="w-5 h-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-md font-bold text-[#F59E0B] mb-1">
                        New Deal Request - Review & Discuss
                      </h3>
                      <p className="text-sm text-[#FAFAFA]/80">
                        Chat with the investor to discuss this deal. You're viewing limited info (city/state/price). Accept to unlock more details, or decline if not interested.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={async () => {
                        try {
                          const response = await base44.functions.invoke('transitionDealRequestStatus', {
                            roomId: roomId,
                            action: 'accept'
                          });
                          if (response.data?.success) {
                            toast.success("Deal accepted! More details now visible.");
                            queryClient.invalidateQueries({ queryKey: ['rooms'] });
                            queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
                            window.location.reload();
                          }
                        } catch (error) {
                          toast.error("Failed to accept deal");
                        }
                      }}
                      className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white rounded-full font-semibold"
                    >
                      Accept Deal
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!confirm("Are you sure you want to decline this deal request?")) return;
                        try {
                          const response = await base44.functions.invoke('transitionDealRequestStatus', {
                            roomId: roomId,
                            action: 'reject'
                          });
                          if (response.data?.success) {
                            toast.success("Deal declined");
                            navigate(createPageUrl("Pipeline"));
                          }
                        } catch (error) {
                          toast.error("Failed to decline deal");
                        }
                      }}
                      variant="outline"
                      className="flex-1 border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/10 rounded-full font-semibold"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Show this banner for agents when deal is accepted but not fully signed, OR for investors waiting for signatures */}
              {((profile?.user_role === 'agent' && currentRoom?.request_status === 'accepted' && !currentRoom?.is_fully_signed) || 
                (profile?.user_role === 'investor' && currentRoom?.request_status !== 'requested' && !currentRoom?.is_fully_signed)) && (
                <div className="mb-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5 flex-shrink-0">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-[#60A5FA] mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-md font-bold text-[#60A5FA] mb-1">
                        Sign Agreement to Unlock Full Details
                      </h3>
                      <p className="text-sm text-[#FAFAFA]/80">
                        {profile?.user_role === 'agent' 
                          ? 'You can chat and view general deal info. Full property address and seller details unlock after both parties sign the agreement in the Agreement tab.'
                          : 'Chat with the agent to discuss this deal. Full details including agent name and contact unlock after both parties sign the agreement in the Agreement tab.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Deal Summary Box */}
              {currentRoom && (currentRoom.property_address || currentRoom.deal_title || currentRoom.budget) && (
                <div className="mb-4 bg-[#0D0D0D] border border-[#E3C567]/30 rounded-2xl p-5 shadow-lg flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[#E3C567] mb-1">
                        {/* Privacy: Hide full address from agents until internal agreement is fully signed */}
                        {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed
                          ? `Deal in ${currentRoom.city || 'City'}, ${currentRoom.state || 'State'}`
                          : (currentRoom.property_address || currentRoom.deal_title || 'Deal Summary')
                        }
                      </h3>
                      <div className="space-y-1 text-sm">
                        {currentRoom.counterparty_name && currentRoom.is_fully_signed && (
                          <p className="text-[#FAFAFA]">
                            {currentRoom.counterparty_role === 'agent' ? 'Agent' : 'Investor'}: {currentRoom.counterparty_name}
                          </p>
                        )}
                        {(currentRoom.city || currentRoom.state) && (
                          <p className="text-[#808080]">
                            {/* Privacy: Only show city/state/zip for agents until internal agreement is fully signed */}
                            {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed
                              ? `${currentRoom.county ? currentRoom.county + ' County, ' : ''}${currentRoom.city}, ${currentRoom.state} ${currentRoom.zip || ''}`
                              : [currentRoom.city, currentRoom.state].filter(Boolean).join(', ')
                            }
                          </p>
                        )}
                        {currentRoom.budget > 0 && (
                          <p className="text-[#34D399] font-semibold">
                            ${currentRoom.budget.toLocaleString()}
                          </p>
                        )}
                        {currentRoom.closing_date && (
                          <p className="text-[#808080]">
                            Closing: {new Date(currentRoom.closing_date).toLocaleDateString()}
                          </p>
                        )}
                        {!currentRoom.closing_date && currentRoom.created_date && (
                          <p className="text-[#666]">
                            Started: {new Date(currentRoom.created_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <LoadingAnimation className="w-64 h-64 mx-auto mb-3" />
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
                    const isFileMessage = m.metadata?.type === 'file' || m.metadata?.type === 'photo';

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
                            {isFileMessage && m.metadata?.type === 'photo' ? (
                              <div>
                                <img 
                                  src={m.metadata.file_url} 
                                  alt={m.metadata.file_name}
                                  className="rounded-lg max-w-full h-auto max-h-64 mb-2 cursor-pointer"
                                  onClick={() => window.open(m.metadata.file_url, '_blank')}
                                />
                                <p className="text-sm opacity-90">{m.body}</p>
                              </div>
                            ) : isFileMessage && m.metadata?.type === 'file' ? (
                              <div>
                                <p className="text-[15px] mb-2">{m.body}</p>
                                <a
                                  href={m.metadata.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-sm underline ${isMe ? 'text-black' : 'text-[#E3C567]'} hover:opacity-80`}
                                >
                                  Download →
                                </a>
                              </div>
                            ) : (
                              <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
                            )}
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
            </div>
          )}
        </div>

        {/* Message Input Area - STAYS AT BOTTOM */}
        <div className="px-5 py-4 bg-[#0D0D0D] border-t border-[#1F1F1F] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] flex-shrink-0 z-10">
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
                      
                      const photos = currentRoom?.photos || [];
                      await base44.entities.Room.update(roomId, {
                        photos: [...photos, ...uploads]
                      });
                      
                      // Create chat messages for each photo
                      for (const upload of uploads) {
                        await base44.entities.Message.create({
                          room_id: roomId,
                          sender_profile_id: profile?.id,
                          body: `📷 Uploaded photo: ${upload.name}`,
                          metadata: {
                            type: 'photo',
                            file_url: upload.url,
                            file_name: upload.name
                          }
                        });
                      }
                      
                      // Log activity
                      if (currentRoom?.deal_id) {
                        base44.entities.Activity.create({
                          type: 'photo_uploaded',
                          deal_id: currentRoom.deal_id,
                          room_id: roomId,
                          actor_id: profile?.id,
                          actor_name: profile?.full_name || profile?.email,
                          message: `${profile?.full_name || profile?.email} uploaded ${uploads.length} photo(s)`
                        }).catch(() => {});
                      }
                      
                      const roomData = await base44.entities.Room.filter({ id: roomId });
                      if (roomData?.[0]) setCurrentRoom({ ...currentRoom, photos: roomData[0].photos });
                      toast.success(`${files.length} photo(s) uploaded to deal`);
                    } catch (error) {
                      toast.error('Upload failed');
                    }
                  };
                  input.click();
                }}
                className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333] rounded-full flex items-center justify-center transition-colors"
                title="Upload photos"
              >
                <Image className="w-5 h-5 text-[#808080]" />
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
                      const files = currentRoom?.files || [];
                      await base44.entities.Room.update(roomId, {
                        files: [...files, {
                          name: file.name,
                          url: file_url,
                          uploaded_by: profile?.id,
                          uploaded_by_name: profile?.full_name || profile?.email,
                          uploaded_at: new Date().toISOString(),
                          size: file.size,
                          type: file.type
                        }]
                      });
                      
                      // Create chat message for file
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
                      
                      // Log activity
                      if (currentRoom?.deal_id) {
                        base44.entities.Activity.create({
                          type: 'file_uploaded',
                          deal_id: currentRoom.deal_id,
                          room_id: roomId,
                          actor_id: profile?.id,
                          actor_name: profile?.full_name || profile?.email,
                          message: `${profile?.full_name || profile?.email} uploaded ${file.name}`
                        }).catch(() => {});
                      }
                      
                      const roomData = await base44.entities.Room.filter({ id: roomId });
                      if (roomData?.[0]) setCurrentRoom({ ...currentRoom, files: roomData[0].files });
                      toast.success('File uploaded to deal');
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
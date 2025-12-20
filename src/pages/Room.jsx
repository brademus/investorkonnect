
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
import { 
  Menu, Send, Loader2, ArrowLeft, FileText, Shield, Search, Info, User, Plus, Image
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
const ConversationItem = React.memo(({ room, isActive, onClick }) => {
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
        <div className="flex items-center justify-between mb-1">
          <p className="text-[15px] font-semibold text-[#FAFAFA] truncate">
            {room.counterparty_name || `Room ${room.id.slice(0, 6)}`}
          </p>
          <span className="text-xs text-[#808080] flex-shrink-0 ml-2">
            {new Date(room.created_date || Date.now()).toLocaleDateString()}
          </span>
        </div>
        {/* Deal Address or Title */}
        {(room.property_address || room.deal_title || room.title) && (
          <p className="text-sm text-[#E3C567] truncate font-medium">
            {room.property_address || room.deal_title || room.title}
          </p>
        )}
        
        {/* Deal Budget */}
        {(room.budget > 0) && (
          <p className="text-sm text-[#34D399] font-semibold mt-0.5">
            ${room.budget.toLocaleString()}
          </p>
        )}

        {/* Fallback state */}
        {!room.property_address && !room.deal_title && !room.title && !room.budget && (
          <p className="text-sm text-[#808080] truncate">
            {room.counterparty_role || "Active room"}
          </p>
        )}
      </div>
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // Normalize values to handle undefined/null/0 consistently
  const normalize = (val) => val || '';
  
  return (
    prevProps.room.id === nextProps.room.id &&
    prevProps.isActive === nextProps.isActive &&
    normalize(prevProps.room.counterparty_name) === normalize(nextProps.room.counterparty_name) &&
    normalize(prevProps.room.property_address) === normalize(nextProps.room.property_address) &&
    normalize(prevProps.room.deal_title) === normalize(nextProps.room.deal_title) &&
    normalize(prevProps.room.title) === normalize(nextProps.room.title) &&
    (prevProps.room.budget || 0) === (nextProps.room.budget || 0) &&
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
  const [lockingIn, setLockingIn] = useState(false);
  // Removed [showDealDetails, setShowDealDetails]
  const [currentRoom, setCurrentRoom] = useState(null);
  const [deal, setDeal] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [investorTasks, setInvestorTasks] = useState([]);
  const [agentTasks, setAgentTasks] = useState([]);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  // Fetch current room directly for instant loading
  useEffect(() => {
    if (!roomId) return;
    
    const fetchCurrentRoom = async () => {
      setRoomLoading(true);
      try {
        const roomData = await base44.entities.Room.filter({ id: roomId });
        if (roomData && roomData.length > 0) {
          const room = roomData[0];
          
          // Always fetch deal data if deal_id exists to get contract info
          if (room.deal_id) {
            const dealData = await base44.entities.Deal.filter({ id: room.deal_id });
            if (dealData && dealData.length > 0) {
              const deal = dealData[0];
              setDeal(deal); // Store deal separately
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
                // Merge contract fields from both room and deal
                contract_url: room.contract_url || deal.contract_url || null,
                contract_document: room.contract_document || deal.contract_document || null
              });
            } else {
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

  // Enforce agent lock-in: investor can't access other agent rooms once deal is assigned
  useEffect(() => {
    if (!currentRoom || !profile) return;

    const dealId = currentRoom.deal_id || currentRoom.suggested_deal_id;
    if (!dealId || profile.user_role !== 'investor') return;

    // Load deal to check assigned agent
    const checkLockIn = async () => {
      try {
        const deals = await base44.entities.Deal.filter({ id: dealId });
        if (deals.length === 0) return;

        const deal = deals[0];
        if (!deal.agent_id) return; // No agent assigned yet, allow access

        // Check if current room's agent matches the deal's assigned agent
        if (roomAgentProfileId && roomAgentProfileId !== deal.agent_id) {
          toast.error("This deal is locked to a different agent");

          // Get or find the correct room for this deal + assigned agent
          try {
            const correctRoomId = await getOrCreateDealRoom({
              dealId: dealId,
              agentProfileId: deal.agent_id
            });
            navigate(`${createPageUrl("Room")}?roomId=${correctRoomId}`, { replace: true });
          } catch (error) {
            console.error("Failed to get correct room:", error);
            navigate(createPageUrl("Dashboard"), { replace: true });
          }
        }
      } catch (error) {
        console.error("Failed to check deal lock-in:", error);
      }
    };

    checkLockIn();
  }, [currentRoom, profile, rooms, navigate]);

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
      
      if (!response.data?.ok) {
        throw new Error('Message send failed');
      }
      
      // Remove optimistic message immediately after successful send
      // Real message will appear via polling
      setItems(prev => prev.filter(m => m.id !== tempId));
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(`Failed to send: ${error.message}`);
      // Remove optimistic message on error
      setItems(prev => prev.filter(m => m.id !== tempId));
    } finally { 
      setSending(false);
    }
  };

  const handleLockIn = async () => {
    const dealId = currentRoom?.deal_id || currentRoom?.suggested_deal_id;
    if (!dealId || !roomId || lockingIn) return;
    
    setLockingIn(true);
    try {
      const response = await base44.functions.invoke('lockInDealAgent', { 
        room_id: roomId, 
        deal_id: dealId
      });
      
      if (response.data?.success) {
        toast.success(`Agent locked in! ${response.data.agentName || 'Agent'} is now your dedicated agent.`);
        
        // Clear cached data
        sessionStorage.clear();
        
        // Invalidate relevant queries
        await queryClient.invalidateQueries({ queryKey: ['rooms'] });
        await queryClient.invalidateQueries({ queryKey: ['investorDeals', profile.id] });
        await queryClient.invalidateQueries({ queryKey: ['pipelineDeals', profile.id] });
        
        // Navigate to pipeline
        navigate(createPageUrl("Pipeline"), { replace: true });
      } else {
        toast.error("Failed to lock in agent. Please try again.");
      }
    } catch (error) {
      console.error("Failed to lock in agent:", error);
      toast.error("Failed to lock in agent. Please try again.");
    } finally {
      setLockingIn(false);
    }
  };

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
            <h2 className="text-lg font-semibold text-[#FAFAFA]">{counterpartName}</h2>
            <div className="flex items-center gap-3">
              {currentRoom?.deal_assigned_agent_id === roomAgentProfileId ? (
                <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Agent Locked In
                </span>
              ) : (
                <span className="bg-[#1F1F1F] text-[#808080] border border-[#333] px-2 py-0.5 rounded text-xs">
                  Choosing agent
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
            
            {roomId && 
             profile?.user_role === 'investor' &&
             (currentRoom?.deal_id || currentRoom?.suggested_deal_id) && 
             currentRoom?.deal_assigned_agent_id !== roomAgentProfileId && (
              <Button
                onClick={handleLockIn}
                disabled={lockingIn}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-bold px-5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lockingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Locking in...
                  </>
                ) : (
                  'Lock in this agent'
                )}
              </Button>
            )}
            
            {roomId && (
              <>
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
              </>
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
                  <span className={`w-2 h-2 rounded-full ${currentRoom?.deal_assigned_agent_id === roomAgentProfileId ? 'bg-[#10B981]' : 'bg-[#E3C567]'}`}></span>
                  <span className="font-bold text-[#FAFAFA] text-sm">
                    {currentRoom.title || `Chat with ${counterpartName}`}
                  </span>
                  <span className="text-[#555] text-xs">•</span>
                  <span className="text-[#808080] text-xs uppercase tracking-wider font-semibold">
                    {currentRoom?.deal_assigned_agent_id === roomAgentProfileId ? (
                      <span className="text-[#10B981]">Active – Working with this agent</span>
                    ) : (
                      currentRoom.pipeline_stage ? currentRoom.pipeline_stage.replace(/_/g, ' ') : 'GENERAL'
                    )}
                  </span>
                </div>

                {/* Row 2: Address & Price */}
                <div className="flex items-center gap-3 text-xs opacity-90">
                   <div className="flex items-center gap-1.5 text-[#CCC]">
                     <span>
                       {currentRoom.property_address || currentRoom.deal_title || currentRoom.title || "No Deal Selected"}
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
                                      {[
                                        { id: 'new_deal_under_contract', label: 'New Deal Under Contract', color: '#E3C567' },
                                        { id: 'walkthrough_scheduled', label: 'Walkthrough Scheduled', color: '#60A5FA' },
                                        { id: 'evaluate_deal', label: 'Evaluate Deal', color: '#F59E0B' },
                                        { id: 'active_marketing', label: 'Active Marketing', color: '#DB2777' },
                                        { id: 'cancelling_deal', label: 'Cancelling Deal', color: '#EF4444' },
                                        { id: 'clear_to_close_closed', label: 'Closed', color: '#34D399' }
                                      ].map((stage, idx) => {
                                        const isActive = currentRoom?.pipeline_stage === stage.id;
                                        const isPast = [
                                          'new_deal_under_contract', 'walkthrough_scheduled', 'evaluate_deal', 'active_marketing', 'cancelling_deal', 'clear_to_close_closed'
                                        ].indexOf(currentRoom?.pipeline_stage) > idx;

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
                                              style={isActive ? { backgroundColor: stage.color, ringColor: stage.color } : {}}
                                            >
                                              <span className="text-sm font-bold text-white">
                                                {isPast ? '✓' : idx + 1}
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
                                          {currentRoom?.property_address || 'Property Address'}
                                        </h3>
                                        <p className="text-sm text-[#808080] mb-3">
                                          {[currentRoom?.city, currentRoom?.state].filter(Boolean).join(', ') || 'Location'}
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
                                              {currentRoom?.counterparty_name || 'Loading...'}
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
                                      {[
                                        { id: 'new_deal_under_contract', label: 'New Deal Under Contract', color: '#E3C567' },
                                        { id: 'walkthrough_scheduled', label: 'Walkthrough Scheduled', color: '#60A5FA' },
                                        { id: 'evaluate_deal', label: 'Evaluate Deal', color: '#F59E0B' },
                                        { id: 'active_marketing', label: 'Active Marketing', color: '#DB2777' },
                                        { id: 'cancelling_deal', label: 'Cancelling Deal', color: '#EF4444' },
                                        { id: 'clear_to_close_closed', label: 'Closed', color: '#34D399' }
                                      ].map((stage, idx) => {
                                        const isActive = currentRoom?.pipeline_stage === stage.id;
                                        const isPast = [
                                          'new_deal_under_contract', 'walkthrough_scheduled', 'evaluate_deal', 'active_marketing', 'cancelling_deal', 'clear_to_close_closed'
                                        ].indexOf(currentRoom?.pipeline_stage) > idx;

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
                                              style={isActive ? { backgroundColor: stage.color, ringColor: stage.color } : {}}
                                            >
                                              <span className="text-sm font-bold text-white">
                                                {isPast ? '✓' : idx + 1}
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

                                  {/* 5. Investor Snapshot */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Investor Snapshot</h4>
                                    <div className="space-y-3 text-sm">
                                      <div className="flex items-start gap-2">
                                        <span className="text-[#808080] min-w-[100px]">Name:</span>
                                        <span className="text-[#FAFAFA] font-medium">{currentRoom?.counterparty_name || 'N/A'}</span>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <span className="text-[#808080] min-w-[100px]">Prefers:</span>
                                        <span className="text-[#FAFAFA]">Email & Text</span>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <span className="text-[#808080] min-w-[100px]">Goal:</span>
                                        <span className="text-[#FAFAFA]">Flip in 60 days, target profit $50K</span>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <span className="text-[#808080] min-w-[100px]">Strategy:</span>
                                        <span className="text-[#FAFAFA]">BRRRR, Buy & Hold</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 6. Agent Notes (Private) */}
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
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-[#E3C567]" />
                      Agreement Summary
                    </h4>
                    <div className="space-y-4">
                      {currentRoom?.proposed_terms ? (
                        <>
                          {currentRoom.proposed_terms.seller_commission_type && (
                            <div className="p-4 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                              <h5 className="text-sm font-semibold text-[#E3C567] mb-2">Seller's Agent Commission</h5>
                              <p className="text-[#FAFAFA]">
                                {currentRoom.proposed_terms.seller_commission_type === 'percentage' 
                                  ? `${currentRoom.proposed_terms.seller_commission_percentage}% of purchase price`
                                  : `$${currentRoom.proposed_terms.seller_flat_fee?.toLocaleString()} flat fee`
                                }
                              </p>
                            </div>
                          )}
                          {currentRoom.proposed_terms.buyer_commission_type && (
                            <div className="p-4 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                              <h5 className="text-sm font-semibold text-[#60A5FA] mb-2">Buyer's Agent Commission</h5>
                              <p className="text-[#FAFAFA]">
                                {currentRoom.proposed_terms.buyer_commission_type === 'percentage' 
                                  ? `${currentRoom.proposed_terms.buyer_commission_percentage}% of purchase price`
                                  : `$${currentRoom.proposed_terms.buyer_flat_fee?.toLocaleString()} flat fee`
                                }
                              </p>
                            </div>
                          )}
                          {currentRoom.proposed_terms.agreement_length && (
                            <div className="p-4 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                              <h5 className="text-sm font-semibold text-[#FAFAFA] mb-2">Agreement Length</h5>
                              <p className="text-[#808080]">{currentRoom.proposed_terms.agreement_length} days</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-[#808080] text-center py-8">
                          No agreement terms available yet
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'files' && (
                <div className="space-y-6">
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <ContractLayers 
                      room={currentRoom} 
                      deal={deal}
                      onUpdate={() => {
                        // Refresh room data
                        const fetchCurrentRoom = async () => {
                          const roomData = await base44.entities.Room.filter({ id: roomId });
                          if (roomData && roomData.length > 0) {
                            const room = roomData[0];
                            if (room.deal_id) {
                              const dealData = await base44.entities.Deal.filter({ id: room.deal_id });
                              if (dealData && dealData.length > 0) {
                                const deal = dealData[0];
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
                                  contract_url: room.contract_url || deal.contract_url || null,
                                  contract_document: room.contract_document || deal.contract_document || null
                                });
                              }
                            }
                          }
                        };
                        fetchCurrentRoom();
                      }}
                      userRole={profile?.user_role}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'photos' && (
                <div className="space-y-6">
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Property Photos</h4>
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Image className="w-8 h-8 text-[#808080]" />
                      </div>
                      <p className="text-sm text-[#808080] mb-4">No photos uploaded yet</p>
                      <Button
                        onClick={() => toast.info('Photo upload coming soon')}
                        className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"
                      >
                        Upload Photos
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-6">
                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Events & Activity</h4>
                    <div className="space-y-3">
                      {[
                        { date: currentRoom?.created_date, event: 'Deal created', user: profile?.user_role === 'investor' ? 'You' : currentRoom?.counterparty_name },
                        ...(currentRoom?.deal_assigned_agent_id === roomAgentProfileId ? [
                          { date: new Date().toISOString(), event: 'Agent locked in', user: currentRoom?.counterparty_name }
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
              {/* Floating Deal Summary Box */}
              {currentRoom && (currentRoom.property_address || currentRoom.deal_title || currentRoom.budget) && (
                <div className="mb-4 bg-[#0D0D0D] border border-[#E3C567]/30 rounded-2xl p-5 shadow-lg flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[#E3C567] mb-1">
                        {currentRoom.property_address || currentRoom.deal_title || 'Deal Summary'}
                      </h3>
                      <div className="space-y-1 text-sm">
                        {currentRoom.counterparty_name && (
                          <p className="text-[#FAFAFA]">
                            {currentRoom.counterparty_role === 'agent' ? 'Agent' : 'Investor'}: {currentRoom.counterparty_name}
                          </p>
                        )}
                        {(currentRoom.city || currentRoom.state) && (
                          <p className="text-[#808080]">
                            {[currentRoom.city, currentRoom.state].filter(Boolean).join(', ')}
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
                            <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{m.body}</p>
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

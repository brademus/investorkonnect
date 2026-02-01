import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";

import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Logo } from "@/components/Logo";
import { useRooms } from "@/components/useRooms";
import { getPriceAndComp } from "@/components/utils/dealCompDisplay";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { useQueryClient } from "@tanstack/react-query";
import { getOrCreateDealRoom } from "@/components/dealRooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import LoadingAnimation from "@/components/LoadingAnimation";
import SimpleMessageBoard from "@/components/chat/SimpleMessageBoard";
import { StepGuard } from "@/components/StepGuard";
import PendingAgentsList from "@/components/PendingAgentsList";

import DocumentChecklist from "@/components/DocumentChecklist";
import SimpleAgreementPanel from "@/components/SimpleAgreementPanel";
import { validateImage, validateSafeDocument } from "@/components/utils/fileValidation";
import { PIPELINE_STAGES, normalizeStage, getStageLabel, stageOrder } from "@/components/pipelineStages";
import { buildUnifiedFilesList } from "@/components/utils/dealDocuments";
import { getCounterpartyDisplayName } from "@/components/utils/counterpartyDisplay";
import PropertyDetailsCard from "@/components/PropertyDetailsCard";
import DealAppointmentsCard from "@/components/appointments/DealAppointmentsCard";
import { getCachedDeal, setCachedDeal } from "@/components/utils/dealCache";
import { 
  Menu, Send, Loader2, ArrowLeft, FileText, Shield, Search, Info, User, Plus, Image, CheckCircle, CheckCircle2, Clock, Download
} from "lucide-react";
import { toast } from "sonner";

// Privacy helper: should we mask address for the current viewer?
// IMPORTANT: Default to masking until profile loads to prevent any brief exposure
const shouldMaskAddress = (profile, room, deal) => {
  const isAgentView = (profile?.user_role === 'agent') || !profile; // mask by default when role unknown
  const isFullySigned = !!(room?.is_fully_signed || deal?.is_fully_signed);
  return isAgentView && !isFullySigned;
};

// Robust check to determine if a message was sent by the current user/profile
function isMessageFromMe(m, authUser, currentProfile) {
  // 1) Respect optimistic flag immediately
  if (m?._isMe === true) return true;

  // 2) Prefer stable auth user ID when available
  const authUserId = authUser?.id;
  if (authUserId && (m?.sender_user_id === authUserId || m?.senderUserId === authUserId)) return true;

  // 3) Fallback to profile id
  const myProfileId = currentProfile?.id;
  if (myProfileId && (m?.sender_profile_id === myProfileId || m?.senderProfileId === myProfileId || m?.sender_id === myProfileId)) return true;

  // 4) Legacy email-based fallback
  const myEmail = (currentProfile?.email || '').toLowerCase().trim();
  const createdBy = (m?.created_by || '').toLowerCase().trim();
  if (myEmail && createdBy && createdBy === myEmail) return true;

  return false;
}


// Helper to build a minimal deal snapshot from room for instant render
function buildDealFromRoom(room, maskAddress = false) {
  if (!room) return null;
  const addr = maskAddress ? null : room.property_address;
  return {
    id: room.deal_id || `room-${room.id}`,
    title: room.title || room.deal_title,
    property_address: addr,
    city: room.city,
    state: room.state,
    county: room.county,
    zip: room.zip,
    purchase_price: room.budget,
    pipeline_stage: room.pipeline_stage,
    key_dates: { closing_date: room.closing_date },
    agent_id: room.deal_assigned_agent_id,
    is_fully_signed: !!room.is_fully_signed,
    property_type: room.property_type,
    property_details: room.property_details || {},
    proposed_terms: room.proposed_terms || undefined
  };
}

// Use shared rooms hook with aggressive caching
function useMyRooms() {
  const { data: rooms, isLoading: loading } = useRooms();
  return { 
    rooms: rooms || [], 
    loading: loading && (!rooms || rooms.length === 0) // Only show loading if no cached data
  };
}

function useMessages(roomId, authUser, currentProfile) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [items.length]);

  // Only show loading on initial room load
  useEffect(() => {
    setLoading(!initialLoadDone);
    setInitialLoadDone(false);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      setItems([]);
      setLoading(false);
      setInitialLoadDone(true);
      return;
    }
    
    let cancelled = false;
    setLoading(true); // Start loading immediately on room switch

    const fetchMessages = async () => {
      try {
        const serverItems = await base44.entities.Message.filter(
          { room_id: roomId },
          'created_date' // Sort ascending (oldest first)
        );

        if (!cancelled) {
          setItems(prev => {
            // 1) Carry over optimistic messages and lock their side
            const optimistic = prev.filter(m => m._isOptimistic).map(m => ({ ...m, _isMe: true }));

            // 2) Stabilize server items with _isMe computed ONCE
            const stableServer = serverItems.map(m => ({ ...m, _isMe: isMessageFromMe(m, authUser, currentProfile) }));

            // 3) Drop any optimistic that clearly matches a server message
            const remainingOptimistic = optimistic.filter(opt => !stableServer.some(real => {
              const sameSender = (real.sender_profile_id && opt.sender_profile_id && real.sender_profile_id === opt.sender_profile_id) ||
                                 (real.sender_user_id && opt.sender_user_id && real.sender_user_id === opt.sender_user_id);
              const sameBody = real.body === opt.body;
              const closeTime = Math.abs(new Date(real.created_date) - new Date(opt.created_date)) < 8000;
              return sameSender && sameBody && closeTime;
            }));

            // 4) Merge and dedupe by id fallback signature
            const merged = [...stableServer, ...remainingOptimistic];
            const seen = new Set();
            const deduped = merged.filter(m => {
              const key = m.id || `${m.sender_profile_id||m.sender_user_id}-${m.created_date}-${m.body?.slice(0,20)}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            // 5) Final stable sort
            return deduped.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
          });
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
      finally { 
        if (!cancelled) {
          setLoading(false);
          setInitialLoadDone(true);
        }
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 15000); // Poll every 15 seconds to reduce rate limit errors
    return () => { cancelled = true; clearInterval(interval); };
  }, [roomId, authUser?.id, currentProfile?.id, currentProfile?.user_id, currentProfile?.email]);

  return { items, loading, setItems, messagesEndRef };
}

// Memoized sidebar header to prevent flickering
const SidebarHeader = React.memo(({ onSearchChange, searchValue }) => {
  return (
    <div className="p-5 border-b border-[#1F1F1F]">
      <div className="flex items-center gap-3 mb-5">
        <Logo size="default" showText={false} linkTo={createPageUrl("Pipeline")} />
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
const ConversationItem = React.memo(({ room, isActive, onClick, userRole, fullDeal, agreement }) => {
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
            {userRole === 'agent' && room.budget > 0 && (room.city || room.state)
              ? `$${room.budget.toLocaleString()} • ${[room.city, room.state].filter(Boolean).join(', ')}`
              : room.is_fully_signed 
              ? (room.counterparty_name || `Room ${room.id.slice(0, 6)}`)
              : (userRole === 'investor' ? 'Agent' : 'Investor')
            }
          </p>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {(() => {
              const badge = getAgreementStatusLabel({ room: room, negotiation: room?.negotiation, agreement, role: userRole });
              return badge ? (
                <span className={`text-[10px] border px-2 py-0.5 rounded-full ${badge.className}`}>
                  {badge.label}
                </span>
              ) : null;
            })()}
            <span className="text-xs text-[#808080]">
              {new Date(room.created_date || Date.now()).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        {/* Location line - show city/state for agents until signed, full address for investors */}
        {(room.city || room.property_address) && (
          <>
            <p className="text-sm text-[#E3C567] truncate font-medium">
              {canSeeFullAddress 
                ? (room.property_address || room.deal_title || room.title)
                : [room.city, room.state].filter(Boolean).join(', ')
              }
            </p>
            {userRole === 'agent' && (() => {
               // Always check room.proposed_terms first (most up-to-date), then fall back to fullDeal
               const { priceLabel, compLabel } = getPriceAndComp({ deal: fullDeal, room });
               return (
                 <div className="text-xs mt-0.5">
                   <div className="text-[#34D399] font-semibold">${room.budget ? room.budget.toLocaleString() : '0'}</div>
                   <div className="text-[#E3C567]">Comp: {compLabel || '—'}</div>
                 </div>
               );
             })()}
          </>
        )}
        
        {/* Deal Budget - only show if not already in title */}
        {userRole === 'investor' && room.budget > 0 && (
          <div className="text-sm mt-0.5">
            <div className="text-[#34D399] font-semibold">${room.budget.toLocaleString()}</div>
            {(() => {
              const { compLabel } = getPriceAndComp({ room });
              return compLabel ? <div className="text-xs text-[#E3C567]">Comp: {compLabel}</div> : null;
            })()}
          </div>
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
  const { profile, user, onboarded, hasNDA, isPaidSubscriber, kycVerified, loading } = useCurrentProfile();

  // Strict Gating for Deal Room Access - use ref to avoid re-gating after redirect
  const gateCheckedRef = useRef(false);
  useEffect(() => {
    if (loading || gateCheckedRef.current) return;
    gateCheckedRef.current = true;
    
    if (!profile) {
      navigate(createPageUrl("PostAuth"), { replace: true });
      return;
    }
    
    // Redirect if not fully setup (same logic as Pipeline)
    if (!onboarded) {
      navigate(createPageUrl("PostAuth"), { replace: true });
      return;
    }
    
    if (profile.user_role === 'investor' && !isPaidSubscriber) {
      navigate(createPageUrl("Pricing"), { replace: true });
      return;
    }

    // KYC required for everyone
    if (!kycVerified) {
      navigate(createPageUrl("IdentityVerification"), { replace: true });
      return;
    }

    if (!hasNDA) {
      navigate(createPageUrl("NDA"), { replace: true });
      return;
    }
  }, [loading]);
  const { rooms } = useMyRooms();
  const { items: messages, loading: messagesLoading, setItems, messagesEndRef } = useMessages(roomId, user, profile);
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);


  const [searchConversations, setSearchConversations] = useState("");
  const [showBoard, setShowBoard] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [lastMyMessageId, setLastMyMessageId] = useState(null);
  
  // Removed tab-triggered refetch: files/photos are prefetched once when Deal Board opens
  // and kept fresh via realtime subscriptions and background updates.
  
  // Open Agreement tab automatically when tab=agreement is in URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('tab') === 'agreement') {
      setShowBoard(true);
      setActiveTab('agreement');
    }
  }, [roomId, location.search]);



  const [currentRoom, setCurrentRoom] = useState(null);
  const [deal, setDeal] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [invites, setInvites] = useState([]);
  const [selectedInvite, setSelectedInvite] = useState(null);

  const [agreementPanelKey, setAgreementPanelKey] = useState(0);
  const requestSeqRef = useRef(0);
  const [dealAppts, setDealAppts] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [pendingCounters, setPendingCounters] = useState([]);
  const lastSentRef = useRef(0);
  const lastFetchKeyRef = useRef('');

  // PHASE 4: Multi-agent mode state
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomStates, setRoomStates] = useState({});

  // When opening the Deal Board (including via URL), preload everything once
  useEffect(() => {
    if (!showBoard || !currentRoom?.deal_id) return;
    setBoardLoading(true);
    (async () => {
      const data = await prefetchDeal();
      if (data) setDeal(data);
      setBoardLoading(false);
    })();
  }, [showBoard, currentRoom?.deal_id]);

  // Ensure Agreement is prefetched as soon as the tab is opened
  useEffect(() => {
    if (showBoard && activeTab === 'agreement' && currentRoom?.deal_id) {
      prefetchDeal();
    }
  }, [showBoard, activeTab, currentRoom?.deal_id]);



  // On room switch, reset board/tab and transient data to avoid cross-room flicker
  useEffect(() => {
    if (!roomId) return;
    setShowBoard(false);
    setActiveTab('details');
    setDeal(null);
    setAgreement(null);
    setInvites([]);
    setSelectedInvite(null);
    setPendingCounters([]);
    setSelectedRoomId(null);
    setRoomStates({});
    setRoomLoading(true);
    // DO NOT clear items here - useMessages hook handles its own cleanup
    // Force fresh fetch by resetting current room
    setCurrentRoom(null);
  }, [roomId]);
  // Property Details editor state
  const [editingPD, setEditingPD] = useState(false);
  const [pdPropertyType, setPdPropertyType] = useState("");
  const [pdBeds, setPdBeds] = useState("");
  const [pdBaths, setPdBaths] = useState("");
  const [pdSqft, setPdSqft] = useState("");
  const [pdYearBuilt, setPdYearBuilt] = useState("");
  const [pdStories, setPdStories] = useState("");
  const [pdBasement, setPdBasement] = useState("");
  
  // Extracted details (temporary, require confirmation before applying)
  const [extractedDraft, setExtractedDraft] = useState(null);

        // Unified post-sign flag: chat unlocks ONLY when both parties have fully signed
        const isWorkingTogether = useMemo(() => {
          const fullySignedRoom = currentRoom?.agreement_status === 'fully_signed' || currentRoom?.is_fully_signed === true;
          const fullySignedDeal = deal?.is_fully_signed === true;
          const agreementFullySigned = agreement?.status === 'fully_signed';
          const bothSigned = agreement?.investor_signed_at && agreement?.agent_signed_at;
          return fullySignedRoom || fullySignedDeal || agreementFullySigned || bothSigned;
        }, [
          currentRoom?.agreement_status,
          currentRoom?.is_fully_signed,
          deal?.is_fully_signed,
          agreement?.status,
          agreement?.investor_signed_at,
          agreement?.agent_signed_at
        ]);

        // Chat unlocks ONLY when both parties have fully signed
        const isChatEnabled = useMemo(() => {
          return isWorkingTogether;
        }, [isWorkingTogether]);

        // Treat unknown role as agent for privacy until profile loads
        const isAgentView = (profile?.user_role === 'agent') || !profile;
        const isInvestor = profile?.user_role === 'investor';

        // Mask address for agents until fully signed
        const maskAddr = useMemo(() => shouldMaskAddress(profile, currentRoom, deal), [profile?.user_role, currentRoom?.is_fully_signed, deal?.is_fully_signed]);

        // Multi-agent mode disabled for simplicity
  const multiAgentMode = false;
  const invitedRooms = [];

        // Hard sanitizer: if anything slips through, null it out for agents until fully signed
        useEffect(() => {
          if (profile?.user_role !== 'agent') return;
          // Sanitize currentRoom
          if (currentRoom && !currentRoom.is_fully_signed && currentRoom.property_address) {
            setCurrentRoom(prev => prev ? {
              ...prev,
              property_address: null,
              title: (prev.title && /,/.test(prev.title)) ? prev.title : `${prev.city || 'City'}, ${prev.state || 'State'}`
            } : prev);
          }
          // Sanitize deal snapshot
          if (deal && !deal.is_fully_signed && deal.property_address) {
            setDeal(prev => prev ? { ...prev, property_address: null } : prev);
          }
        }, [profile?.user_role, currentRoom?.is_fully_signed, deal?.is_fully_signed, currentRoom?.property_address, deal?.property_address]);
  
  const refreshRoomState = async () => {
    if (!roomId) return;
    const rid = roomId;
    const thisReq = ++requestSeqRef.current;
    const isStale = () => (roomId !== rid || requestSeqRef.current !== thisReq);
    
    try {
      console.log('[Room] 🔄 Refreshing room state...');
      
      // Refetch room
      const roomData = await base44.entities.Room.filter({ id: roomId });
      if (!roomData || roomData.length === 0) return;
      
      const freshRoom = roomData[0];
      
      // Refetch deal (hydrate from cache first)
      if (freshRoom.deal_id) {
        const cached = getCachedDeal(freshRoom.deal_id);
        if (cached) {
          setDeal(cached);
        }
        const dealResponse = await base44.functions.invoke('getDealDetailsForUser', {
          dealId: freshRoom.deal_id
        });
        const freshDeal = dealResponse.data;

        

        if (freshDeal) {
          setCachedDeal(freshRoom.deal_id, freshDeal);
          setDeal(freshDeal);
          
          const displayTitle = (isAgentView && !freshDeal.is_fully_signed)
            ? `${freshDeal.city || 'City'}, ${freshDeal.state || 'State'}`
            : freshDeal.title;
          
          setCurrentRoom({
            ...freshRoom,
            title: displayTitle,
            property_address: freshDeal.property_address,
            city: freshDeal.city,
            state: freshDeal.state,
            county: freshDeal.county,
            zip: freshDeal.zip,
            budget: freshDeal.purchase_price,
            pipeline_stage: freshDeal.pipeline_stage,
            closing_date: freshDeal.key_dates?.closing_date,
            deal_assigned_agent_id: freshDeal.agent_id,
            is_fully_signed: freshDeal.is_fully_signed,
            // Include property details so UI can render even if deal object not yet refreshed elsewhere
            property_type: freshDeal.property_type,
            property_details: freshDeal.property_details,
            proposed_terms: freshDeal.proposed_terms,
            photos: freshRoom?.photos || [],
            files: freshRoom?.files || []
          });
          

        }
      }
      
      console.log('[Room] ✅ State refreshed');
    } catch (error) {
      console.error('[Room] ❌ Refresh failed:', error);
    }
  };

  // Prefetch board data: deal, latest room photos/files, and appointments
  const prefetchDeal = async () => {
    try {
      const did = currentRoom?.deal_id;
      if (!did) return null;

      const cached = getCachedDeal(did);
      // Kick off all fetches in parallel
      const [res, roomRows, apptRows, agRes] = await Promise.all([
        base44.functions.invoke('getDealDetailsForUser', { dealId: did }),
        base44.entities.Room.filter({ id: roomId }),
        base44.entities.DealAppointments.filter({ dealId: did }).catch(() => []),
        base44.functions.invoke('getLegalAgreement', { deal_id: did }).catch(() => ({ data: null }))
      ]);

      const freshDeal = res?.data || cached || null;
      if (freshDeal) setCachedDeal(did, freshDeal);

      // Ensure we have the latest shared files/photos for instant Files/Photos tabs
      if (Array.isArray(roomRows) && roomRows[0]) {
        const r = roomRows[0];
        setCurrentRoom(prev => prev ? { ...prev, photos: r.photos || [], files: r.files || [] } : r);
      }

      // Seed appointments so Details tab renders instantly
      if (Array.isArray(apptRows) && apptRows[0]) {
        setDealAppts(apptRows[0]);
      }

      // Prefetch room-scoped agreement for instant Agreement tab
      if (agRes?.data?.agreement) {
        setAgreement(agRes.data.agreement);
      }
      
      // CRITICAL: Load room-specific agreement if it exists (priority over deal-level)
      // This ensures we always show the correct agreement for the current agent
      if (roomId) {
        const roomAgRes = await base44.functions.invoke('getLegalAgreement', { deal_id: did, room_id: roomId }).catch(() => ({ data: null }));
        if (roomAgRes?.data?.agreement) {
          setAgreement(roomAgRes.data.agreement);
        }
      }

      return freshDeal;
    } catch (_) {
      return null;
    }
  };

  // Prefetch Pipeline data to make back navigation instant
  const prefetchPipeline = () => {
    try {
      // Broad invalidate to catch all pipeline deal queries regardless of key structure
      queryClient.invalidateQueries({ queryKey: ['pipelineDeals'], exact: false });
      queryClient.refetchQueries({ queryKey: ['pipelineDeals'], exact: false });
      
      // Warm rooms cache with ENRICHED + DEDUPED data (same key as useRooms)
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.refetchQueries({ queryKey: ['rooms'] });
    } catch (_) {}
  };
  
  // CRITICAL: Reload after DocuSign return with signed=1 and flip room flags
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed') && roomId && currentRoom?.deal_id) {
      console.log('[Room] 🔄 POST-SIGNING RELOAD TRIGGERED');

      const doSync = async () => {
        try {
          const syncRes = await base44.functions.invoke('docusignSyncEnvelope', { deal_id: currentRoom.deal_id });
          // If fully signed, mark room accordingly to unlock UI immediately
          const ag = (await base44.functions.invoke('getLegalAgreement', { deal_id: currentRoom.deal_id })).data?.agreement;
          if (ag?.status === 'fully_signed') {
            try { await base44.entities.Room.update(roomId, { agreement_status: 'fully_signed', request_status: 'signed', signed_at: new Date().toISOString(), is_fully_signed: true }); } catch (_) {}
          } else if (ag?.status === 'investor_signed' || ag?.investor_signed_at) {
            try { await base44.entities.Room.update(roomId, { agreement_status: 'investor_signed' }); } catch (_) {}
          }
          await refreshRoomState();
          queryClient.invalidateQueries({ queryKey: ['rooms'] });
          queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
        } catch (error) {
          console.error('[Room] Sync failed:', error);
          await refreshRoomState();
        }
      };

      doSync();
      setTimeout(doSync, 1000);
      setTimeout(doSync, 2500);
    }
  }, [location.search, roomId, currentRoom?.deal_id]);

  // Fetch current room with server-side access control
  useEffect(() => {
    if (!roomId) return;
    
    const fetchCurrentRoom = async () => {
      const rid = roomId;
      const thisReq = ++requestSeqRef.current;
      const isStale = () => (roomId !== rid || requestSeqRef.current !== thisReq);
      
      try {
        // Always set loading on room change to ensure fresh data
        setRoomLoading(true);
        setAgreement(null); // Clear stale agreement
        setAgreementPanelKey(prev => prev + 1); // Force SimpleAgreementPanel remount
        
        // CRITICAL: Always fetch fresh room data directly to avoid stale cached data
        const rawRoom = (await base44.entities.Room.filter({ id: roomId }))?.[0];

         if (!rawRoom) {
           setRoomLoading(false);
           return;
         }

        // MULTI-AGENT: Load invites if this is an investor viewing a deal with multiple agents
         if (rawRoom.deal_id && profile?.user_role === 'investor') {
           try {
             const invitesRes = await base44.functions.invoke('getDealInvitesForInvestor', { deal_id: rawRoom.deal_id });
             let loadedInvites = [];

             // Handle different response formats
             if (invitesRes.data?.invites) {
               loadedInvites = Array.isArray(invitesRes.data.invites) ? invitesRes.data.invites : [];
             } else if (Array.isArray(invitesRes.data)) {
               loadedInvites = invitesRes.data;
             }

             // CRITICAL: Filter out expired, voided, and locked invites
             // Only show active invites (pending signature)
             loadedInvites = loadedInvites.filter(invite => 
               !['EXPIRED', 'VOIDED', 'LOCKED'].includes(invite.status)
             );

             console.log('[Room] Loaded active invites:', loadedInvites.length);
             setInvites(loadedInvites);

             // Auto-select if only one invite exists
             if (loadedInvites.length === 1) {
               setSelectedInvite(loadedInvites[0]);
             }
           } catch (e) {
             console.error('[Room] Failed to load invites:', e);
           }
         }

        // Optimistic hydrate from cache (instant UI) while fetching securely
        if (rawRoom.deal_id) {
          const cached = getCachedDeal(rawRoom.deal_id);
          if (cached) {
            // Ensure cached belongs to this deal id (guard against residual cache)
            if (cached.id !== rawRoom.deal_id) {
              // ignore wrong cached snapshot
            } else if (shouldMaskAddress(profile, rawRoom, cached) && cached.property_address) {
              setDeal({ ...cached, property_address: null });
            } else {
              setDeal(cached);
            }
          }

          // Use server-side access-controlled deal fetch
          try {
            const response = await base44.functions.invoke('getDealDetailsForUser', {
              dealId: rawRoom.deal_id
            });
            const dealData = response.data;
            
            if (dealData) {
              setDeal(dealData);
              setCachedDeal(dealData.id, dealData);
              
              const displayTitle = profile?.user_role === 'agent' && !dealData.is_fully_signed
                ? `${dealData.city || 'City'}, ${dealData.state || 'State'}`
                : dealData.title;
              
              // Ensure we still match current selection
              if (rid !== roomId) return;
              setCurrentRoom({
                ...rawRoom,
                title: displayTitle,
                property_address: shouldMaskAddress(profile, rawRoom, dealData) ? null : dealData.property_address,
                city: dealData.city,
                state: dealData.state,
                county: dealData.county,
                zip: dealData.zip,
                budget: dealData.purchase_price,
                pipeline_stage: dealData.pipeline_stage,
                closing_date: dealData.key_dates?.closing_date,
                deal_assigned_agent_id: dealData.agent_id,
                is_fully_signed: dealData.is_fully_signed,
                property_type: dealData.property_type,
                property_details: dealData.property_details,
                proposed_terms: dealData.proposed_terms,
                photos: rawRoom?.photos || [],
                files: rawRoom?.files || [],
                counterparty_name: enrichedRoom?.counterparty_name || rawRoom.counterparty_name || (profile?.user_role === 'agent' ? (dealData?.investor_name || dealData?.investor?.full_name) : (dealData?.agent_name || dealData?.agent?.full_name))
              });
            } else {
              setCurrentRoom(rawRoom);
            }
          } catch (error) {
            console.error('Failed to fetch deal:', error);
            setCurrentRoom(rawRoom);
          }
        } else {
          setCurrentRoom(rawRoom);
        }
      } catch (error) {
        console.error('Failed to fetch room:', error);
      } finally {
        setRoomLoading(false);
      }
    };
    
    fetchCurrentRoom().finally(() => {
      lastFetchKeyRef.current = `${roomId}|${profile?.user_role}`;
    });
  }, [roomId, profile?.user_role, rooms]);
  
  // Load and subscribe to DealAppointments for walkthrough display
  useEffect(() => {
    const did = currentRoom?.deal_id;
    if (!did) { setDealAppts(null); return; }
    let cancelled = false;

    const load = async () => {
      try {
        const rows = await base44.entities.DealAppointments.filter({ dealId: did });
        if (!cancelled) setDealAppts(rows?.[0] || null);
      } catch (_) {}
    };

    load();
    const unsubscribe = base44.entities.DealAppointments.subscribe((event) => {
      if (event?.data?.dealId === did) {
        setDealAppts(event.data);
      }
    });

    return () => {
      cancelled = true;
      try { unsubscribe && unsubscribe(); } catch (_) {}
    };
  }, [currentRoom?.deal_id]);

  // Realtime updates for Room and Deal to keep board instantly fresh
  useEffect(() => {
    if (!roomId && !currentRoom?.deal_id) return;
    const unsubscribers = [];
    const freeze = showBoard && activeTab === 'details';

    if (roomId) {
      const unsubRoom = base44.entities.Room.subscribe((event) => {
        if (event.id === roomId) {
          setCurrentRoom((prev) => {
            if (freeze) return prev || { ...(event.data || {}), id: roomId };
            if (!prev || prev.id !== roomId) return { ...(event.data || {}), id: roomId };
            return { ...prev, ...event.data };
          });
        }
      });
      unsubscribers.push(unsubRoom);
    }

    if (currentRoom?.deal_id) {
      const dealId = currentRoom.deal_id;
      const unsubDeal = base44.entities.Deal.subscribe((event) => {
        if (event.id === dealId) {
          setDeal((prev) => {
            if (freeze) return prev || { ...(event.data || {}), id: dealId };
            if (!prev || prev.id !== dealId) return { ...(event.data || {}), id: dealId };
            return { ...prev, ...event.data };
          });
        }
      });
      unsubscribers.push(unsubDeal);
    }

    return () => {
      unsubscribers.forEach((u) => {
        try { u(); } catch (_) {}
      });
    };
  }, [roomId, currentRoom?.deal_id, showBoard, activeTab]);

  // Real-time agreement updates + load pending counters
  useEffect(() => {
    if (!currentRoom?.deal_id) return;
    
    const dealId = currentRoom.deal_id;
    
    // Define effective room ID: when investor has selected an agent from invites, use that room_id
    // Otherwise, use the URL room_id (for single agent scenarios)
    const isMultiAgent = profile?.user_role === 'investor' && invites.length > 1 && !deal?.locked_agent_profile_id;
    const effectiveRoomId = isMultiAgent && selectedInvite ? selectedInvite.room_id : roomId;
    console.log('[Room] effectiveRoomId:', effectiveRoomId, 'isMultiAgent:', isMultiAgent, 'selectedInvite:', selectedInvite?.id);

    // Load pending counters immediately - STRICTLY room-scoped ONLY to effective room
    const loadCounters = async () => {
      try {
        // For room-scoped: filter by room_id AND status=pending to exclude completed/superseded
        const filterQuery = effectiveRoomId 
          ? { room_id: effectiveRoomId, status: 'pending' }
          : { deal_id: dealId, status: 'pending' };
          
        const roomCounters = await base44.entities.CounterOffer.filter(filterQuery);
        console.log('[Room] Loaded pending counters:', roomCounters.length, 'for effective room:', effectiveRoomId);
        
        // CRITICAL: Double-check status to exclude any non-pending that slipped through
        const strictlyPending = (roomCounters || []).filter(c => c.status === 'pending');
        setPendingCounters(strictlyPending);
      } catch (e) {
        console.error('[Room] Counter load error:', e);
        setPendingCounters([]);
      }
    };

    loadCounters();

    // Subscribe to LegalAgreement for real-time signature updates
    // STRICTLY prefer room-scoped agreements for effective room
    const unsubAgreement = base44.entities.LegalAgreement.subscribe((event) => {
      if (event?.data?.deal_id === dealId) {
        // ONLY update if this agreement is for THIS effective ROOM
        if (event?.data?.room_id === effectiveRoomId) {
          console.log('[Room] Room-scoped agreement updated for this agent');
          setAgreement(prev => {
            // Always update - don't compare signing status as it may have changed
            return event.data;
          });
        }
        // Ignore deal-level agreements if we have a room-scoped one
        else if (!event?.data?.room_id && !agreement?.room_id) {
          console.log('[Room] Deal-level agreement (no room-scoped override)');
          setAgreement(event.data);
        }
      }
    });

    // Subscribe to CounterOffer updates - STRICTLY ROOM-SCOPED to effective room
    const unsubCounter = base44.entities.CounterOffer.subscribe((event) => {
      console.log('[Room] CounterOffer event:', event.type, 'dealId:', event?.data?.deal_id, 'roomId:', event?.data?.room_id, 'status:', event?.data?.status);
      
      // CRITICAL: Only update state if this counter is EXPLICITLY for this effective room
      if (event?.data?.deal_id === dealId && event?.data?.room_id === effectiveRoomId) {
        console.log('[Room] Counter matches this room, updating state');
        
        // CRITICAL: Only keep pending counters in UI, remove all others (accepted/declined/superseded/completed)
        if (event.data.status === 'pending') {
          setPendingCounters(prev => {
            const exists = prev.some(c => c.id === event.id);
            const updated = exists ? prev.map(c => c.id === event.id ? event.data : c) : [...prev, event.data];
            console.log('[Room] Updated pendingCounters:', updated.length);
            return updated;
          });
        } else {
          // Remove counter if status changed to anything other than pending
          setPendingCounters(prev => {
            const filtered = prev.filter(c => c.id !== event.id);
            console.log('[Room] Removed non-pending counter, remaining:', filtered.length);
            return filtered;
          });
        }
      } else {
        console.log('[Room] Counter does NOT match this room, ignoring');
      }
      // IMPORTANT: Do NOT update state if room_id doesn't match - ignore counters for other agents
    });

    return () => {
      try { unsubAgreement?.(); } catch (_) {}
      try { unsubCounter?.(); } catch (_) {}
    };
  }, [currentRoom?.deal_id, roomId, profile?.user_role, invites.length, selectedInvite, deal?.locked_agent_profile_id]); 

  // Auto-sync chat attachments into Room.photos and Room.files (from message metadata)
  useEffect(() => {
    if (!roomId || !currentRoom) return;
    if (!messages || messages.length === 0) return;

    // Detect photos: explicit type=photo OR file_type starts with image/
    const photoMsgs = messages.filter(m => {
      const t = m?.metadata?.type;
      const ft = m?.metadata?.file_type || '';
      // Accept only explicit chat photo messages to avoid double-adding after manual uploads
      return !!m?.metadata?.file_url && t === 'photo';
    });

    // Detect non-image files: explicit type=file and not image mime
    const fileMsgs = messages.filter(m => {
      const t = m?.metadata?.type;
      const ft = m?.metadata?.file_type || '';
      return !!m?.metadata?.file_url && (t === 'file' || (!!t && t !== 'photo')) && !ft.startsWith('image/');
    });

    if (photoMsgs.length === 0 && fileMsgs.length === 0) return;

    const existingPhotoUrls = new Set((currentRoom.photos || []).map(p => p.url));
    const existingFileUrls = new Set((currentRoom.files || []).map(f => f.url));

    const newPhotos = photoMsgs
      .filter(m => !existingPhotoUrls.has(m.metadata.file_url))
      .map(m => ({
        name: m.metadata.file_name || 'photo.jpg',
        url: m.metadata.file_url,
        uploaded_by: m.sender_profile_id,
        uploaded_by_name: m.metadata.uploaded_by_name || m.sender_name || (profile?.full_name || profile?.email || 'Chat'),
        uploaded_at: m.created_date || new Date().toISOString(),
        size: m.metadata.file_size || 0,
        type: 'image'
      }));

    const newFiles = fileMsgs
      .filter(m => !existingFileUrls.has(m.metadata.file_url))
      .map(m => ({
        name: m.metadata.file_name || 'document',
        url: m.metadata.file_url,
        uploaded_by: m.sender_profile_id,
        uploaded_by_name: m.metadata.uploaded_by_name || m.sender_name || (profile?.full_name || profile?.email || 'Chat'),
        uploaded_at: m.created_date || new Date().toISOString(),
        size: m.metadata.file_size || 0,
        type: m.metadata.file_type || 'application/octet-stream'
      }));

    if (newPhotos.length === 0 && newFiles.length === 0) return;

    (async () => {
      try {
        const mergedPhotos = [...(currentRoom.photos || []), ...newPhotos];
        const mergedFiles = [...(currentRoom.files || []), ...newFiles];
        const uniquePhotos = mergedPhotos.filter((p, i, arr) => p?.url && arr.findIndex(x => x?.url === p.url) === i);
        const uniqueFiles = mergedFiles.filter((f, i, arr) => f?.url && arr.findIndex(x => x?.url === f.url) === i);
        await base44.entities.Room.update(roomId, { photos: uniquePhotos, files: uniqueFiles });
        // Optimistic local update for immediate UI feedback
        setCurrentRoom(prev => prev ? { ...prev, photos: uniquePhotos, files: uniqueFiles } : prev);
      } catch (_) {}
    })();
  }, [messages, roomId, currentRoom?.id]);

  // Multi-agent mode: Show pending agents instead of messages for investors with multiple agents
  // Exit multi-agent mode ONLY when deal is locked OR room is fully signed (both parties signed)
  const isMultiAgentMode = profile?.user_role === 'investor' && invites.length > 1 && !deal?.locked_agent_profile_id && !deal?.locked_room_id && !currentRoom?.is_fully_signed && currentRoom?.agreement_status !== 'fully_signed' && !deal?.is_fully_signed;



   // Auto-extract property details from Seller Contract if missing
   useEffect(() => {
     if (!deal?.id) return;

     // Block agents from touching seller contract before agreement is fully signed
     if (profile?.user_role === 'agent' && !isWorkingTogether) return;

    const hasDetails =
      !!(deal.property_type) ||
      !!(deal.property_details &&
         (deal.property_details.beds != null ||
          deal.property_details.baths != null ||
          deal.property_details.sqft != null ||
          deal.property_details.year_built != null ||
          deal.property_details.number_of_stories ||
          typeof deal.property_details.has_basement === 'boolean'));

    const sellerUrl =
      deal?.documents?.purchase_contract?.file_url ||
      deal?.documents?.purchase_contract?.url ||
      deal?.contract_document?.url ||
      deal?.contract_url ||
      currentRoom?.contract_document?.url ||
      currentRoom?.contract_url;

    if (hasDetails || !sellerUrl) return;

    (async () => {
      try {
        const { data: extraction } = await base44.functions.invoke('extractContractData', { fileUrl: sellerUrl });
        const d = extraction?.data || extraction;

        if (!d) return;

        // Build extracted draft in UI state (do not write to Deal automatically)
        const draft = {
          property_type: d.property_type || null,
          property_details: {}
        };
        if (d.property_details?.beds != null) draft.property_details.beds = d.property_details.beds;
        if (d.property_details?.baths != null) draft.property_details.baths = d.property_details.baths;
        if (d.property_details?.sqft != null) draft.property_details.sqft = d.property_details.sqft;
        if (d.property_details?.year_built != null) draft.property_details.year_built = d.property_details.year_built;
        if (d.property_details?.number_of_stories) draft.property_details.number_of_stories = d.property_details.number_of_stories;
        if (typeof d.property_details?.has_basement === 'boolean') draft.property_details.has_basement = d.property_details.has_basement;

        if ((draft.property_type) || Object.keys(draft.property_details).length > 0) {
          setExtractedDraft(draft);
        }
      } catch (e) {
        console.error('[Room] auto-extract failed:', e);
      }
    })();
  }, [deal?.id, deal?.documents, currentRoom?.contract_document, currentRoom?.contract_url]);

  // Build a robust deal object for details card: prefer Deal entity, fallback to Room fields
  const dealForDetails = useMemo(() => {
    // Stable snapshot: prefer deal when available, but never fall back to undefined mid-transition
    const base = deal || currentRoom || {};
    const hasPD = !!(base?.property_details && Object.keys(base.property_details || {}).length > 0);
    const maskedAddress = maskAddr ? null : (base?.property_address || currentRoom?.property_address);
    return {
      ...(base || {}),
      property_address: maskedAddress,
      property_type: base?.property_type || currentRoom?.property_type || null,
      property_details: hasPD ? base.property_details : (currentRoom?.property_details || {})
    };
  }, [showBoard, activeTab, deal, currentRoom, maskAddr]);

  // Prefill editor when deal details load (only when board is open to avoid flicker)
  useEffect(() => {
    if (!showBoard) return;
    const d = (deal || {})
    const pd = d.property_details || {};
    setPdPropertyType(d.property_type || "");
    setPdBeds(pd.beds != null ? String(pd.beds) : "");
    setPdBaths(pd.baths != null ? String(pd.baths) : "");
    setPdSqft(pd.sqft != null ? String(pd.sqft) : "");
    setPdYearBuilt(pd.year_built != null ? String(pd.year_built) : "");
    setPdStories(pd.number_of_stories || "");
    setPdBasement(
      typeof pd.has_basement === 'boolean'
        ? (pd.has_basement ? 'yes' : 'no')
        : (pd.has_basement || '')
    );
  }, [showBoard, deal?.property_type, deal?.property_details]);

  const savePropertyDetails = async () => {
    if (!currentRoom?.deal_id) return;
    try {
      const updates = {
        property_type: pdPropertyType || null,
        property_details: {
          ...(pdBeds ? { beds: Number(pdBeds) } : {}),
          ...(pdBaths ? { baths: Number(pdBaths) } : {}),
          ...(pdSqft ? { sqft: Number(pdSqft) } : {}),
          ...(pdYearBuilt ? { year_built: Number(pdYearBuilt) } : {}),
          ...(pdStories ? { number_of_stories: pdStories } : {}),
          ...(pdBasement ? { has_basement: pdBasement === 'yes' } : {})
        }
      };
      await base44.entities.Deal.update(currentRoom.deal_id, updates);
      toast.success('Property details saved');
      setEditingPD(false);
      await refreshRoomState();
    } catch (e) {
      toast.error('Failed to save details');
    }
  };

  const counterpartName = (() => {
    const baseName = getCounterpartyDisplayName({ room: currentRoom, deal, currentUserRole: profile?.user_role }) || location.state?.initialCounterpartyName;
    if (deal?.is_fully_signed) {
      if (profile?.user_role === 'investor') return deal?.agent_full_name || baseName || 'Agent';
      if (profile?.user_role === 'agent') return deal?.investor_full_name || baseName || 'Investor';
    }
    return baseName || 'Chat';
  })();



  // Ensure full Deal document visibility after both parties are working together
  useEffect(() => {
    if (!isWorkingTogether || !currentRoom?.deal_id) return;
    const missingSeller = !deal?.documents?.purchase_contract && !deal?.contract_document?.url && !deal?.contract_url;
    const missingInternal = !deal?.documents?.internal_agreement && !deal?.final_pdf_url && !deal?.docusign_pdf_url;
    if (missingSeller || missingInternal) {
      base44.entities.Deal.filter({ id: currentRoom.deal_id })
        .then((res) => {
          if (Array.isArray(res) && res[0]) {
            setDeal((prev) => ({ ...prev, ...res[0] }));
          }
        })
        .catch(() => {});
    }
  }, [isWorkingTogether, currentRoom?.deal_id]);
  
  // Robust agent profile ID - check multiple sources
  const roomAgentProfileId =
    currentRoom?.agentId ||
    (currentRoom?.counterparty_role === 'agent' ? currentRoom?.counterparty_profile?.id : null) ||
    null;

  // PHASE 3: Enforce lock-in - redirect to locked room if exists
  useEffect(() => {
    if (!currentRoom || !profile) return;

    const dealId = currentRoom.deal_id;
    if (!dealId) return;

    // Check lock-in for both investors and agents
    const checkLockIn = async () => {
      try {
        const dealArr = await base44.entities.Deal.filter({ id: dealId });
        const deal = dealArr?.[0];
        
        if (deal?.locked_room_id && deal.locked_room_id !== roomId) {
          console.log('[Room] Deal is locked to another room, redirecting...');
          toast.error("This deal is now exclusive to another agent");
          navigate(`${createPageUrl("Room")}?roomId=${deal.locked_room_id}`, { replace: true });
        }
      } catch (error) {
        console.error("Failed to check lock-in:", error);
      }
    };

    checkLockIn();
  }, [currentRoom, profile, roomId, navigate]);

  const send = async () => {
    const t = text.trim();
    if (!t || !roomId || sending) return;
    if (!isChatEnabled) {
      toast.error('Chat unlocks after both parties sign the agreement.');
      return;
    }
    // Client-side throttle: 1.5s between sends
    const now = Date.now();
    if (now - (lastSentRef.current || 0) < 1000) {
      return; // ignore rapid double-taps silently to avoid flicker
    }
    lastSentRef.current = now;
    setText("");
    setSending(true);
    
    // Optimistic update - show message immediately at the bottom
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      room_id: roomId,
      sender_profile_id: profile?.id,
      sender_user_id: profile?.user_id,
      senderUserId: profile?.user_id,
      body: t,
      created_date: new Date().toISOString(),
      _isOptimistic: true,
      _isMe: true
    };
    setItems(prev => [...prev, optimisticMessage]);

    
    try {
      const response = await base44.functions.invoke('sendMessage', { 
        room_id: roomId, 
        body: t 
      });

      // If server returned the message, append it with me-flag to avoid side flip
      const serverMsg = response?.data?.message;

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

      // Replace optimistic with server one, preserving side
      setItems(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId);
        const finalized = serverMsg ? { ...serverMsg, _isMe: true } : null;
        return finalized ? [...withoutTemp, finalized] : withoutTemp;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      const status = (error && error.response && error.response.status) || error?.status;
      const serverMsg = (error && error.response && error.response.data && error.response.data.error) || (error && error.data && error.data.error);
      if (status === 429 || /rate limit/i.test(serverMsg || '')) {
        toast.error('You are sending messages too quickly. Please wait a moment and try again.');
      } else {
        toast.error(`Failed to send: ${serverMsg || error.message}`);
      }
      setItems(prev => prev.filter(m => m.id !== tempId));
    } finally { 
      setSending(false);
    }
  };





  // PHASE 7: Memoize filtered rooms - exclude expired and locked-to-other-agent
  const filteredRooms = useMemo(() => {
    try {
      const isAgent = profile?.user_role === 'agent';
      const myId = profile?.id;
      const normId = (v) => String(v || '').trim();
      const score = (r) => (r?.agreement_status === 'fully_signed' || r?.is_fully_signed || r?.request_status === 'signed') ? 3 : r?.request_status === 'accepted' ? 2 : r?.request_status === 'requested' ? 1 : 0;

      // 1) Filter and group by normalized deal_id
      const byDeal = new Map();
      (rooms || []).forEach((r) => {
        if (!r) return;
        const did = normId(r.deal_id);
        if (!did) return;

        // CRITICAL: Filter out expired, locked (if not mine), and voided rooms
        if (r.request_status === 'expired' || r.request_status === 'voided') return;

        // For agents: exclude any locked room that isn't mine
        if (isAgent && r.request_status === 'locked' && r.agentId !== myId) {
          console.log('[Room] Filtering out locked room - not for this agent:', r.id);
          return;
        }

        // Role-specific visibility
        if (isAgent) {
          if (myId && r.agentId && r.agentId !== myId) return;
          const ok = !r.request_status || ['requested', 'accepted', 'signed', 'locked'].includes(r.request_status);
          if (!ok) return;
        } else if (myId) {
          if (r.investorId && r.investorId !== myId) return;
        }

        const prev = byDeal.get(did);
        if (!prev) { byDeal.set(did, r); return; }
        const sA = score(r), sB = score(prev);
        const tA = new Date(r.updated_date || r.created_date || 0).getTime();
        const tB = new Date(prev.updated_date || prev.created_date || 0).getTime();
        if (sA > sB || (sA === sB && tA > tB)) byDeal.set(did, r);
      });

      // 2) Secondary collapse by canonical address signature (strip apt/suite, normalize zip)
      const norm = (v) => (v ?? '').toString().trim().toLowerCase();
      const cleanAddr = (s) => norm(s)
        .replace(/\b(apt|apartment|unit|ste|suite|#)\b.*$/i, '')
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 80);
      const makeSig = (r) => [
        cleanAddr(r?.property_address || r?.deal_title || r?.title || ''),
        norm(r?.city),
        norm(r?.state),
        String(r?.zip || '').toString().slice(0, 5),
        Number(Math.round(Number(r?.budget || 0)))
      ].join('|');

      const bySig = new Map();
      for (const r of byDeal.values()) {
        const k = makeSig(r);
        const prev = bySig.get(k);
        if (!prev) { bySig.set(k, r); continue; }
        const sA = score(r), sB = score(prev);
        const tA = new Date(r.updated_date || r.created_date || 0).getTime();
        const tB = new Date(prev.updated_date || prev.created_date || 0).getTime();
        if (sA > sB || (sA === sB && tA > tB)) bySig.set(k, r);
      }

      let list = Array.from(bySig.values());

      // 3) Text filter
      if (searchConversations) {
        const q = String(searchConversations || '').toLowerCase();
        list = list.filter(r => ((r?.counterparty_name || r?.title || r?.deal_title || '')).toLowerCase().includes(q));
      }

      // 4) Final guard: ensure unique by normalized deal_id
      list = list.filter((r, i, arr) => arr.findIndex(x => normId(x.deal_id) === normId(r.deal_id)) === i);

      // 5) Sort newest first
      return list.sort((a, b) => new Date(b?.updated_date || b?.created_date || 0) - new Date(a?.updated_date || a?.created_date || 0));
    } catch (e) {
      console.error('[Room] filteredRooms error:', e);
      return Array.isArray(rooms) ? rooms.filter(r => r && r.deal_id) : [];
    }
  }, [rooms, searchConversations, profile?.user_role, profile?.id]);



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
          {filteredRooms
           .filter(r => !!String(r.deal_id || '').trim())
           // Extra safety: also ensure unique by canonical address signature in final render
           .filter((r, idx, arr) => {
             const norm = (v) => (v ?? '').toString().trim().toLowerCase();
             const cleanAddr = (s) => norm(s)
               .replace(/\b(apt|apartment|unit|ste|suite|#)\b.*$/i, '')
               .replace(/[^a-z0-9]/g, '')
               .slice(0, 80);
             const sig = `${cleanAddr(r?.property_address || r?.deal_title || r?.title || '')}|${norm(r?.city)}|${norm(r?.state)}|${String(r?.zip||'').toString().slice(0,5)}|${Number(Math.round(Number(r?.budget||0)))}`;
             return arr.findIndex(x => {
               const sigX = `${cleanAddr(x?.property_address || x?.deal_title || x?.title || '')}|${norm(x?.city)}|${norm(x?.state)}|${String(x?.zip||'').toString().slice(0,5)}|${Number(Math.round(Number(x?.budget||0)))}`;
               return sigX === sig;
             }) === idx;
           })
           .map(r => {
            const handleClick = () => {
             if (r.is_orphan) {
               // Pipeline-only deal: route to Pipeline to continue
               prefetchPipeline();
               navigate(createPageUrl("Pipeline"));
               setDrawer(false);
               return;
             }

             // Navigate without setting state - let URL change trigger fresh fetch
             navigate(`${createPageUrl("Room")}?roomId=${r.id}`);
             setDrawer(false);
            };
            
            return (
              <ConversationItem
                key={`${r.id}-${r.updated_date}`}
                room={r}
                isActive={r.id === roomId}
                onClick={handleClick}
                userRole={profile?.user_role}
                fullDeal={getCachedDeal(r.deal_id) || (r.id === roomId ? deal : undefined)}
                agreement={r.id === roomId ? agreement : undefined}
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
           onClick={() => {
             console.log('[Room] Navigating to Pipeline');
             navigate(createPageUrl("Pipeline"));
           }}
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
               {(currentRoom?.agreement_status === 'fully_signed' || currentRoom?.is_fully_signed || deal?.is_fully_signed)
                       ? counterpartName : (profile?.user_role === 'investor' ? 'Agent' : 'Investor')}
             </h2>
            <div className="flex items-center gap-3">
             {(currentRoom?.agreement_status === 'fully_signed' || 
               currentRoom?.is_fully_signed || 
               deal?.is_fully_signed || 
               agreement?.status === 'fully_signed' ||
               (agreement?.investor_signed_at && agreement?.agent_signed_at)) ? (
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
            {/* PHASE 5: Show Agent Profile button for investors when fully signed */}
            {isInvestor && isWorkingTogether && (
              <Button
                onClick={() => {
                  const agentId = deal?.locked_agent_id || roomAgentProfileId || currentRoom?.agentId || currentRoom?.counterparty_profile_id;
                  navigate(`${createPageUrl("AgentProfile")}?profileId=${agentId}`);
                }}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
              >
                <User className="w-4 h-4 mr-2" />
                Agent Profile
              </Button>
            )}
            
            {roomId && (
              <>
                <Button
                  onMouseEnter={isMultiAgentMode && !selectedInvite ? undefined : prefetchDeal}
                  onClick={async () => {
                    if (isMultiAgentMode && !selectedInvite) {
                      toast.error('Please select an agent first');
                      return;
                    }
                    setBoardLoading(true);
                    const data = await prefetchDeal();
                    if (data) {
                      setDeal(data);
                    } else if (currentRoom) {
                      const snap = buildDealFromRoom(currentRoom, maskAddr);
                      if (snap) setDeal(snap);
                    }
                    setActiveTab('details');
                    setShowBoard(true);
                    setBoardLoading(false);
                  }}
                  className={`rounded-full font-semibold transition-all ${
                       (isMultiAgentMode && !selectedInvite)
                         ? "bg-[#1F1F1F] text-[#808080]/50 cursor-not-allowed"
                         : showBoard 
                         ? "bg-[#E3C567] hover:bg-[#EDD89F] text-black" 
                         : "bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
                      }`}
                  disabled={isMultiAgentMode && !selectedInvite}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Deal Board
                </Button>
                <Button
                    onClick={() => setShowBoard(false)}
                    className={`rounded-full font-semibold transition-all ${
                         !showBoard 
                           ? "bg-[#E3C567] hover:bg-[#EDD89F] text-black" 
                           : "bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
                        }`}
                  >
                  <Send className="w-4 h-4 mr-2" />
                  {isMultiAgentMode ? 'Pending Agents' : 'Messages'}
                </Button>
                {!isWorkingTogether && (
                  <span className="ml-3 text-xs bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 px-3 py-1 rounded-full">
                    Files, Photos, and Activity unlock after both signatures
                  </span>
                )}
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
                  <span className={`w-2 h-2 rounded-full ${
                    currentRoom?.is_fully_signed ? 'bg-[#10B981]' : 
                    currentRoom?.request_status === 'accepted' ? 'bg-[#60A5FA]' : 
                    'bg-[#F59E0B]'
                  }`}></span>
                  <span className="font-bold text-[#FAFAFA] text-sm">
                    {/* Privacy: Hide full address from agents until agreement is fully signed */}
                    {isAgentView && !currentRoom?.is_fully_signed
                              ? `${currentRoom.city || 'City'}, ${currentRoom.state || 'State'}`
                              : (currentRoom.title || `Chat with ${counterpartName}`)
                            }
                  </span>
                  <span className="text-[#555] text-xs">•</span>
                  <span className="text-[#808080] text-xs uppercase tracking-wider font-semibold">
                   {currentRoom?.is_fully_signed || 
                    currentRoom?.agreement_status === 'fully_signed' ||
                    deal?.is_fully_signed ||
                    agreement?.status === 'fully_signed' ||
                    (agreement?.investor_signed_at && agreement?.agent_signed_at) ? (
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
                       {isAgentView && !currentRoom?.is_fully_signed
                        ? [currentRoom.city, currentRoom.state].filter(Boolean).join(', ')
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
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 will-change-transform">
          {showBoard ? (
            /* Deal Board View with Tabs */
            <div className="space-y-6 max-w-6xl mx-auto relative">

              {/* Tab Navigation */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-2 flex gap-2 overflow-x-auto items-center">
                {(isWorkingTogether
                  ? [
                      { id: 'details', label: 'Property Details', icon: Info },
                      { id: 'agreement', label: 'My Agreement', icon: Shield },
                      { id: 'files', label: 'Files', icon: FileText },
                      { id: 'photos', label: 'Photos', icon: Image },
                      { id: 'activity', label: 'Events & Activity', icon: FileText }
                    ]
                  : [
                      { id: 'details', label: 'Property Details', icon: Info },
                      { id: 'agreement', label: 'My Agreement', icon: Shield }
                    ]
                ).map(tab => {
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
                <div className="ml-auto pr-2">
                  {boardLoading && (
                    <Loader2 className="w-4 h-4 text-[#808080] animate-spin" />
                  )}
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Removed - LegalAgreementPanel shows all status info */}
                  
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
                                               {currentRoom?.is_fully_signed 
                                                 ? (currentRoom?.counterparty_name || 'Agent')
                                                 : 'Hidden until agreement fully signed'}
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

                                  {/* 2. DEAL DETAILS */}
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
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {currentRoom?.counterparty_name
                                            ? (currentRoom?.is_fully_signed
                                                ? currentRoom.counterparty_name
                                                : currentRoom.counterparty_name.split(' ')[0])
                                            : '—'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Walkthrough</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {dealAppts?.walkthrough?.datetime
                                            ? `${(dealAppts.walkthrough.status || 'SCHEDULED').replace(/_/g, ' ').toUpperCase()} • ${new Date(dealAppts.walkthrough.datetime).toLocaleString()}`
                                            : 'TBD'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Closing Date</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {(deal?.key_dates?.closing_date || currentRoom?.closing_date)
                                            ? new Date(deal?.key_dates?.closing_date || currentRoom?.closing_date).toLocaleDateString()
                                            : 'TBD'}
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

                                  {/* Deal Summary removed per request */}

                                  <PropertyDetailsCard deal={dealForDetails} />

                                  <DealAppointmentsCard dealId={currentRoom?.deal_id} userRole={profile?.user_role} />

                                  {/* Suggested details from Seller Contract (requires confirmation) */}
                                  {profile?.user_role === 'investor' && extractedDraft && (
                                    <div className="bg-[#0D0D0D] border border-[#F59E0B]/30 rounded-2xl p-6">
                                      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-1 flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-[#F59E0B]" />
                                        Apply Extracted Property Details
                                      </h4>
                                      <p className="text-xs text-[#808080] mb-4">We found details in your seller contract. Review and confirm before saving.</p>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                        {extractedDraft.property_details?.beds != null && (
                                          <div className="flex justify-between"><span className="text-[#808080]">Bedrooms</span><span className="text-[#FAFAFA] font-medium">{extractedDraft.property_details.beds}</span></div>
                                        )}
                                        {extractedDraft.property_details?.baths != null && (
                                          <div className="flex justify-between"><span className="text-[#808080]">Bathrooms</span><span className="text-[#FAFAFA] font-medium">{extractedDraft.property_details.baths}</span></div>
                                        )}
                                        {extractedDraft.property_details?.sqft != null && (
                                          <div className="flex justify-between"><span className="text-[#808080]">Square Feet</span><span className="text-[#FAFAFA] font-medium">{extractedDraft.property_details.sqft}</span></div>
                                        )}
                                        {extractedDraft.property_details?.year_built != null && (
                                          <div className="flex justify-between"><span className="text-[#808080]">Year Built</span><span className="text-[#FAFAFA] font-medium">{extractedDraft.property_details.year_built}</span></div>
                                        )}
                                        {extractedDraft.property_details?.number_of_stories && (
                                          <div className="flex justify-between"><span className="text-[#808080]">Stories</span><span className="text-[#FAFAFA] font-medium">{extractedDraft.property_details.number_of_stories}</span></div>
                                        )}
                                        {typeof extractedDraft.property_details?.has_basement === 'boolean' && (
                                          <div className="flex justify-between"><span className="text-[#808080]">Basement</span><span className="text-[#FAFAFA] font-medium">{extractedDraft.property_details.has_basement ? 'Yes' : 'No'}</span></div>
                                        )}
                                      </div>
                                      <div className="flex gap-2 mt-4">
                                        <Button
                                          className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                                          onClick={async () => {
                                            if (!currentRoom?.deal_id) { setExtractedDraft(null); return; }
                                            const existing = deal?.property_details || {};
                                            const src = extractedDraft.property_details || {};
                                            const patch = { property_details: {} };
                                            if (src.beds != null && existing.beds == null) patch.property_details.beds = src.beds;
                                            if (src.baths != null && existing.baths == null) patch.property_details.baths = src.baths;
                                            if (src.sqft != null && existing.sqft == null) patch.property_details.sqft = src.sqft;
                                            if (src.year_built != null && existing.year_built == null) patch.property_details.year_built = src.year_built;
                                            if (src.number_of_stories && !existing.number_of_stories) patch.property_details.number_of_stories = src.number_of_stories;
                                            if (typeof src.has_basement === 'boolean' && typeof existing.has_basement !== 'boolean') patch.property_details.has_basement = src.has_basement;

                                            if (Object.keys(patch.property_details).length === 0) {
                                              toast.info('No new fields to apply');
                                              setExtractedDraft(null);
                                              return;
                                            }

                                            try {
                                              await base44.entities.Deal.update(currentRoom.deal_id, patch);
                                              toast.success('Extracted details applied');
                                              setExtractedDraft(null);
                                              await refreshRoomState();
                                            } catch (e) {
                                              toast.error('Failed to apply details');
                                            }
                                          }}
                                        >
                                          Apply to Deal
                                        </Button>
                                        <Button variant="outline" className="rounded-full" onClick={() => setExtractedDraft(null)}>
                                          Dismiss
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  {profile?.user_role === 'investor' && (
                                    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                      <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-semibold text-[#FAFAFA]">Edit Property Details</h4>
                                        {!editingPD ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="rounded-full border-[#1F1F1F] text-[#FAFAFA] hover:border-[#E3C567]"
                                            onClick={() => setEditingPD(true)}
                                          >
                                            Edit
                                          </Button>
                                        ) : null}
                                      </div>

                                      {editingPD ? (
                                                              <div className="space-y-4">
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                              <label className="block text-sm text-[#FAFAFA] mb-2">Property Type</label>
                                              <Select value={pdPropertyType} onValueChange={setPdPropertyType}>
                                                <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"><SelectValue placeholder="Select type" /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="single_family">Single Family</SelectItem>
                                                  <SelectItem value="multi_family">Multi-Family</SelectItem>
                                                  <SelectItem value="condo">Condo</SelectItem>
                                                  <SelectItem value="townhouse">Townhouse</SelectItem>
                                                  <SelectItem value="manufactured">Manufactured</SelectItem>
                                                  <SelectItem value="land">Land</SelectItem>
                                                  <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div>
                                              <label className="block text-sm text-[#FAFAFA] mb-2">Bedrooms</label>
                                              <Input type="number" value={pdBeds} onChange={(e) => setPdBeds(e.target.value)} className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]" />
                                            </div>
                                            <div>
                                              <label className="block text-sm text-[#FAFAFA] mb-2">Bathrooms</label>
                                              <Input type="number" step="0.5" value={pdBaths} onChange={(e) => setPdBaths(e.target.value)} className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]" />
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                              <label className="block text-sm text-[#FAFAFA] mb-2">Square Footage</label>
                                              <Input type="number" value={pdSqft} onChange={(e) => setPdSqft(e.target.value)} className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]" />
                                            </div>
                                            <div>
                                              <label className="block text-sm text-[#FAFAFA] mb-2">Year Built</label>
                                              <Input type="number" value={pdYearBuilt} onChange={(e) => setPdYearBuilt(e.target.value)} className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]" />
                                            </div>
                                            <div>
                                              <label className="block text-sm text-[#FAFAFA] mb-2">Stories</label>
                                              <Select value={pdStories} onValueChange={setPdStories}>
                                                <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"><SelectValue placeholder="Select" /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="1">1</SelectItem>
                                                  <SelectItem value="2">2</SelectItem>
                                                  <SelectItem value="3+">3+</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                              <label className="block text-sm text-[#FAFAFA] mb-2">Basement</label>
                                              <Select value={pdBasement} onValueChange={setPdBasement}>
                                                <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"><SelectValue placeholder="Select" /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="yes">Yes</SelectItem>
                                                  <SelectItem value="no">No</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>

                                          <div className="flex justify-end gap-2 pt-2">
                                            <Button variant="outline" className="rounded-full" onClick={() => setEditingPD(false)}>Cancel</Button>
                                            <Button className="rounded-full bg-[#E3C567] hover:bg-[#EDD89F] text-black" onClick={savePropertyDetails}>Save</Button>
                                          </div>
                                        </div>
                                        ) : null}
                                        </div>
                                        )}

                                        {/* LAST: DEAL PROGRESS */}
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
                                          {isAgentView && !currentRoom?.is_fully_signed
                                            ? `Deal in ${[currentRoom?.city, currentRoom?.state].filter(Boolean).join(', ') || 'Location'}`
                                            : (currentRoom?.property_address || 'Property Address')
                                          }
                                        </h3>
                                        <p className="text-sm text-[#808080] mb-3">
                                          {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed
                                            ? `${currentRoom?.county ? currentRoom.county + ' County, ' : ''}${[currentRoom?.city, currentRoom?.state].filter(Boolean).join(', ')}${currentRoom?.zip ? ' ' + currentRoom.zip : ''}`
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
                                                ? (currentRoom?.counterparty_name || 'Investor')
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

                                  {/* 2. DEAL DETAILS (agent view) */}
                                  <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                                    <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
                                      <Info className="w-5 h-5 text-[#E3C567]" />
                                      Deal Details
                                    </h4>
                                    <div className="space-y-3">
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Property</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {isAgentView && !currentRoom?.is_fully_signed
                                            ? ([currentRoom?.city, currentRoom?.state].filter(Boolean).join(', ') || '—')
                                            : (currentRoom?.property_address || '—')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Price / Budget</span>
                                        <span className="text-sm text-[#34D399] font-semibold">${(currentRoom?.budget || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Investor</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {currentRoom?.is_fully_signed 
                                            ? (currentRoom?.counterparty_name || 'Investor')
                                            : 'Hidden until agreement signed'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Walkthrough</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {dealAppts?.walkthrough?.datetime
                                            ? `${(dealAppts.walkthrough.status || 'SCHEDULED').replace(/_/g, ' ').toUpperCase()} • ${new Date(dealAppts.walkthrough.datetime).toLocaleString()}`
                                            : 'TBD'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b border-[#1F1F1F]">
                                        <span className="text-sm text-[#808080]">Closing Date</span>
                                        <span className="text-sm text-[#FAFAFA] font-medium">
                                          {(deal?.key_dates?.closing_date || currentRoom?.closing_date)
                                            ? new Date(deal?.key_dates?.closing_date || currentRoom?.closing_date).toLocaleDateString()
                                            : 'TBD'}
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

                                  <PropertyDetailsCard deal={dealForDetails} />


                                  <DealAppointmentsCard dealId={currentRoom?.deal_id} userRole={profile?.user_role} />

                                  {/* LAST: Deal Progress (agent controls) */}
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
                </>
              )}
            </div>
          )}

          {activeTab === 'agreement' && (
                <div className="space-y-6">
                  {currentRoom?.deal_id ? (
                     <SimpleAgreementPanel
                       key={agreementPanelKey}
                       dealId={currentRoom.deal_id}
                       roomId={isMultiAgentMode && selectedInvite ? selectedInvite.room_id : roomId}
                       agreement={isMultiAgentMode && selectedInvite ? { id: selectedInvite.legal_agreement_id } : agreement}
                       room={currentRoom}
                       profile={profile}
                       deal={deal}
                       pendingCounters={pendingCounters}
                       setPendingCounters={setPendingCounters}
                     />
                  ) : (
                    <div className="text-center py-8 text-[#808080]">No deal associated with this room</div>
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
                            {(deal?.purchase_price ?? currentRoom?.budget) ? `$${(deal?.purchase_price ?? currentRoom?.budget).toLocaleString()}` : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Earnest Money */}
                      {dealForDetails?.seller_info?.earnest_money && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#808080]">Earnest Money</p>
                            <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                              ${dealForDetails.seller_info.earnest_money.toLocaleString()}
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
                      {(deal?.proposed_terms?.seller_commission_type || currentRoom?.proposed_terms?.seller_commission_type) && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#808080]">Seller's Agent Compensation</p>
                            <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                              {((deal?.proposed_terms?.seller_commission_type ?? currentRoom?.proposed_terms?.seller_commission_type) === 'percentage')
                                ? `${(deal?.proposed_terms?.seller_commission_percentage ?? currentRoom?.proposed_terms?.seller_commission_percentage)}% of purchase price`
                                : `$${(deal?.proposed_terms?.seller_flat_fee ?? currentRoom?.proposed_terms?.seller_flat_fee)?.toLocaleString()} flat fee`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Buyer's Agent Commission - Always prefer room-scoped terms */}
                      {(currentRoom?.proposed_terms?.buyer_commission_type || deal?.proposed_terms?.buyer_commission_type) && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#808080]">Buyer's Agent Compensation</p>
                            <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                              {(currentRoom?.proposed_terms?.buyer_commission_type === 'percentage'
                                ? `${currentRoom?.proposed_terms?.buyer_commission_percentage}% of purchase price`
                                : `$${currentRoom?.proposed_terms?.buyer_flat_fee?.toLocaleString()} flat fee`) ||
                               (deal?.proposed_terms?.buyer_commission_type === 'percentage'
                                ? `${deal?.proposed_terms?.buyer_commission_percentage}% of purchase price`
                                : `$${deal?.proposed_terms?.buyer_flat_fee?.toLocaleString()} flat fee`)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Signers - Privacy Protected */}
                      {dealForDetails?.seller_info?.seller_name && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#808080]">
                              Seller ({dealForDetails.seller_info.number_of_signers === '2' ? '2 Signers' : '1 Signer'})
                            </p>
                            {profile?.user_role === 'agent' && !currentRoom?.is_fully_signed ? (
                              <p className="text-sm text-[#F59E0B] mt-1">Hidden until agreement fully signed</p>
                            ) : (
                              <p className="text-md font-semibold text-[#FAFAFA] mt-1">
                                {dealForDetails.seller_info.seller_name}
                                {dealForDetails.seller_info.number_of_signers === '2' && dealForDetails.seller_info.second_signer_name && (
                                  <span className="text-[#808080]"> & {dealForDetails.seller_info.second_signer_name}</span>
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
                  {/* Document Checklist: render only when we have stable deal */}
                  {deal && (
                    <DocumentChecklist 
                      deal={deal}
                      room={currentRoom}
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
                  )}

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
                                                          const isImage = (file.type || '').startsWith('image/');

                                                          if (isImage) {
                                                            // Save to photos and announce in chat
                                                            const existing = currentRoom?.photos || [];
                                                            const next = [...existing, {
                                                              name: file.name,
                                                              url: file_url,
                                                              uploaded_by: profile?.id,
                                                              uploaded_by_name: profile?.full_name || profile?.email,
                                                              uploaded_at: new Date().toISOString(),
                                                              size: file.size,
                                                              type: 'image'
                                                            }].filter((p, i, arr) => p?.url && arr.findIndex(x => x?.url === p.url) === i);

                                                            await base44.entities.Room.update(roomId, { photos: next });
                                                            setCurrentRoom(prev => prev ? { ...prev, photos: next } : prev);

                                                            await base44.entities.Message.create({
                                                              room_id: roomId,
                                                              sender_profile_id: profile?.id,
                                                              body: `📷 Uploaded photo: ${file.name}`,
                                                              metadata: { type: 'photo', file_url: file_url, file_name: file.name, file_type: file.type, file_size: file.size }
                                                            });

                                                            toast.success('Photo uploaded');
                                                          } else {
                                                            // Save to files (non-image)
                                                            const files = currentRoom?.files || [];
                                                            const nextFiles = [...files, {
                                                              name: file.name,
                                                              url: file_url,
                                                              uploaded_by: profile?.id,
                                                              uploaded_by_name: profile?.full_name || profile?.email,
                                                              uploaded_at: new Date().toISOString(),
                                                              size: file.size,
                                                              type: file.type
                                                            }];

                                                            await base44.entities.Room.update(roomId, { files: nextFiles });
                                                            setCurrentRoom(prev => prev ? { ...prev, files: nextFiles } : prev);

                                                            await base44.entities.Message.create({
                                                              room_id: roomId,
                                                              sender_profile_id: profile?.id,
                                                              body: `📎 Uploaded file: ${file.name}`,
                                                              metadata: { type: 'file', file_url: file_url, file_name: file.name, file_type: file.type, file_size: file.size }
                                                            });

                                                            toast.success('File uploaded');
                                                          }
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
                      {(() => {
                        // Merge system docs + user uploads
                        let allFiles = buildUnifiedFilesList({ deal, room: currentRoom });

                        // Enforce privacy: hide Seller/Purchase Contract and Internal Agreement for agents until fully signed
                        // Policy: Agents cannot see Internal Agreement in Shared Files before both parties sign; after full signing, all docs are visible.
                        const hideSeller = isAgentView && !isWorkingTogether;
                        if (hideSeller) {
                          allFiles = allFiles.filter(f => {
                            const label = (f.label || f.name || '').toLowerCase();
                            return !(
                              label.includes('seller contract') ||
                              label.includes('purchase contract') ||
                              label.includes('internal agreement') ||
                              label.includes('operating agreement')
                            );
                          });
                        }

                        // If unified list is empty but deal has legacy contract fields, surface them (INVESTOR or after fully signed only)
                        if (!hideSeller && allFiles.length === 0 && (deal?.contract_document?.url || deal?.contract_url)) {
                          allFiles = [{
                            label: 'Seller Contract',
                            url: deal?.contract_document?.url || deal?.contract_url,
                            filename: deal?.contract_document?.name || 'seller-contract.pdf',
                            uploadedBy: 'System',
                            createdAt: deal?.contract_document?.uploaded_at || deal?.updated_date
                          }];
                        }
                        // Ensure internal agreement appears using any available key
                        allFiles = allFiles.map(f => {
                          if (/internal agreement/i.test(f.label || f.name || '')) {
                            return { ...f, label: 'Internal Agreement' };
                          }
                          return f;
                        });

                        return allFiles.length === 0 ? (
                          <div className="text-center py-8">
                            <FileText className="w-12 h-12 text-[#808080] mx-auto mb-3 opacity-50" />
                            <p className="text-sm text-[#808080]">No files uploaded yet</p>
                          </div>
                        ) : (
                          allFiles.map((file, idx) => {
                            const fileUrl = file.url || file.file_url || file.urlSignedPdf;
                            const isInternalAgreement = /internal agreement/i.test((file.label || file.name || ''));

                            // For investors, show a status row for Internal Agreement until fully signed (no view/download)
                            if (isInternalAgreement && !isWorkingTogether && profile?.user_role === 'investor') {
                              return (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                                  <div className="w-10 h-10 bg-[#F59E0B]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Shield className="w-5 h-5 text-[#F59E0B]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#FAFAFA] truncate">Internal Agreement</p>
                                    <p className="text-xs text-[#F59E0B]">Pending signatures</p>
                                  </div>
                                </div>
                              );
                            }

                            return fileUrl ? (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F] hover:border-[#E3C567]/30 transition-all">
                                <div className="w-10 h-10 bg-[#E3C567]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-5 h-5 text-[#E3C567]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#FAFAFA] truncate">{file.name || file.filename || file.label}</p>
                                  <p className="text-xs text-[#808080]">
                                    {file.uploaded_by_name || file.uploadedBy || 'System'} • {new Date(file.uploaded_at || file.createdAt || Date.now()).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs bg-[#1F1F1F] hover:bg-[#333] text-[#FAFAFA] px-3 py-1.5 rounded-full transition-colors"
                                  >
                                    View
                                  </a>
                                  <a
                                    href={fileUrl}
                                    download={file.name || file.filename || file.label || 'download.pdf'}
                                    className="text-xs bg-[#E3C567] hover:bg-[#EDD89F] text-black px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    Download
                                  </a>
                                </div>
                              </div>
                            ) : null;
                          })
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

          {activeTab === 'photos' && (
            <div className="space-y-6">
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 transition-opacity duration-150" style={{ opacity: tabLoading ? 0.6 : 1 }}>
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
                              
                              const existing = currentRoom?.photos || [];
                              const merged = [...existing, ...uploads];
                              const unique = merged.filter((p, i, arr) => p?.url && arr.findIndex(x => x?.url === p.url) === i);
                              await base44.entities.Room.update(roomId, {
                                photos: unique
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
                        {((currentRoom?.photos || []).filter((p, i, arr) => !p?.url || arr.findIndex(x => x?.url === p.url) === i)).map((photo, idx) => (
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
            <>
              {/* Deal Request Review Banner for Agents - ONLY show if status is explicitly 'requested' */}
              {profile?.user_role === 'agent' && currentRoom?.request_status === 'requested' && !currentRoom?.is_fully_signed && (
                <div className="mb-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5 flex-shrink-0">
                  <div className="flex items-start gap-3 mb-2">
                    <Shield className="w-5 h-5 text-[#60A5FA] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-md font-bold text-[#60A5FA] mb-1">Review Agreement</h3>
                      <p className="text-sm text-[#FAFAFA]/80">Go to the My Agreement tab to sign or counter the compensation terms.</p>
                    </div>
                  </div>
                  <div>
                    <Button
                      onMouseEnter={prefetchDeal}
                      onClick={async () => {
                        setBoardLoading(true);
                        const data = await prefetchDeal();
                        if (data) {
                          setDeal(data);
                        } else if (currentRoom) {
                          const snap = buildDealFromRoom(currentRoom, maskAddr);
                          if (snap) setDeal(snap);
                        }
                        setActiveTab('agreement');
                        setShowBoard(true);
                        setBoardLoading(false);
                      }}
                      className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                    >
                      Open My Agreement
                    </Button>
                  </div>
                </div>
              )}

              {/* PHASE 4: Window B for Agent - Sign to lock in - Hide if fully signed */}
              {profile?.user_role === 'agent' && 
               !currentRoom?.is_fully_signed && 
               !(agreement?.investor_signed_at && agreement?.agent_signed_at) && 
               currentRoom?.agreement_status !== 'fully_signed' &&
               agreement?.status !== 'fully_signed' &&
               !deal?.is_fully_signed && 
               // Check investor signature from multiple sources
               (!!agreement?.investor_signed_at || 
                !!currentRoom?.ioa_investor_signed_at || 
                !!deal?.ioa_investor_signed_at ||
                currentRoom?.agreement_status === 'investor_signed') && (
                <div className="mb-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5 flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Shield className="w-5 h-5 text-[#60A5FA] mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="text-md font-bold text-[#60A5FA] mb-1">
                          Review terms and sign
                        </h3>
                        <p className="text-sm text-[#FAFAFA]/80">
                          Investor has signed. Review and sign to lock in this deal.
                        </p>
                      </div>
                    </div>
                    <Button
                      onMouseEnter={prefetchDeal}
                      onClick={async () => {
                        setBoardLoading(true);
                        const data = await prefetchDeal();
                        if (data) {
                          setDeal(data);
                        } else if (currentRoom) {
                          const snap = buildDealFromRoom(currentRoom, maskAddr);
                          if (snap) setDeal(snap);
                        }
                        setActiveTab('agreement');
                        setShowBoard(true);
                        setBoardLoading(false);
                      }}
                      className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold flex-shrink-0"
                    >
                      My Agreement
                    </Button>
                  </div>
                </div>
              )}

              {/* CRITICAL: Only show "Open My Agreement" banner if investor hasn't signed ANY agreement yet */}
              {profile?.user_role === 'investor' && !currentRoom?.is_fully_signed && !isMultiAgentMode && !agreement?.investor_signed_at && currentRoom?.agreement_status !== 'investor_signed' && (
                <div className="mb-4 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-5 flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Shield className="w-5 h-5 text-[#60A5FA] mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="text-md font-bold text-[#60A5FA] mb-1">
                          Review and sign agreement
                        </h3>
                        <p className="text-sm text-[#FAFAFA]/80 mb-2">
                          Open My Agreement to review and sign.
                        </p>
                        {/* PHASE 5: View Profile button in Window A */}
                        {currentRoom?.agentId && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${createPageUrl("AgentProfile")}?profileId=${currentRoom.agentId}`);
                            }}
                            size="sm"
                            className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full mt-2 font-semibold"
                          >
                            View Agent Profile
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      onMouseEnter={prefetchDeal}
                      onClick={async () => {
                        setBoardLoading(true);
                        const data = await prefetchDeal();
                        if (data) {
                          setDeal(data);
                        } else if (currentRoom) {
                          const snap = buildDealFromRoom(currentRoom, maskAddr);
                          if (snap) setDeal(snap);
                        }
                        setActiveTab('agreement');
                        setShowBoard(true);
                        setBoardLoading(false);
                      }}
                      className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold flex-shrink-0"
                    >
                      My Agreement
                    </Button>
                  </div>
                </div>
              )}









              {isMultiAgentMode ? (
                <PendingAgentsList 
                  invites={invites} 
                  onSelectAgent={(invite) => {
                    setSelectedInvite(invite);
                    toast.success('Agent selected - Deal Board is now available');
                  }}
                  selectedInviteId={selectedInvite?.id}
                />
              ) : (
                <SimpleMessageBoard roomId={roomId} profile={profile} user={user} isChatEnabled={isChatEnabled} />
              )}
            </>
          )


        </div>
      )}
    </div>
  </div>
      

</div>
  );
}
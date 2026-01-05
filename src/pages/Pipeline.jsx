import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LoadingAnimation from "@/components/LoadingAnimation";
import LegalFooterLinks from "@/components/LegalFooterLinks";
import { 
  FileText, Calendar, TrendingUp, Megaphone, CheckCircle,
  ArrowLeft, Plus, Home, Bath, Maximize2, DollarSign,
  Clock, CheckSquare, XCircle, MessageSquare, Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getOrCreateDealRoom } from "@/components/dealRooms";
import { requireInvestorSetup } from "@/components/requireInvestorSetup";
import { getRoomsFromListMyRoomsResponse } from "@/components/utils/getRoomsFromListMyRooms";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SetupChecklist from "@/components/SetupChecklist";
import { PIPELINE_STAGES, normalizeStage, getStageLabel, stageOrder } from "@/components/pipelineStages";

function PipelineContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, loading } = useCurrentProfile();
  const [deduplicating, setDeduplicating] = useState(false);

  // Redirect if profile not found after loading
  useEffect(() => {
    if (!loading && !profile) {
      toast.error("Profile not found. Please complete setup.");
      navigate(createPageUrl("PostAuth"), { replace: true });
    }
  }, [loading, profile, navigate]);

  // Manual dedup handler
  const handleDedup = async () => {
    if (!profile?.id) return;
    setDeduplicating(true);
    try {
      const response = await base44.functions.invoke('deduplicateDeals');
      if (response.data?.deletedCount > 0) {
        toast.success(`Removed ${response.data.deletedCount} duplicate deals`);
        refetchDeals();
      } else {
        toast.success('No duplicates found');
      }
    } catch (e) {
      console.error("Deduplication error", e);
      toast.error('Failed to check for duplicates');
    }
    setDeduplicating(false);
  };

  // Valid US states and territories
  const validUSStates = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
    'ALABAMA', 'ALASKA', 'ARIZONA', 'ARKANSAS', 'CALIFORNIA', 'COLORADO',
    'CONNECTICUT', 'DELAWARE', 'FLORIDA', 'GEORGIA', 'HAWAII', 'IDAHO',
    'ILLINOIS', 'INDIANA', 'IOWA', 'KANSAS', 'KENTUCKY', 'LOUISIANA',
    'MAINE', 'MARYLAND', 'MASSACHUSETTS', 'MICHIGAN', 'MINNESOTA',
    'MISSISSIPPI', 'MISSOURI', 'MONTANA', 'NEBRASKA', 'NEVADA',
    'NEW HAMPSHIRE', 'NEW JERSEY', 'NEW MEXICO', 'NEW YORK',
    'NORTH CAROLINA', 'NORTH DAKOTA', 'OHIO', 'OKLAHOMA', 'OREGON',
    'PENNSYLVANIA', 'RHODE ISLAND', 'SOUTH CAROLINA', 'SOUTH DAKOTA',
    'TENNESSEE', 'TEXAS', 'UTAH', 'VERMONT', 'VIRGINIA', 'WASHINGTON',
    'WEST VIRGINIA', 'WISCONSIN', 'WYOMING'
  ]);

  // Detect user role
  const isAgent = profile?.user_role === 'agent';
  const isInvestor = profile?.user_role === 'investor';

  // 2. Load Active Deals via Server-Side Access Control
  const { data: dealsData = [], isLoading: loadingDeals, refetch: refetchDeals } = useQuery({
    queryKey: ['pipelineDeals', profile?.id, profile?.user_role],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      // PRODUCTION: Server-side access control enforces role-based redaction
      const response = await base44.functions.invoke('getPipelineDealsForUser');
      const deals = response.data?.deals || [];
      
      // Filter out archived and deals with invalid addresses
      return deals
        .filter(d => {
          if (d.status === 'archived') return false;
          
          // Strict validation - must have real city and state
          const cityStr = String(d.city || '').trim().toLowerCase();
          const stateStr = String(d.state || '').trim().toUpperCase();
          
          const hasValidCity = 
            d.city && 
            cityStr.length > 0 && 
            cityStr !== 'null' &&
            cityStr !== 'undefined' &&
            cityStr !== 'none' &&
            cityStr !== 'n/a';
            
          const hasValidState = 
            d.state && 
            stateStr.length >= 2 && 
            validUSStates.has(stateStr);
          
          return hasValidCity && hasValidState;
        })
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!profile?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Load recent activity/notifications
  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['activities', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      // Get all deals for this user
      const dealIds = dealsData.map(d => d.id);
      if (dealIds.length === 0) return [];
      
      // Get activities for these deals
      const allActivities = await base44.entities.Activity.list('-created_date', 20);
      return allActivities.filter(a => dealIds.includes(a.deal_id));
    },
    enabled: !!profile?.id && dealsData.length > 0,
    refetchOnWindowFocus: true,
    refetchInterval: 10000 // Poll every 10 seconds
  });

  // 3. Load Rooms (to link agents/status)
  const { data: rooms = [], isLoading: loadingRooms, refetch: refetchRooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await base44.functions.invoke('listMyRooms');
      return getRoomsFromListMyRoomsResponse(res);
    },
    enabled: !!profile?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // 4. Load Pending Requests (for agents)
  const { data: pendingRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['pendingRequests', profile?.id],
    queryFn: async () => {
      if (!profile?.id || !isAgent) return [];
      const allRooms = await base44.entities.Room.filter({ agentId: profile.id });
      // Show rooms with requested status OR old pending_agent_review status (migration fallback)
      return allRooms.filter(r => 
        r.request_status === 'requested' || 
        r.deal_status === 'pending_agent_review' ||
        (!r.request_status && !r.deal_status) // New rooms without status
      );
    },
    enabled: !!profile?.id && isAgent,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Force refresh on mount
  useEffect(() => {
    if (profile?.id) {
      refetchDeals();
      refetchRooms();
    }
  }, [profile?.id]);

  // 5. Merge Data (no automatic dedup - user clicks button if needed)
  const deals = useMemo(() => {
    // Index rooms by deal_id
    const roomMap = new Map();
    rooms.forEach(r => {
      if (r.deal_id && !r.is_orphan) {
        roomMap.set(r.deal_id, r);
      }
    });

    return dealsData.map(deal => {
      const room = roomMap.get(deal.id);
      
      // Agent is accepted/signed if room status is accepted or signed
      const hasAgentAccepted = room?.request_status === 'accepted' || room?.request_status === 'signed';
      const hasAgentPending = room?.request_status === 'requested';

      // Get agent name from Deal or Room
      let agentName = 'No Agent Selected';
      if (hasAgentAccepted) {
        agentName = room?.counterparty_name || deal.agent_name || 'Agent Connected';
      } else if (hasAgentPending) {
        agentName = 'Pending Agent Review';
      }

      // For agents: show investor name. For investors: show agent name
      let counterpartyName = 'Not Assigned';
      if (isAgent) {
        counterpartyName = room?.counterparty_name || 'Investor';
      } else {
        counterpartyName = agentName;
      }

      return {
        // IDs
        id: deal.id,
        deal_id: deal.id,
        room_id: room?.id || null,

        // Content - Prefer Deal Entity (User Uploaded Data)
        title: deal.title || 'Untitled Deal',
        property_address: deal.property_address || 'Address Pending',
        city: deal.city,
        state: deal.state,
        budget: deal.purchase_price,
        seller_name: deal.seller_info?.seller_name,

        // Status & Agent  
        pipeline_stage: normalizeStage(deal.pipeline_stage || 'new_listings'),
        raw_pipeline_stage: deal.pipeline_stage,
        customer_name: counterpartyName,
        agent_id: deal.agent_id,

        // Dates
        created_date: deal.created_date,
        updated_date: deal.updated_date,
        closing_date: deal.key_dates?.closing_date,

        // Privacy flags
        is_fully_signed: room?.agreement_status === 'fully_signed' || room?.request_status === 'signed' || room?.internal_agreement_status === 'both_signed',

        is_orphan: !hasAgentAccepted && !hasAgentPending
      };
    });
  }, [dealsData, rooms]);

  const handleDealClick = async (deal) => {
    if (deal.is_orphan) {
      // Route orphan deals to NewDeal for editing, not DealWizard
      navigate(`${createPageUrl("NewDeal")}?dealId=${deal.deal_id}`);
      return;
    }
    
    // If room_id exists, navigate to it
    if (deal.room_id) {
      navigate(`${createPageUrl("Room")}?roomId=${deal.room_id}`);
      return;
    }
    
    // Otherwise, get or create the room for this deal + agent
    try {
      const roomId = await getOrCreateDealRoom({
        dealId: deal.deal_id,
        agentProfileId: deal.agent_id
      });
      navigate(`${createPageUrl("Room")}?roomId=${roomId}`);
    } catch (error) {
      console.error("Failed to create/find room:", error);
      toast.error("Failed to open conversation");
    }
  };

  const handleStageChange = async (dealId, newStage) => {
    try {
      // Normalize stage before saving (ensure canonical ID)
      const normalizedNewStage = normalizeStage(newStage);

      await base44.entities.Deal.update(dealId, {
        pipeline_stage: normalizedNewStage
      });

      // Invalidate Dashboard caches to update counts immediately
      queryClient.invalidateQueries({ queryKey: ['investorDeals', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['pipelineDeals', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });

      // Refetch local data
      refetchDeals();
    } catch (error) {
      console.error('Failed to update stage:', error);
      toast.error('Failed to update stage');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const dealId = draggableId;
    const newStage = normalizeStage(destination.droppableId); // Normalize before saving

    // Update the deal's pipeline stage
    await handleStageChange(dealId, newStage);
  };

  const formatCurrency = (val) => {
    if (!val) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getDaysInPipeline = (dateStr) => {
    if (!dateStr) return 'N/A';
    const days = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    return `${days}d`;
  };

  // Pipeline stages with icons
  const pipelineStages = PIPELINE_STAGES.map(stage => ({
    ...stage,
    icon: stage.id === 'new_listings' ? FileText :
          stage.id === 'active_listings' ? TrendingUp :
          stage.id === 'ready_to_close' ? CheckCircle :
          XCircle
  }));

  if (loading || !profile || loadingDeals || loadingRooms || deduplicating) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <LoadingAnimation className="w-64 h-64 mx-auto mb-3" />
          {deduplicating && <p className="text-sm text-[#808080]">Organizing your deals...</p>}
          {loading && <p className="text-sm text-[#808080]">Loading profile...</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      <Header profile={profile} />
      <div className="h-screen bg-transparent flex flex-col pt-4">
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="max-w-[1800px] mx-auto">
            
            {/* Setup Checklist */}
            <div className="mb-6">
              <SetupChecklist profile={profile} />
            </div>
            
            {/* Pending Requests for Agents */}
            {isAgent && pendingRequests.length > 0 && (
              <div className="bg-[#E3C567]/10 border border-[#E3C567]/30 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#E3C567]">New Deal Requests</h2>
                    <p className="text-sm text-[#808080]">{pendingRequests.length} investors want to work with you</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingRequests.map((room) => (
                    <div 
                      key={room.id}
                      className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-[#FAFAFA] font-bold text-sm mb-1">
                            {room.city}, {room.state}
                          </h3>
                          <p className="text-xs text-[#808080]">
                            {formatCurrency(room.budget)}
                          </p>
                        </div>
                        <span className="text-[10px] bg-[#E3C567]/20 text-[#E3C567] px-2 py-1 rounded-full">
                          New
                        </span>
                      </div>
                      <Button
                        onClick={() => navigate(createPageUrl("Room") + `?roomId=${room.id}`)}
                        className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs py-2"
                      >
                        Review Request
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[#E3C567]">Dashboard</h1>
                <p className="text-sm text-[#808080] mt-1">Manage your deals across all stages</p>
              </div>

              {/* Recent Activity Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    const notifPanel = document.getElementById('notifications-panel');
                    notifPanel.classList.toggle('hidden');
                  }}
                  className="relative p-3 bg-[#0D0D0D] border border-[#1F1F1F] rounded-full hover:border-[#E3C567] transition-colors"
                >
                  <svg className="w-5 h-5 text-[#E3C567]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {activities.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#E3C567] rounded-full"></span>
                  )}
                </button>

                {/* Notifications Panel */}
                <div
                  id="notifications-panel"
                  className="hidden absolute right-0 mt-2 w-96 bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col"
                >
                  <div className="p-4 border-b border-[#1F1F1F]">
                    <h3 className="text-lg font-bold text-[#E3C567]">Recent Activity</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {activities.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-[#808080]">No recent activity</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#1F1F1F]">
                        {activities.map((activity) => {
                          const deal = dealsData.find(d => d.id === activity.deal_id);
                          const getIcon = () => {
                            switch (activity.type) {
                              case 'agent_locked_in':
                              case 'agent_accepted':
                                return <CheckCircle className="w-4 h-4 text-[#10B981]" />;
                              case 'message_sent':
                                return <MessageSquare className="w-4 h-4 text-[#60A5FA]" />;
                              case 'file_uploaded':
                                return <FileText className="w-4 h-4 text-[#F59E0B]" />;
                              case 'photo_uploaded':
                                return <svg className="w-4 h-4 text-[#DB2777]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
                              case 'deal_created':
                                return <Plus className="w-4 h-4 text-[#E3C567]" />;
                              default:
                                return <Circle className="w-4 h-4 text-[#808080]" />;
                            }
                          };

                          return (
                            <button
                              key={activity.id}
                              onClick={() => {
                                if (activity.room_id) {
                                  navigate(`${createPageUrl("Room")}?roomId=${activity.room_id}`);
                                }
                                document.getElementById('notifications-panel').classList.add('hidden');
                              }}
                              className="w-full p-4 hover:bg-[#141414] transition-colors text-left"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-[#1F1F1F] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {getIcon()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[#FAFAFA] mb-1">{activity.message}</p>
                                  {deal && (
                                    <p className="text-xs text-[#E3C567] mb-1 truncate">{deal.property_address || deal.title}</p>
                                  )}
                                  <p className="text-xs text-[#808080]">
                                    {new Date(activity.created_date).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={handleDedup}
                  variant="outline"
                  size="sm"
                  disabled={deduplicating}
                  className="text-xs"
                >
                  {deduplicating ? 'Checking...' : 'Fix Duplicates'}
                </Button>
                <Button 
                  onClick={async () => {
                    if (!confirm("⚠️ WARNING: This will permanently delete ALL your deals, rooms, and messages. This action cannot be undone!\n\nAre you absolutely sure?")) {
                      return;
                    }
                    try {
                      const result = await base44.functions.invoke('deleteAllDeals', {
                        profileId: profile.id
                      });
                      toast.success("All deals deleted successfully!");
                      window.location.reload();
                    } catch (error) {
                      console.error("Failed to delete deals:", error);
                      toast.error("Failed to delete deals");
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  Delete All Deals
                </Button>
                {isInvestor && (
                  <Button 
                    onClick={async () => {
                      navigate(createPageUrl("NewDeal"));
                    }}
                    className="bg-[#E3C567] text-black hover:bg-[#D4AF37] rounded-full"
                  >
                    <Plus className="w-4 h-4 mr-2" /> New Deal
                  </Button>
                )}
              </div>
            </div>

            {/* Kanban Grid with Drag & Drop */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-3 gap-6 mb-8">
                {pipelineStages.map(stage => {
                  const stageDeals = deals.filter(d => d.pipeline_stage === stage.id);
                  const Icon = stage.icon;

                  return (
                    <div key={stage.id} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-4 flex flex-col h-[400px]">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#1F1F1F]">
                        <div className="w-8 h-8 rounded-lg bg-[#E3C567]/10 flex items-center justify-center text-[#E3C567]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-[#FAFAFA] font-bold text-sm">{stage.label}</h3>
                          <p className="text-xs text-[#808080]">{stageDeals.length} deals</p>
                        </div>
                      </div>

                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar ${
                              snapshot.isDraggingOver ? 'bg-[#E3C567]/5' : ''
                            }`}
                          >
                            {stageDeals.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-[#333] text-sm">
                                {snapshot.isDraggingOver ? 'Drop here' : 'No deals'}
                              </div>
                            ) : (
                              stageDeals.map((deal, index) => (
                                <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-[#141414] border border-[#1F1F1F] p-4 rounded-xl hover:border-[#E3C567] group transition-all ${
                                        snapshot.isDragging ? 'shadow-2xl ring-2 ring-[#E3C567] opacity-90' : ''
                                      }`}
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-[#FAFAFA] font-bold text-sm line-clamp-2 leading-tight">
                                          {/* Role-based privacy: agents see city/state only until fully signed */}
                                          {isAgent && !deal.is_fully_signed
                                            ? `${deal.city}, ${deal.state}`
                                            : deal.property_address
                                          }
                                        </h4>
                                        <span className="text-[10px] bg-[#222] text-[#808080] px-2 py-0.5 rounded-full">
                                          {getDaysInPipeline(deal.created_date)}
                                        </span>
                                      </div>

                                      <div className="flex flex-col gap-2 mb-3">
                                        <div className="flex items-center gap-1 text-xs text-[#666]">
                                          <Home className="w-3 h-3" />
                                          <span>{deal.city}, {deal.state}</span>
                                        </div>

                                        {/* Show seller name only for investors OR fully signed deals */}
                                        {(isInvestor || deal.is_fully_signed) && deal.seller_name && (
                                          <div className="text-xs text-[#808080]">
                                            Seller: {deal.seller_name}
                                          </div>
                                        )}

                                        {!deal.is_orphan && deal.customer_name && (
                                          <div className="text-xs text-[#10B981] flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" />
                                            <span>{deal.customer_name}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex gap-2 mt-3 pt-3 border-t border-[#1F1F1F]">
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDealClick(deal);
                                          }}
                                          size="sm"
                                          className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs py-1.5 h-auto"
                                        >
                                          Open Deal Room
                                        </Button>
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`${createPageUrl("NewDeal")}?dealId=${deal.deal_id}`);
                                          }}
                                          size="sm"
                                          className="flex-1 bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#1F1F1F] rounded-full text-xs py-1.5 h-auto"
                                        >
                                          Edit Deal
                                        </Button>
                                      </div>
                                      </div>
                                  )}
                                </Draggable>
                              ))
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </DragDropContext>

            {/* Legal Footer Links */}
            <LegalFooterLinks />

          </div>
        </div>
      </div>
    </>
  );
}

export default function Pipeline() {
  return (
    <AuthGuard requireAuth={true}>
      <PipelineContent />
    </AuthGuard>
  );
}
import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LoadingAnimation from "@/components/LoadingAnimation";
import { 
  FileText, Calendar, TrendingUp, Megaphone, CheckCircle,
  ArrowLeft, Plus, Home, Bath, Maximize2, DollarSign,
  Clock, CheckSquare, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getOrCreateDealRoom } from "@/components/dealRooms";
import { requireInvestorSetup } from "@/components/requireInvestorSetup";
import { getRoomsFromListMyRoomsResponse } from "@/components/utils/getRoomsFromListMyRooms";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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

  // 2. Load Active Deals (Source of Truth)
  const { data: dealsData = [], isLoading: loadingDeals, refetch: refetchDeals } = useQuery({
    queryKey: ['pipelineDeals', profile?.id, profile?.user_role],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      // Filter by role - agents see their assigned deals, investors see their created deals
      const filterKey = isAgent ? { agent_id: profile.id } : { investor_id: profile.id };
      const res = await base44.entities.Deal.filter(filterKey);
      
      // Filter out archived and deals with invalid addresses
      return res
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

  // Force refresh on mount
  useEffect(() => {
    if (profile?.id) {
      refetchDeals();
      refetchRooms();
    }
  }, [profile?.id]);

  // 4. Merge Data (no automatic dedup - user clicks button if needed)
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
      const hasAgentLocked = !!deal.agent_id;

      // Get agent name from Deal or Room
      let agentName = 'No Agent Selected';
      if (hasAgentLocked) {
        agentName = room?.counterparty_name || deal.agent_name || 'Agent Connected';
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
        budget: deal.purchase_price, // The number saved in Deal entity

        // Status & Agent
        pipeline_stage: deal.pipeline_stage || 'new_deal_under_contract',
        customer_name: counterpartyName,
        agent_id: deal.agent_id,

        // Dates
        created_date: deal.created_date,
        updated_date: deal.updated_date,
        closing_date: deal.key_dates?.closing_date,

        // Room extras
        open_tasks: room?.open_tasks || 0,
        completed_tasks: room?.completed_tasks || 0,

        is_orphan: !hasAgentLocked // Orphan if no agent assigned, regardless of room
      };
    });
  }, [dealsData, rooms]);

  const handleDealClick = async (deal) => {
    if (deal.is_orphan) {
      navigate(`${createPageUrl("DealWizard")}?dealId=${deal.deal_id}`);
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
      await base44.entities.Deal.update(dealId, {
        pipeline_stage: newStage
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
    const newStage = destination.droppableId;
    
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

  const pipelineStages = [
    { id: 'new_deal_under_contract', label: 'New Deal (Under Contract)', icon: FileText },
    { id: 'walkthrough_scheduled', label: 'Walkthrough Scheduled', icon: Calendar },
    { id: 'evaluate_deal', label: 'Evaluate Deal', icon: TrendingUp },
    { id: 'active_marketing', label: 'Active Marketing', icon: Megaphone },
    { id: 'cancelling_deal', label: 'Cancelling', icon: XCircle },
    { id: 'clear_to_close_closed', label: 'Closed', icon: CheckCircle }
  ];

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
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-[#E3C567]">Dashboard</h1>
                <p className="text-sm text-[#808080] mt-1">Manage your deals across all stages</p>
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
                {isInvestor && (
                  <Button 
                    onClick={async () => {
                      const check = await requireInvestorSetup({ profile });
                      if (!check.ok) {
                        toast.error(check.message);
                        navigate(createPageUrl(check.redirectTo));
                        return;
                      }
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
                                      <div 
                                        onClick={() => handleDealClick(deal)}
                                        className="cursor-pointer"
                                      >
                                        <div className="flex justify-between items-start mb-2">
                                          <h4 className="text-[#FAFAFA] font-bold text-sm line-clamp-2 leading-tight">
                                            {deal.property_address}
                                          </h4>
                                          <span className="text-[10px] bg-[#222] text-[#808080] px-2 py-0.5 rounded-full">
                                            {getDaysInPipeline(deal.created_date)}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                          <span className="text-xs text-[#E3C567] bg-[#E3C567]/10 px-2 py-0.5 rounded border border-[#E3C567]/20">
                                            {formatCurrency(deal.budget)}
                                          </span>
                                          {deal.is_orphan && (
                                            <span className="text-[10px] text-amber-500 border border-amber-900/50 px-1.5 rounded">Pending Agent</span>
                                          )}
                                        </div>

                                        <div className="flex flex-col gap-2 mb-3">
                                          <div className="flex items-center gap-1 text-xs text-[#666]">
                                            <Home className="w-3 h-3" />
                                            <span>{deal.city}, {deal.state}</span>
                                          </div>

                                          {!deal.is_orphan && deal.customer_name && (
                                            <div className="text-xs text-[#10B981] flex items-center gap-1">
                                              <CheckCircle className="w-3 h-3" />
                                              <span>{deal.customer_name}</span>
                                            </div>
                                          )}

                                          {deal.open_tasks > 0 && (
                                            <div className="flex items-center gap-1 text-[#E3C567] text-xs">
                                              <CheckSquare className="w-3 h-3" />
                                              <span>{deal.open_tasks} tasks</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Stage selector */}
                                      <Select
                                        value={deal.pipeline_stage}
                                        onValueChange={(newStage) => handleStageChange(deal.id, newStage)}
                                      >
                                        <SelectTrigger 
                                          className="h-7 text-xs bg-[#1A1A1A] border-[#1F1F1F]"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="new_deal_under_contract">New Deal</SelectItem>
                                          <SelectItem value="walkthrough_scheduled">Walkthrough</SelectItem>
                                          <SelectItem value="evaluate_deal">Evaluate</SelectItem>
                                          <SelectItem value="active_marketing">Marketing</SelectItem>
                                          <SelectItem value="cancelling_deal">Cancelling</SelectItem>
                                          <SelectItem value="clear_to_close_closed">Closed</SelectItem>
                                        </SelectContent>
                                      </Select>
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
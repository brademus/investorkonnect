import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, Calendar, TrendingUp, Megaphone, CheckCircle,
  Loader2, ArrowLeft, Plus, Home, Bath, Maximize2, DollarSign,
  Clock, CheckSquare, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

function PipelineContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [deduplicating, setDeduplicating] = useState(false);

  // 1. Load Profile and deduplicate on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = await base44.auth.me();
        if (user) {
          const res = await base44.entities.Profile.filter({ user_id: user.id });
          setProfile(res[0]);
          
          // Auto-deduplicate deals on load
          setDeduplicating(true);
          try {
            await base44.functions.invoke('deduplicateDeals');
          } catch (e) {
            console.error("Deduplication error", e);
          }
          setDeduplicating(false);
        }
      } catch (e) {
        console.error("Profile load error", e);
      }
    };
    fetchProfile();
  }, []);

  // 2. Load Active Deals (Source of Truth)
  const { data: dealsData = [], isLoading: loadingDeals, refetch: refetchDeals } = useQuery({
    queryKey: ['pipelineDeals', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      // Fetch deals where I am the investor
      const res = await base44.entities.Deal.filter(
        { investor_id: profile.id }
      );
      // Filter out archived and sort by created_date
      return res
        .filter(d => d.status !== 'archived')
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!profile?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // 3. Load Rooms (to link agents/status)
  const { data: rooms = [], isLoading: loadingRooms, refetch: refetchRooms } = useQuery({
    queryKey: ['pipelineRooms', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await base44.functions.invoke('listMyRooms');
      return res.data?.items || [];
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

  // 4. Merge Data and deduplicate by property_address
  const deals = useMemo(() => {
    // Index rooms by deal_id
    const roomMap = new Map();
    rooms.forEach(r => {
      if (r.deal_id && !r.is_orphan) {
        roomMap.set(r.deal_id, r);
      }
    });

    // Create a map to track unique addresses
    const addressMap = new Map();
    
    const processedDeals = dealsData.map(deal => {
      const room = roomMap.get(deal.id);
      const hasRoom = !!room;
      const hasAgentLocked = !!deal.agent_id;

      return {
        // IDs
        id: deal.id,
        deal_id: deal.id,
        room_id: hasRoom ? room.id : null,
        
        // Content - Prefer Deal Entity (User Uploaded Data)
        title: deal.title || 'Untitled Deal',
        property_address: deal.property_address || 'Address Pending',
        city: deal.city,
        state: deal.state,
        budget: deal.purchase_price, // The number saved in Deal entity
        
        // Status & Agent
        pipeline_stage: deal.pipeline_stage || 'new_deal_under_contract',
        customer_name: hasAgentLocked && hasRoom ? (room.counterparty_name || 'Agent Connected') : 'No Agent Selected',
        agent_id: deal.agent_id,
        
        // Dates
        created_date: deal.created_date,
        updated_date: deal.updated_date,
        contract_date: deal.key_dates?.closing_date,
        
        // Room extras
        open_tasks: room?.open_tasks || 0,
        completed_tasks: room?.completed_tasks || 0,
        
        is_orphan: !hasAgentLocked // Orphan if no agent assigned, regardless of room
      };
    });
    
    // Deduplicate by property_address - keep only the best deal per address
    processedDeals.forEach(deal => {
      const key = deal.property_address || deal.id;
      const existing = addressMap.get(key);
      
      if (!existing) {
        addressMap.set(key, deal);
      } else {
        // Keep the one with agent, or the newer one
        if (deal.agent_id && !existing.agent_id) {
          addressMap.set(key, deal);
        } else if (!deal.agent_id && existing.agent_id) {
          // Keep existing
        } else if (new Date(deal.created_date) > new Date(existing.created_date)) {
          addressMap.set(key, deal);
        }
      }
    });
    
    return Array.from(addressMap.values());
  }, [dealsData, rooms]);

  const handleDealClick = (deal) => {
    if (deal.is_orphan) {
      // Go back to wizard to finish setup/matching
      navigate(`${createPageUrl("DealWizard")}?dealId=${deal.deal_id}`);
    } else {
      // Go to deal room
      navigate(`${createPageUrl("Room")}?roomId=${deal.room_id}`);
    }
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

  if (!profile || loadingDeals || loadingRooms || deduplicating) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#E3C567] animate-spin mx-auto mb-3" />
          {deduplicating && <p className="text-sm text-[#808080]">Organizing your deals...</p>}
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
                <Link to={createPageUrl("Dashboard")} className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
                <h1 className="text-3xl font-bold text-[#E3C567]">Deal Pipeline</h1>
              </div>
              <Button 
                onClick={() => navigate(createPageUrl("DealWizard"))}
                className="bg-[#E3C567] text-black hover:bg-[#D4AF37] rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" /> New Deal
              </Button>
            </div>

            {/* Kanban Grid */}
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

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {stageDeals.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[#333] text-sm">No deals</div>
                      ) : (
                        stageDeals.map(deal => (
                          <div 
                           key={deal.id}
                           onClick={() => handleDealClick(deal)}
                           className="bg-[#141414] border border-[#1F1F1F] p-4 rounded-xl hover:border-[#E3C567] cursor-pointer group transition-all"
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

                           <div className="flex flex-col gap-2">
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
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

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
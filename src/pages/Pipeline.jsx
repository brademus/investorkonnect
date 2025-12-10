import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { useRooms } from "@/components/useRooms";
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
  
  // 1. Load Profile
  useEffect(() => {
    const fetchProfile = async () => {
        try {
            const user = await base44.auth.me();
            if (user) {
                const res = await base44.entities.Profile.filter({ user_id: user.id });
                setProfile(res[0]);
            }
        } catch (e) { console.error(e); }
    };
    fetchProfile();
  }, []);

  // 2. Load Deals (Primary)
  const { data: dealsData = [], isLoading: loadingDeals } = useQuery({
    queryKey: ['pipelineDeals', profile?.id],
    queryFn: async () => {
        if (!profile?.id) return [];
        const res = await base44.entities.Deal.filter({ investor_id: profile.id }, { created_date: -1 });
        return res.filter(d => d.status !== 'archived');
    },
    enabled: !!profile?.id
  });

  // 3. Load Rooms (For Linking)
  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ['pipelineRooms', profile?.id],
    queryFn: async () => {
        if (!profile?.id) return [];
        const res = await base44.functions.invoke('listMyRooms');
        return res.data?.items || [];
    },
    enabled: !!profile?.id
  });

  // 4. Merge Data
  const deals = React.useMemo(() => {
    // Map DealID -> Room
    // Filter out virtual orphan rooms from listMyRooms to link only to real rooms
    const roomMap = new Map();
    rooms.forEach(r => {
        if (r.deal_id && !r.is_orphan) {
            roomMap.set(r.deal_id, r);
        }
    });

    return dealsData
        .filter(d => d.status === 'active' || d.pipeline_stage === 'new_deal_under_contract')
        .map(deal => {
        const room = roomMap.get(deal.id);
        const hasRoom = !!room;

        return {
            // Core IDs
            id: deal.id, // Primary Key is Deal ID now internally, but UI might expect room ID for navigation
            deal_id: deal.id,
            room_id: hasRoom ? room.id : null,
            
            // Display Data - STRICTLY FROM DEAL ENTITY
            title: deal.title || 'Untitled Deal',
            property_address: deal.property_address || 'No Address', // This is what user wants to see
            city: deal.city,
            state: deal.state,
            budget: deal.purchase_price, // Price from contract
            
            // Context
            customer_name: hasRoom ? (room.counterparty_name || 'Agent') : 'Pending Agent',
            pipeline_stage: deal.pipeline_stage || 'new_deal_under_contract',
            
            // Dates
            created_date: deal.created_date,
            updated_date: deal.updated_date,
            contract_date: deal.key_dates?.closing_date,
            closing_date: deal.key_dates?.closing_date,
            marketing_start_date: hasRoom ? room.marketing_start_date : null,
            walkthrough_date: hasRoom ? room.walkthrough_date : null,
            evaluation_date: hasRoom ? room.evaluation_date : null,
            
            // Stats
            open_tasks: room?.open_tasks || 0,
            completed_tasks: room?.completed_tasks || 0,
            
            // UI Flags
            is_orphan: !hasRoom,
            
            // Extra fields for UI mapping (from Room if linked)
            bedrooms: room?.bedrooms,
            bathrooms: room?.bathrooms,
            square_feet: room?.square_feet
        };
    });
  }, [dealsData, rooms]);

  const handleDealClick = (deal) => {
    if (deal.is_orphan) {
        navigate(`${createPageUrl("DealWizard")}?dealId=${deal.deal_id}`);
    } else {
        navigate(`${createPageUrl("Room")}?roomId=${deal.room_id}`);
    }
  };

  const loading = !profile || loadingDeals || loadingRooms;



  const pipelineStages = [
    {
      id: 'new_deal_under_contract',
      label: 'New Deal (Under Contract)',
      icon: FileText,
      color: '#E3C567',
      bgColor: 'bg-[#E3C567]/10',
      borderColor: 'border-[#E3C567]/20'
    },
    {
      id: 'walkthrough_scheduled',
      label: 'Walkthrough Scheduled',
      icon: Calendar,
      color: '#E3C567',
      bgColor: 'bg-[#E3C567]/10',
      borderColor: 'border-[#E3C567]/20'
    },
    {
      id: 'evaluate_deal',
      label: 'Evaluate Deal (Keep or Cancel)',
      icon: TrendingUp,
      color: '#E3C567',
      bgColor: 'bg-[#E3C567]/10',
      borderColor: 'border-[#E3C567]/20'
    },
    {
      id: 'active_marketing',
      label: 'Active Marketing',
      icon: Megaphone,
      color: '#E3C567',
      bgColor: 'bg-[#E3C567]/10',
      borderColor: 'border-[#E3C567]/20'
    },
    {
      id: 'cancelling_deal',
      label: 'Cancelling Deal',
      icon: XCircle,
      color: '#E3C567',
      bgColor: 'bg-[#E3C567]/10',
      borderColor: 'border-[#E3C567]/20'
    },
    {
      id: 'clear_to_close_closed',
      label: 'Clear to Close / Closed',
      icon: CheckCircle,
      color: '#E3C567',
      bgColor: 'bg-[#E3C567]/10',
      borderColor: 'border-[#E3C567]/20'
    }
  ];

  const getDealsForStage = (stageId) => {
    return deals.filter(deal => deal.pipeline_stage === stageId);
  };

  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const getDaysInPipeline = (deal) => {
    if (!deal.created_date) return 'N/A';
    const created = new Date(deal.created_date);
    const now = new Date();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  const getKeyDate = (deal, stageId) => {
    // Return stage-specific key dates
    const dates = {
      new_deal_under_contract: deal.contract_date || deal.created_date,
      walkthrough_scheduled: deal.walkthrough_date,
      evaluate_deal: deal.evaluation_date,
      active_marketing: deal.marketing_start_date,
      cancelling_deal: deal.updated_date,
      clear_to_close_closed: deal.closing_date || deal.updated_date
    };
    
    const date = dates[stageId];
    if (!date) return null;
    
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getLastActivity = (deal) => {
    if (!deal.updated_date) return 'N/A';
    return new Date(deal.updated_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading || roomsLoading || dealsLoading) {
    return (
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header profile={profile} />
      <div className="h-screen bg-transparent overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto px-6 py-6">
            
            {/* Compact Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Link 
                  to={createPageUrl("Dashboard")} 
                  className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-[#E3C567]">Deal Pipeline</h1>
                </div>
              </div>
              <Button
                onClick={() => window.location.href = createPageUrl("DealWizard")}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold px-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Deal
              </Button>
            </div>

            {/* Pipeline Stages Grid - 3 on top, 2 on bottom */}
            <div className="space-y-4">
              {/* Top Row - 3 stages */}
              <div className="grid grid-cols-3 gap-4">
                {pipelineStages.slice(0, 3).map((stage) => {
                  const Icon = stage.icon;
                  const stageDeals = getDealsForStage(stage.id);
                  const singleDeal = stageDeals.length === 1;
                  
                  return (
                    <div 
                      key={stage.id}
                      className={`bg-[#0D0D0D] border-2 ${stage.borderColor} rounded-2xl p-5 flex flex-col transition-all hover:shadow-2xl h-[calc((100vh-220px)/2)]`}
                    >
                      {/* Stage Header */}
                      <div className="mb-4 flex-shrink-0">
                        <div className={`w-11 h-11 ${stage.bgColor} rounded-xl flex items-center justify-center mb-3`}>
                          <Icon className="w-6 h-6" style={{ color: stage.color }} />
                        </div>
                        <h3 className="text-base font-bold text-[#FAFAFA] mb-1 leading-tight">
                          {stage.label}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold" style={{ color: stage.color }}>
                            {stageDeals.length}
                          </span>
                          <span className="text-xs text-[#808080]">
                            {stageDeals.length === 1 ? 'deal' : 'deals'}
                          </span>
                        </div>
                      </div>

                      {/* Deals */}
                      <div className={`flex-1 ${singleDeal ? 'flex items-center' : 'overflow-y-auto space-y-3 pr-1'}`} style={{scrollbarWidth: 'thin', scrollbarColor: '#E3C567 #0D0D0D'}}>
                        {stageDeals.length > 0 ? (
                          singleDeal ? (
                            // Single deal - full card view
                            <div 
                              onClick={() => handleDealClick(stageDeals[0])}
                              className="w-full p-6 bg-[#141414] border-2 border-[#1F1F1F] rounded-xl hover:border-[#E3C567] transition-all cursor-pointer space-y-4"
                            >
                              <h4 className="text-xl font-bold text-[#FAFAFA] leading-tight">
                                {stageDeals[0].property_address || stageDeals[0].title || 'Untitled Property'}
                              </h4>
                              {stageDeals[0].customer_name && (
                                <p className="text-lg text-[#E3C567] font-semibold">
                                  {stageDeals[0].customer_name}
                                </p>
                              )}
                              {(stageDeals[0].city || stageDeals[0].state) && (
                                <p className="text-base text-[#999999]">
                                  {stageDeals[0].city}{stageDeals[0].city && stageDeals[0].state ? ', ' : ''}{stageDeals[0].state}
                                </p>
                              )}
                              {(stageDeals[0].bedrooms || stageDeals[0].bathrooms || stageDeals[0].square_feet) && (
                                <div className="flex items-center gap-4 text-base text-[#CCCCCC]">
                                  {stageDeals[0].bedrooms && (
                                    <span className="flex items-center gap-2">
                                      <Home className="w-5 h-5" />
                                      {stageDeals[0].bedrooms} bd
                                    </span>
                                  )}
                                  {stageDeals[0].bathrooms && (
                                    <span className="flex items-center gap-2">
                                      <Bath className="w-5 h-5" />
                                      {stageDeals[0].bathrooms} ba
                                    </span>
                                  )}
                                  {stageDeals[0].square_feet && (
                                    <span className="flex items-center gap-2">
                                      <Maximize2 className="w-5 h-5" />
                                      {stageDeals[0].square_feet.toLocaleString()} sqft
                                    </span>
                                  )}
                                </div>
                              )}
                              {stageDeals[0].budget && (
                                <div className="flex items-center gap-2 text-lg py-2 px-3 bg-[#E3C567]/10 rounded-lg border border-[#E3C567]/20">
                                  <DollarSign className="w-5 h-5 text-[#E3C567]" />
                                  <span className="text-[#E3C567] font-bold">
                                    {formatCurrency(stageDeals[0].budget)}
                                  </span>
                                </div>
                              )}
                              <div className="border-t border-[#1F1F1F] pt-3 space-y-2">
                                {getKeyDate(stageDeals[0], stage.id) && (
                                  <div className="flex items-center gap-2 text-base text-[#AAAAAA]">
                                    <Calendar className="w-5 h-5" />
                                    <span>{getKeyDate(stageDeals[0], stage.id)}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-base text-[#AAAAAA]">
                                  <Clock className="w-5 h-5" />
                                  <span>{getDaysInPipeline(stageDeals[0])}</span>
                                </div>
                                {(stageDeals[0].open_tasks > 0 || stageDeals[0].completed_tasks > 0) && (
                                  <div className="flex items-center gap-2 text-base">
                                    <CheckSquare className="w-5 h-5 text-[#E3C567]" />
                                    <span className="text-[#CCCCCC] font-medium">
                                      {stageDeals[0].completed_tasks}/{stageDeals[0].completed_tasks + stageDeals[0].open_tasks} tasks
                                    </span>
                                  </div>
                                )}
                                <div className="text-sm text-[#777777] pt-1">
                                  Updated: {getLastActivity(stageDeals[0])}
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Multiple deals - compact view
                            stageDeals.map((deal) => (
                              <div 
                                key={deal.id}
                                onClick={() => handleDealClick(deal)}
                                className="p-3 bg-[#141414] border-2 border-[#1F1F1F] rounded-xl hover:border-[#E3C567] transition-all cursor-pointer space-y-2"
                              >
                                <h4 className="text-sm font-bold text-[#FAFAFA] leading-tight">
                                  {deal.property_address || deal.title || 'Untitled Property'}
                                </h4>
                                {deal.customer_name && (
                                  <p className="text-xs text-[#E3C567] font-semibold">
                                    {deal.customer_name}
                                  </p>
                                )}
                                {deal.budget && (
                                  <div className="flex items-center gap-1.5 text-xs py-1 px-2 bg-[#E3C567]/10 rounded-lg border border-[#E3C567]/20">
                                    <DollarSign className="w-3 h-3 text-[#E3C567]" />
                                    <span className="text-[#E3C567] font-bold">
                                      {formatCurrency(deal.budget)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between text-xs text-[#777777] pt-1">
                                  <span>{getDaysInPipeline(deal)}</span>
                                  {(deal.open_tasks > 0 || deal.completed_tasks > 0) && (
                                    <span>{deal.completed_tasks}/{deal.completed_tasks + deal.open_tasks}</span>
                                  )}
                                </div>
                              </div>
                            ))
                          )
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-sm text-[#666666]">No deals</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Row - 3 stages */}
              <div className="grid grid-cols-3 gap-4">
                {pipelineStages.slice(3, 6).map((stage) => {
                  const Icon = stage.icon;
                  const stageDeals = getDealsForStage(stage.id);
                  const singleDeal = stageDeals.length === 1;
                  
                  return (
                    <div 
                      key={stage.id}
                      className={`bg-[#0D0D0D] border-2 ${stage.borderColor} rounded-2xl p-5 flex flex-col transition-all hover:shadow-2xl h-[calc((100vh-220px)/2)]`}
                    >
                      {/* Stage Header */}
                      <div className="mb-4 flex-shrink-0">
                        <div className={`w-11 h-11 ${stage.bgColor} rounded-xl flex items-center justify-center mb-3`}>
                          <Icon className="w-6 h-6" style={{ color: stage.color }} />
                        </div>
                        <h3 className="text-base font-bold text-[#FAFAFA] mb-1 leading-tight">
                          {stage.label}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold" style={{ color: stage.color }}>
                            {stageDeals.length}
                          </span>
                          <span className="text-xs text-[#808080]">
                            {stageDeals.length === 1 ? 'deal' : 'deals'}
                          </span>
                        </div>
                      </div>

                      {/* Deals */}
                      <div className={`flex-1 ${singleDeal ? 'flex items-center' : 'overflow-y-auto space-y-3 pr-1'}`} style={{scrollbarWidth: 'thin', scrollbarColor: '#E3C567 #0D0D0D'}}>
                        {stageDeals.length > 0 ? (
                          singleDeal ? (
                            // Single deal - full card view
                            <div 
                              onClick={() => handleDealClick(stageDeals[0])}
                              className="w-full p-6 bg-[#141414] border-2 border-[#1F1F1F] rounded-xl hover:border-[#E3C567] transition-all cursor-pointer space-y-4"
                            >
                              <h4 className="text-xl font-bold text-[#FAFAFA] leading-tight">
                                {stageDeals[0].property_address || stageDeals[0].title || 'Untitled Property'}
                              </h4>
                              {stageDeals[0].customer_name && (
                                <p className="text-lg text-[#E3C567] font-semibold">
                                  {stageDeals[0].customer_name}
                                </p>
                              )}
                              {(stageDeals[0].city || stageDeals[0].state) && (
                                <p className="text-base text-[#999999]">
                                  {stageDeals[0].city}{stageDeals[0].city && stageDeals[0].state ? ', ' : ''}{stageDeals[0].state}
                                </p>
                              )}
                              {(stageDeals[0].bedrooms || stageDeals[0].bathrooms || stageDeals[0].square_feet) && (
                                <div className="flex items-center gap-4 text-base text-[#CCCCCC]">
                                  {stageDeals[0].bedrooms && (
                                    <span className="flex items-center gap-2">
                                      <Home className="w-5 h-5" />
                                      {stageDeals[0].bedrooms} bd
                                    </span>
                                  )}
                                  {stageDeals[0].bathrooms && (
                                    <span className="flex items-center gap-2">
                                      <Bath className="w-5 h-5" />
                                      {stageDeals[0].bathrooms} ba
                                    </span>
                                  )}
                                  {stageDeals[0].square_feet && (
                                    <span className="flex items-center gap-2">
                                      <Maximize2 className="w-5 h-5" />
                                      {stageDeals[0].square_feet.toLocaleString()} sqft
                                    </span>
                                  )}
                                </div>
                              )}
                              {stageDeals[0].budget && (
                                <div className="flex items-center gap-2 text-lg py-2 px-3 bg-[#E3C567]/10 rounded-lg border border-[#E3C567]/20">
                                  <DollarSign className="w-5 h-5 text-[#E3C567]" />
                                  <span className="text-[#E3C567] font-bold">
                                    {formatCurrency(stageDeals[0].budget)}
                                  </span>
                                </div>
                              )}
                              <div className="border-t border-[#1F1F1F] pt-3 space-y-2">
                                {getKeyDate(stageDeals[0], stage.id) && (
                                  <div className="flex items-center gap-2 text-base text-[#AAAAAA]">
                                    <Calendar className="w-5 h-5" />
                                    <span>{getKeyDate(stageDeals[0], stage.id)}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-base text-[#AAAAAA]">
                                  <Clock className="w-5 h-5" />
                                  <span>{getDaysInPipeline(stageDeals[0])}</span>
                                </div>
                                {(stageDeals[0].open_tasks > 0 || stageDeals[0].completed_tasks > 0) && (
                                  <div className="flex items-center gap-2 text-base">
                                    <CheckSquare className="w-5 h-5 text-[#E3C567]" />
                                    <span className="text-[#CCCCCC] font-medium">
                                      {stageDeals[0].completed_tasks}/{stageDeals[0].completed_tasks + stageDeals[0].open_tasks} tasks
                                    </span>
                                  </div>
                                )}
                                <div className="text-sm text-[#777777] pt-1">
                                  Updated: {getLastActivity(stageDeals[0])}
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Multiple deals - compact view
                            stageDeals.map((deal) => (
                              <div 
                                key={deal.id}
                                onClick={() => handleDealClick(deal)}
                                className="p-3 bg-[#141414] border-2 border-[#1F1F1F] rounded-xl hover:border-[#E3C567] transition-all cursor-pointer space-y-2"
                              >
                                <h4 className="text-sm font-bold text-[#FAFAFA] leading-tight">
                                  {deal.property_address || deal.title || 'Untitled Property'}
                                </h4>
                                {deal.customer_name && (
                                  <p className="text-xs text-[#E3C567] font-semibold">
                                    {deal.customer_name}
                                  </p>
                                )}
                                {deal.budget && (
                                  <div className="flex items-center gap-1.5 text-xs py-1 px-2 bg-[#E3C567]/10 rounded-lg border border-[#E3C567]/20">
                                    <DollarSign className="w-3 h-3 text-[#E3C567]" />
                                    <span className="text-[#E3C567] font-bold">
                                      {formatCurrency(deal.budget)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between text-xs text-[#777777] pt-1">
                                  <span>{getDaysInPipeline(deal)}</span>
                                  {(deal.open_tasks > 0 || deal.completed_tasks > 0) && (
                                    <span>{deal.completed_tasks}/{deal.completed_tasks + deal.open_tasks}</span>
                                  )}
                                </div>
                              </div>
                            ))
                          )
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-sm text-[#666666]">No deals</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
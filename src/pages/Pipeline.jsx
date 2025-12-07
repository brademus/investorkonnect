import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { useRooms } from "@/components/useRooms";
import { 
  FileText, Calendar, TrendingUp, Megaphone, CheckCircle,
  Loader2, ArrowLeft, Plus, Home, Bath, Maximize2, DollarSign,
  Clock, CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";

function PipelineContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  
  // Convert rooms to deals format
  const deals = rooms.map(room => ({
    id: room.id,
    title: room.title || 'Deal Room',
    property_address: room.property_address,
    customer_name: room.customer_name,
    city: room.city,
    state: room.state,
    bedrooms: room.bedrooms,
    bathrooms: room.bathrooms,
    square_feet: room.square_feet,
    budget: room.budget || room.contract_price,
    pipeline_stage: room.pipeline_stage || 'new_contract',
    created_date: room.created_date,
    updated_date: room.updated_date,
    contract_date: room.contract_date,
    walkthrough_date: room.walkthrough_date,
    evaluation_date: room.evaluation_date,
    marketing_start_date: room.marketing_start_date,
    closing_date: room.closing_date,
    open_tasks: room.open_tasks || 0,
    completed_tasks: room.completed_tasks || 0
  }));

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = await base44.auth.me();
      if (user) {
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        setProfile(profiles[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error('[Pipeline] Error loading profile:', error);
      setLoading(false);
    }
  };

  const handleDealClick = (deal) => {
    // Navigate to Room page with the deal's room ID
    navigate(`${createPageUrl("Room")}?roomId=${deal.id}`);
  };



  const pipelineStages = [
    {
      id: 'new_contract',
      label: 'Contract Walkthrough',
      icon: FileText,
      color: '#E3C567',
      bgColor: 'bg-[#E3C567]/10',
      borderColor: 'border-[#E3C567]/20'
    },
    {
      id: 'walkthrough_scheduled',
      label: 'Walkthrough Scheduled',
      icon: Calendar,
      color: '#60A5FA',
      bgColor: 'bg-[#60A5FA]/10',
      borderColor: 'border-[#60A5FA]/20'
    },
    {
      id: 'evaluate_deal',
      label: 'Evaluate Deal',
      icon: TrendingUp,
      color: '#F59E0B',
      bgColor: 'bg-[#F59E0B]/10',
      borderColor: 'border-[#F59E0B]/20'
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: Megaphone,
      color: '#DB2777',
      bgColor: 'bg-[#DB2777]/10',
      borderColor: 'border-[#DB2777]/20'
    },
    {
      id: 'closing',
      label: 'Ready to Close',
      icon: CheckCircle,
      color: '#34D399',
      bgColor: 'bg-[#34D399]/10',
      borderColor: 'border-[#34D399]/20'
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
      new_contract: deal.contract_date || deal.created_date,
      walkthrough_scheduled: deal.walkthrough_date,
      evaluate_deal: deal.evaluation_date,
      marketing: deal.marketing_start_date,
      closing: deal.closing_date
    };
    
    const date = dates[stageId];
    if (!date) return null;
    
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getLastActivity = (deal) => {
    if (!deal.updated_date) return 'N/A';
    return new Date(deal.updated_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading || roomsLoading) {
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
      <div className="h-screen bg-black overflow-hidden flex flex-col">
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
                                <div className="flex items-center gap-2 text-lg py-2 px-3 bg-[#34D399]/10 rounded-lg border border-[#34D399]/20">
                                  <DollarSign className="w-5 h-5 text-[#34D399]" />
                                  <span className="text-[#34D399] font-bold">
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
                                  <div className="flex items-center gap-1.5 text-xs py-1 px-2 bg-[#34D399]/10 rounded-lg">
                                    <DollarSign className="w-3 h-3 text-[#34D399]" />
                                    <span className="text-[#34D399] font-bold">
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

              {/* Bottom Row - 2 stages */}
              <div className="grid grid-cols-2 gap-4">
                {pipelineStages.slice(3, 5).map((stage) => {
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
                                <div className="flex items-center gap-2 text-lg py-2 px-3 bg-[#34D399]/10 rounded-lg border border-[#34D399]/20">
                                  <DollarSign className="w-5 h-5 text-[#34D399]" />
                                  <span className="text-[#34D399] font-bold">
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
                                  <div className="flex items-center gap-1.5 text-xs py-1 px-2 bg-[#34D399]/10 rounded-lg">
                                    <DollarSign className="w-3 h-3 text-[#34D399]" />
                                    <span className="text-[#34D399] font-bold">
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

            {/* Empty State */}
            {deals.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="text-center py-16 bg-[#0D0D0D] border-2 border-[#1F1F1F] rounded-2xl px-12">
                  <FileText className="w-20 h-20 text-[#333333] mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-[#FAFAFA] mb-3">No deals yet</h3>
                  <p className="text-[#808080] mb-8 text-base">
                    Submit your first deal to start tracking your pipeline
                  </p>
                  <Button
                    onClick={() => window.location.href = createPageUrl("DealWizard")}
                    className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold px-8 py-6 text-base"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Submit Your First Deal
                  </Button>
                </div>
              </div>
            )}
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
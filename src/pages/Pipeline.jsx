import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { 
  FileText, Calendar, TrendingUp, Megaphone, CheckCircle,
  Loader2, ArrowLeft, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";

function PipelineContent() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    loadProfile();
    loadDeals();
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

  const loadDeals = async () => {
    try {
      const apiDeals = await base44.entities.Deal.list('-created_date', 100);
      const storedDeals = JSON.parse(sessionStorage.getItem('user_deals') || '[]');
      const apiIds = new Set(apiDeals.map(d => d.id));
      const uniqueStored = storedDeals.filter(d => !apiIds.has(d.id));
      const allDeals = [...apiDeals, ...uniqueStored];
      setDeals(allDeals);
    } catch (err) {
      const storedDeals = JSON.parse(sessionStorage.getItem('user_deals') || '[]');
      setDeals(storedDeals);
    }
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

  if (loading) {
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
      <div className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="space-y-8">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <Link 
                  to={createPageUrl("Dashboard")} 
                  className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Link>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#E3C567]">
                  Deal Pipeline
                </h1>
                <p className="mt-2 text-base text-[#808080]">
                  Track your deals through every stage from contract to close
                </p>
              </div>
              <Button
                onClick={() => window.location.href = createPageUrl("DealWizard")}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Deal
              </Button>
            </div>

            {/* Pipeline Stages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {pipelineStages.map((stage) => {
                const Icon = stage.icon;
                const stageDeals = getDealsForStage(stage.id);
                
                return (
                  <div 
                    key={stage.id}
                    className={`bg-[#0D0D0D] border ${stage.borderColor} rounded-2xl p-6 min-h-[300px] flex flex-col transition-all hover:shadow-xl`}
                  >
                    {/* Stage Header */}
                    <div className="mb-6">
                      <div className={`w-12 h-12 ${stage.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                        <Icon className="w-6 h-6" style={{ color: stage.color }} />
                      </div>
                      <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">
                        {stage.label}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold" style={{ color: stage.color }}>
                          {stageDeals.length}
                        </span>
                        <span className="text-sm text-[#808080]">
                          {stageDeals.length === 1 ? 'deal' : 'deals'}
                        </span>
                      </div>
                    </div>

                    {/* Deals in this stage */}
                    <div className="space-y-2 flex-grow">
                      {stageDeals.length > 0 ? (
                        stageDeals.slice(0, 3).map((deal) => (
                          <div 
                            key={deal.id}
                            className="p-3 bg-[#141414] border border-[#1F1F1F] rounded-lg hover:border-[#E3C567] transition-all cursor-pointer"
                          >
                            <p className="text-sm font-medium text-[#FAFAFA] truncate">
                              {deal.title || deal.property_address || 'Untitled Deal'}
                            </p>
                            <p className="text-xs text-[#808080] truncate">
                              {deal.property_type || 'Property'}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm text-[#666666]">No deals in this stage</p>
                        </div>
                      )}
                      {stageDeals.length > 3 && (
                        <p className="text-xs text-center text-[#808080] pt-2">
                          +{stageDeals.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {deals.length === 0 && (
              <div className="text-center py-16 bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl">
                <FileText className="w-16 h-16 text-[#333333] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">No deals yet</h3>
                <p className="text-[#808080] mb-6">
                  Submit your first deal to start tracking your pipeline
                </p>
                <Button
                  onClick={() => window.location.href = createPageUrl("DealWizard")}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Submit Your First Deal
                </Button>
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
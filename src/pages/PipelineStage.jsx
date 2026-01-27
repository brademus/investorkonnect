import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Calendar, DollarSign, CheckCircle, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { PIPELINE_STAGES, normalizeStage, getStageLabel } from "@/components/pipelineStages";
import { getOrCreateDealRoom } from "@/components/dealRooms";
import { setCachedDeal } from "@/components/utils/dealCache";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";

export default function PipelineStage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { profile, loading } = useCurrentProfile();

  const stageId = searchParams.get("stage") || "new_deals";
  const isAgent = profile?.user_role === 'agent';

  // Load deals for this stage
  const { data: dealsData = [], isLoading: loadingDeals } = useQuery({
    queryKey: ['pipelineDeals', profile?.id, profile?.user_role],
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      if (!profile?.id) return [];
      const response = await base44.functions.invoke('getPipelineDealsForUser');
      return (response.data?.deals || [])
        .filter(d => d.status !== 'archived')
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!profile?.id,
    refetchOnWindowFocus: false,
  });

  // Load rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', profile?.id],
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await base44.functions.invoke('listMyRoomsEnriched');
      return res.data?.rooms || [];
    },
    enabled: !!profile?.id,
    refetchOnWindowFocus: false,
  });

  // Filter deals by stage
  const stageDealIds = useMemo(() => {
    return dealsData
      .filter(d => {
        const dealStage = d.pipeline_stage === 'canceled' ? 'completed' : d.pipeline_stage;
        const matchesStage = dealStage === stageId;
        
        // Agents only see deals with room requests
        if (isAgent) {
          const room = rooms.find(r => r.deal_id === d.id);
          return matchesStage && (room?.request_status === 'requested' || room?.request_status === 'accepted' || room?.request_status === 'signed');
        }
        return matchesStage;
      })
      .map(d => d.id);
  }, [dealsData, rooms, stageId, isAgent]);

  const deals = useMemo(() => {
    return dealsData.filter(d => stageDealIds.includes(d.id));
  }, [dealsData, stageDealIds]);

  const handleDealClick = async (deal) => {
    if (deal?.id) {
      base44.functions.invoke('getDealDetailsForUser', { dealId: deal.id })
        .then((res) => { if (res?.data) setCachedDeal(deal.id, res.data); })
        .catch(() => {});
      base44.functions.invoke('getLegalAgreement', { deal_id: deal.id }).catch(() => {});
    }

    const existingRoom = rooms.find(r => r.deal_id === deal.id && !r.is_orphan);
    if (existingRoom?.id) {
      if (isAgent) {
        const masked = {
          id: deal.id,
          title: `${deal.city || 'City'}, ${deal.state || 'State'}`,
          property_address: null,
          city: deal.city,
          state: deal.state,
          purchase_price: deal.purchase_price,
          pipeline_stage: deal.pipeline_stage,
        };
        setCachedDeal(deal.id, masked);
      }
      navigate(`${createPageUrl("Room")}?roomId=${existingRoom.id}&tab=agreement`);
      return;
    }

    const agentProfileId = isAgent ? (deal.agent_id || profile.id) : deal.agent_id;
    if (!agentProfileId) {
      toast.info('Select an agent for this deal to open a room.');
      return;
    }

    try {
      const roomId = await getOrCreateDealRoom({
        dealId: deal.id,
        agentProfileId
      });
      if (isAgent) {
        const masked = {
          id: deal.id,
          title: `${deal.city || 'City'}, ${deal.state || 'State'}`,
          property_address: null,
          city: deal.city,
          state: deal.state,
          purchase_price: deal.purchase_price,
          pipeline_stage: deal.pipeline_stage,
        };
        setCachedDeal(deal.id, masked);
      }
      navigate(`${createPageUrl("Room")}?roomId=${roomId}&tab=agreement`);
    } catch (error) {
      console.error("Failed to create/find room:", error);
      toast.error("Failed to open conversation");
    }
  };

  const stageLabel = getStageLabel(stageId);

  if (loading || loadingDeals) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-[#808080]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("Pipeline"))}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Pipeline
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#E3C567] mb-2">{stageLabel}</h1>
              <p className="text-sm text-[#808080]">{deals.length} deal{deals.length !== 1 ? 's' : ''}</p>
            </div>
            {profile?.user_role === 'investor' && (
              <Button 
                onClick={() => {
                  try { sessionStorage.removeItem('newDealDraft'); } catch (_) {}
                  navigate(createPageUrl("NewDeal"));
                }}
                className="bg-[#E3C567] text-black hover:bg-[#D4AF37] rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" /> New Deal
              </Button>
            )}
          </div>
        </div>

        {/* Deals Grid */}
        {deals.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#808080]">No deals in this stage yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {deals.map((deal) => {
              const room = rooms.find(r => r.deal_id === deal.id);
              const badge = getAgreementStatusLabel({
                room: room,
                agreement: room?.agreement,
                negotiation: room?.negotiation,
                role: isAgent ? 'agent' : 'investor'
              });

              return (
                <div
                  key={deal.id}
                  onClick={() => handleDealClick(deal)}
                  className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#E3C567] hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-[#FAFAFA] mb-2 group-hover:text-[#E3C567] transition-colors line-clamp-2">
                      {isAgent && !room?.is_fully_signed
                        ? `${deal.city}, ${deal.state}`
                        : (deal.property_address || deal.title)}
                    </h3>
                    {badge && (
                      <div>
                        <span className={`text-[10px] border px-2 py-0.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-[#808080]">
                      <Home className="w-4 h-4" />
                      <span>{deal.city}, {deal.state}</span>
                    </div>

                    {deal.purchase_price && (
                      <div className="flex items-center gap-2 text-sm text-[#E3C567]">
                        <DollarSign className="w-4 h-4" />
                        <span>${Number(deal.purchase_price).toLocaleString()}</span>
                      </div>
                    )}

                    {deal.key_dates?.closing_date && (
                      <div className="flex items-center gap-2 text-sm text-[#60A5FA]">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(deal.key_dates.closing_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {(room?.request_status === 'accepted' || room?.request_status === 'signed') && (
                      <div className="flex items-center gap-2 text-sm text-[#10B981]">
                        <CheckCircle className="w-4 h-4" />
                        <span>{room?.counterparty_name || 'Agent Connected'}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#1F1F1F]">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDealClick(deal);
                      }}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-sm"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" /> Open Deal
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import LoadingAnimation from "@/components/LoadingAnimation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, MapPin, DollarSign, Calendar, Handshake, User } from "lucide-react";
import { toast } from "sonner";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";

export default function DealRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useCurrentProfile();
  const roomId = searchParams.get("roomId");

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [room, setRoom] = useState(null);
  const [deal, setDeal] = useState(null);
  const [investorProfile, setInvestorProfile] = useState(null);
  const [statusBadge, setStatusBadge] = useState(null);

  useEffect(() => {
    if (!roomId || !profile?.id) {
      navigate(createPageUrl("Pipeline"));
      return;
    }

    loadRequestData();
  }, [roomId, profile?.id]);

  const loadRequestData = async () => {
    try {
      setLoading(true);

      // Load room
      const rooms = await base44.entities.Room.filter({ id: roomId });
      if (!rooms || rooms.length === 0) {
        toast.error("Request not found");
        navigate(createPageUrl("Pipeline"));
        return;
      }

      const loadedRoom = rooms[0];
      
      // Verify agent owns this room
      if (loadedRoom.agentId !== profile.id) {
        toast.error("Access denied");
        navigate(createPageUrl("Pipeline"));
        return;
      }

      setRoom(loadedRoom);

      // Fetch enriched room to derive negotiation/counter status for accurate label
      try {
        const res = await base44.functions.invoke('listMyRoomsEnriched');
        const enriched = (res.data?.rooms || []).find(r => r.id === loadedRoom.id || r.deal_id === loadedRoom.deal_id) || loadedRoom;
        const badge = getAgreementStatusLabel({ room: enriched, negotiation: enriched?.negotiation, role: 'agent' });
        setStatusBadge(badge || null);
      } catch (_) { /* non-blocking */ }

      // Load deal (limited info)
      if (loadedRoom.deal_id) {
        const deals = await base44.entities.Deal.filter({ id: loadedRoom.deal_id });
        if (deals && deals.length > 0) {
          setDeal(deals[0]);
        }
      }

      // Load investor profile
      const investorProfiles = await base44.entities.Profile.filter({ id: loadedRoom.investorId });
      if (investorProfiles && investorProfiles.length > 0) {
        setInvestorProfile(investorProfiles[0]);
      }

    } catch (error) {
      console.error("Failed to load request:", error);
      toast.error("Failed to load request");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (processing) return;

    setProcessing(true);
    try {
      const response = await base44.functions.invoke('respondToDealRequest', {
        room_id: room.id,
        action: 'accept'
      });

      if (response.data?.success) {
        toast.success("Deal accepted! Chat is now enabled.");
        navigate(createPageUrl("Room") + `?roomId=${room.id}`);
      } else {
        throw new Error(response.data?.error || 'Failed to accept');
      }
    } catch (error) {
      console.error("Failed to accept deal:", error);
      toast.error("Failed to accept deal");
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (processing) return;

    setProcessing(true);
    try {
      const response = await base44.functions.invoke('respondToDealRequest', {
        room_id: room.id,
        action: 'reject'
      });

      if (response.data?.success) {
        toast.success("Deal request declined");
        navigate(createPageUrl("Pipeline"));
      } else {
        throw new Error(response.data?.error || 'Failed to reject');
      }
    } catch (error) {
      console.error("Failed to reject deal:", error);
      toast.error("Failed to reject deal");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  const proposedTerms = room?.proposed_terms || {};

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("Pipeline"))}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Pipeline
          </button>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">New Deal Request</h1>
          <p className="text-sm text-[#808080]">Review and respond to this opportunity</p>
          {statusBadge && (
            <div className="mt-3">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Investor Info */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#60A5FA]/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-[#60A5FA]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#FAFAFA]">Investor</h2>
                <p className="text-sm text-[#808080]">{investorProfile?.full_name || "Investor"}</p>
              </div>
            </div>
            {investorProfile?.investor?.company_name && (
              <p className="text-sm text-[#808080]">Company: {investorProfile.investor.company_name}</p>
            )}
          </div>

          {/* Deal Location & Financials */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#E3C567]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#FAFAFA]">Deal Information</h2>
                <p className="text-xs text-[#808080]">Location and financials</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                <span className="text-sm text-[#808080]">Location</span>
                <span className="text-sm font-medium text-[#FAFAFA]">
                  {deal?.city}, {deal?.state} {deal?.zip}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                <span className="text-sm text-[#808080]">Purchase Price</span>
                <span className="text-sm font-medium text-[#FAFAFA]">
                  ${deal?.purchase_price?.toLocaleString() || 'N/A'}
                </span>
              </div>

              {deal?.key_dates?.closing_date && (
                <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                  <span className="text-sm text-[#808080]">Target Closing</span>
                  <span className="text-sm font-medium text-[#FAFAFA]">
                    {new Date(deal.key_dates.closing_date).toLocaleDateString()}
                  </span>
                </div>
              )}

              {deal?.property_type && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-[#808080]">Property Type</span>
                  <span className="text-sm font-medium text-[#FAFAFA] capitalize">
                    {deal.property_type.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Proposed Terms */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#34D399]/20 rounded-full flex items-center justify-center">
                <Handshake className="w-5 h-5 text-[#34D399]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#FAFAFA]">Proposed Terms</h2>
                <p className="text-xs text-[#808080]">Investor's offer</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                <span className="text-sm text-[#808080]">Commission Structure</span>
                <span className="text-sm font-medium text-[#FAFAFA] capitalize">
                  {proposedTerms.commission_type === 'percentage' ? 'Percentage Commission' : 'Flat Fee'}
                </span>
              </div>

              {proposedTerms.commission_type === 'percentage' && proposedTerms.commission_percentage && (
                <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                  <span className="text-sm text-[#808080]">Commission Rate</span>
                  <span className="text-sm font-medium text-[#FAFAFA]">
                    {proposedTerms.commission_percentage}%
                  </span>
                </div>
              )}

              {proposedTerms.commission_type === 'flat' && proposedTerms.flat_fee && (
                <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                  <span className="text-sm text-[#808080]">Flat Fee</span>
                  <span className="text-sm font-medium text-[#FAFAFA]">
                    ${Number(proposedTerms.flat_fee).toLocaleString()}
                  </span>
                </div>
              )}

              {proposedTerms.agreement_length && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-[#808080]">Agreement Length</span>
                  <span className="text-sm font-medium text-[#FAFAFA]">
                    {proposedTerms.agreement_length} days
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleReject}
              disabled={processing}
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-full py-6"
            >
              <XCircle className="w-5 h-5 mr-2" />
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              disabled={processing}
              className="flex-1 bg-[#34D399] hover:bg-[#10B981] text-black rounded-full py-6 font-bold"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {processing ? "Processing..." : "Accept Deal"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NDAModal from "@/components/NDAModal";
import VerifyFirstModal from "@/components/VerifyFirstModal";
import { useQuery } from "@tanstack/react-query";
import { 
  Shield, Users, Lock, FileText, 
  Plus, MessageCircle, Loader2, AlertCircle, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

/**
 * DEAL ROOMS - Gated behind NEW onboarding
 */
export default function DealRooms() {
  const navigate = useNavigate();
  const { loading: profileLoading, role, onboarded } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [kycVerified, setKycVerified] = useState(false);
  const [user, setUser] = useState(null);

  // GATE: Redirect to onboarding if investor not onboarded
  useEffect(() => {
    if (profileLoading) return;

    if (role === 'investor' && !onboarded) {
      console.log('[DealRooms] 🚫 Investor not onboarded, redirecting');
      toast.error('Please complete your investor profile first');
      navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      return;
    }
  }, [profileLoading, role, onboarded, navigate]);

  useEffect(() => {
    if (!profileLoading && onboarded) {
      checkAuthAndAccess();
    }
  }, [profileLoading, onboarded]);

  const checkAuthAndAccess = async () => {
    try {
      // Check if authenticated
      const isAuth = await base44.auth.isAuthenticated();
      
      if (!isAuth) {
        toast.info("Please sign in to access deal rooms");
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }

      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Get profile
      const profiles = await base44.entities.Profile.filter({ user_id: currentUser.id });
      if (profiles.length === 0) {
        setLoading(false);
        toast.error("User profile not found. Please contact support.");
        return;
      }

      const profile = profiles[0];

      // Check KYC first
      if (!profile.kyc_verified) {
        setShowVerifyModal(true);
        setLoading(false);
        return;
      }

      setKycVerified(true);

      // Then check NDA
      if (!profile.nda_accepted) {
        setShowNDAModal(true);
        setLoading(false);
        return;
      }

      setNdaAccepted(true);
      setLoading(false);
    } catch (error) {
      console.error('Auth/Access check error:', error);
      setLoading(false);
      toast.error("Failed to verify access. Please try again.");
    }
  };

  const handleNDAAccepted = () => {
    setShowNDAModal(false);
    setNdaAccepted(true);
    toast.success("You can now access deal rooms!");
  };

  // Only load deals if KYC + NDA accepted
  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ['deals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (profiles.length === 0) return [];
      
      const profile = profiles[0];
      return await base44.entities.Deal.filter({
        participants: { $in: [profile.id] }
      }, '-updated_date');
    },
    enabled: !!user && kycVerified && ndaAccepted && onboarded,
    initialData: []
  });

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  // If not onboarded, don't show anything (redirect happens in useEffect)
  if (!onboarded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {showVerifyModal && <VerifyFirstModal open={showVerifyModal} />}
      {showNDAModal && <NDAModal open={showNDAModal} onAccepted={handleNDAAccepted} />}

      {(kycVerified && ndaAccepted) && (
        <div className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">Deal Rooms</h1>
                  <p className="text-slate-600">Secure collaboration spaces for your deals</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-5 h-5 mr-2" />
                  New Deal Room
                </Button>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    <strong>Protected:</strong> All deal rooms are verified and NDA-protected. 
                    Information shared here is confidential.
                  </p>
                </div>
              </div>
            </div>

            {/* Deals Grid */}
            {dealsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
            ) : deals.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No Deal Rooms Yet</h3>
                <p className="text-slate-600 mb-6">
                  Create your first deal room to start collaborating with agents
                </p>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Deal Room
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {deals.map((deal) => (
                  <div 
                    key={deal.id}
                    className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(createPageUrl("DealRooms") + `/${deal.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-bold text-slate-900 text-lg">{deal.title}</h3>
                      <Badge className={
                        deal.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                        deal.status === 'closed' ? 'bg-slate-100 text-slate-800' :
                        'bg-blue-100 text-blue-800'
                      }>
                        {deal.status}
                      </Badge>
                    </div>
                    {deal.description && (
                      <p className="text-slate-600 text-sm mb-4 line-clamp-2">{deal.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {deal.participants?.length || 0} participants
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        {deal.audit_log?.length || 0} activities
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Features */}
            <div className="mt-12 grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <Lock className="w-10 h-10 text-blue-600 mb-4" />
                <h3 className="font-bold text-slate-900 mb-2">NDA Protected</h3>
                <p className="text-slate-600 text-sm">
                  All deal information is protected by legally binding NDAs
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <FileText className="w-10 h-10 text-emerald-600 mb-4" />
                <h3 className="font-bold text-slate-900 mb-2">Audit Trail</h3>
                <p className="text-slate-600 text-sm">
                  Every action is logged for security and compliance
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <Shield className="w-10 h-10 text-purple-600 mb-4" />
                <h3 className="font-bold text-slate-900 mb-2">Verified Users Only</h3>
                <p className="text-slate-600 text-sm">
                  All participants are identity-verified and NDA-signed
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
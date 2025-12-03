import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";
import { embedProfile } from "@/components/functions";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { User, Edit, Layers, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

/**
 * MY PROFILE PAGE - Wrapper for profile management
 * 
 * Lets users:
 * - Edit basic profile (AccountProfile)
 * - Open full onboarding
 * - Refresh AI matching embedding
 */
export default function MyProfile() {
  const navigate = useNavigate();
  const { profile, user, role, loading } = useCurrentProfile();
  const [refreshing, setRefreshing] = useState(false);

  const refreshEmbedding = async () => {
    setRefreshing(true);
    try {
      console.log('[MyProfile] Refreshing embedding...');
      await embedProfile();
      toast.success('Profile embedding refreshed for AI matching!');
    } catch (error) {
      console.error('[MyProfile] Error refreshing embedding:', error);
      toast.error('Could not refresh embedding. It will update automatically after profile changes.');
    } finally {
      setRefreshing(false);
    }
  };

  const toAccountEdit = () => navigate(createPageUrl("AccountProfile"));
  
  const toFullOnboarding = () => {
    if (role === "agent") {
      navigate(createPageUrl("AgentDeepOnboarding"));
    } else if (role === "investor") {
      navigate(createPageUrl("InvestorDeepOnboarding"));
    } else {
      toast.info("Please complete role selection first");
      navigate(createPageUrl("RoleSelection"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D3A029] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Profile</h1>
          <p className="text-slate-600">
            Edit your basics or open the full onboarding to adjust matching inputs
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#FEF3C7] rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-[#D3A029]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {profile?.full_name || user?.full_name || 'Your Profile'}
              </h2>
              <p className="text-sm text-slate-600 capitalize">
                {role || 'Member'}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-4">What would you like to do?</h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <Button 
                onClick={toAccountEdit}
                variant="outline"
                className="h-auto py-6 flex-col items-start gap-2 border-2 hover:border-[#D3A029] hover:bg-[#FEF3C7] transition-all"
              >
                <Edit className="w-5 h-5 text-[#D3A029]" />
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Edit Basic Profile</div>
                  <div className="text-xs text-slate-600">Name, email, contact info</div>
                </div>
              </Button>

              <Button 
                onClick={toFullOnboarding}
                variant="outline"
                className="h-auto py-6 flex-col items-start gap-2 border-2 hover:border-[#D3A029] hover:bg-[#FEF3C7] transition-all"
              >
                <Layers className="w-5 h-5 text-[#D3A029]" />
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Open Full Onboarding</div>
                  <div className="text-xs text-slate-600">Update all matching criteria</div>
                </div>
              </Button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-3">AI Matching</h3>
            <p className="text-sm text-slate-600 mb-4">
              Refresh your profile embedding to update AI-powered match suggestions
            </p>
            <Button 
              onClick={refreshEmbedding}
              disabled={refreshing}
              variant="ghost"
              className="gap-2"
            >
              {refreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Refresh Matching
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
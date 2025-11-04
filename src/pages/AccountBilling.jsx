
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Shield, AlertCircle, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AccountBilling() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  useEffect(() => {
    document.title = "Account & Billing - AgentVault";
    loadUserAndProfile();
    
    // Check URL param for subscription success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true' || urlParams.get('sub') === 'active') {
      setSubscriptionActive(true);
    }
  }, []);

  const loadUserAndProfile = async () => {
    try {
      // Check authentication
      const isAuth = await base44.auth.isAuthenticated();
      
      if (!isAuth) {
        toast.info("Please sign in to access your account");
        navigate(createPageUrl("Onboarding") + "?next=" + encodeURIComponent(window.location.pathname));
        return;
      }

      // Get current user
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Get profile
      const profiles = await base44.entities.Profile.filter({ 
        email: currentUser.email 
      });

      if (profiles.length === 0 || !profiles[0].onboarded) {
        toast.info("Please complete your profile");
        navigate(createPageUrl("Onboarding") + "?next=" + encodeURIComponent(window.location.pathname));
        return;
      }

      setProfile(profiles[0]);
      setLoading(false);

    } catch (error) {
      console.error("Profile load error:", error);
      toast.error("Please sign in to continue");
      navigate(createPageUrl("Onboarding"));
    }
  };

  const STRIPE_PORTAL_URL = "https://billing.stripe.com/p/login/test_bJebITcLO8efdoA0va6EU00";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Account & Billing</h1>

        {/* Subscription Status */}
        {profile.role === "investor" && (
          <div className="bg-white rounded-xl p-8 border border-slate-200 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Subscription</h2>
                <p className="text-slate-600">Manage your subscription and billing information</p>
              </div>
              <Badge className={
                subscriptionActive || profile.subscription_status === "active" 
                  ? "bg-emerald-100 text-emerald-800" 
                  : "bg-slate-100 text-slate-800"
              }>
                {subscriptionActive || profile.subscription_status === "active" ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </>
                ) : (
                  "No subscription"
                )}
              </Badge>
            </div>

            {subscriptionActive || (profile.subscription_tier && profile.subscription_tier !== "none") ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-4 border-t border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-900 capitalize">
                      {profile.subscription_tier || "Starter"} Plan
                    </div>
                    <div className="text-sm text-slate-600">
                      Status: <span className="capitalize text-emerald-600">
                        {subscriptionActive ? "Active" : profile.subscription_status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">
                      ${profile.subscription_tier === "starter" ? "19" :
                        profile.subscription_tier === "pro" ? "49" : "99"}/mo
                    </div>
                  </div>
                </div>

                {subscriptionActive && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-sm text-emerald-800">
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      <strong>Subscription activated!</strong> Your payment was processed successfully.
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <a 
                    href={STRIPE_PORTAL_URL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Billing
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </a>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => navigate(createPageUrl("Pricing"))}
                  >
                    View Plans
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Active Subscription</h3>
                <p className="text-slate-600 mb-6">Subscribe to access verified agents and deal rooms</p>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate(createPageUrl("Pricing"))}>
                  View Plans
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Account Info */}
        <div className="bg-white rounded-xl p-8 border border-slate-200 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Account Information</h2>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-slate-100">
              <span className="text-slate-600">Name</span>
              <span className="font-medium text-slate-900">{profile.full_name || "Not set"}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-slate-100">
              <span className="text-slate-600">Email</span>
              <span className="font-medium text-slate-900">{user.email}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-slate-100">
              <span className="text-slate-600">Account Type</span>
              <span className="font-medium text-slate-900 capitalize">{profile.user_type || "Member"}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-slate-100">
              <span className="text-slate-600">Market</span>
              <span className="font-medium text-slate-900">{profile.market || "Not set"}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-600">Status</span>
              <Badge className="bg-emerald-100 text-emerald-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Onboarded
              </Badge>
            </div>
          </div>
        </div>

        {/* Verifications */}
        <div className="bg-white rounded-xl p-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Verifications</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">Email Verified</span>
              {profile.verification_email ? (
                <Badge className="bg-emerald-100 text-emerald-800">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary">Not Verified</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700">NDA Signed</span>
              {profile.verification_nda ? (
                <Badge className="bg-emerald-100 text-emerald-800">
                  <Shield className="w-3 h-3 mr-1" />
                  Signed
                </Badge>
              ) : (
                <Badge variant="secondary">Not Signed</Badge>
              )}
            </div>
            {profile.role === "agent" && (
              <div className="flex items-center justify-between">
                <span className="text-slate-700">License Verified</span>
                {profile.verification_license ? (
                  <Badge className="bg-emerald-100 text-emerald-800">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

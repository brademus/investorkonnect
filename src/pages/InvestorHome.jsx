
import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Shield, FileText, Users, CheckCircle,
  AlertCircle, Building, Target, DollarSign, ArrowRight, Star
} from "lucide-react";

export default function InvestorHome() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  const hasActiveSubscription = profile?.subscription_tier && profile?.subscription_tier !== 'none';
  const hasNDA = profile?.nda_accepted;
  const isVerified = profile?.verified;
  const buyBox = profile?.investor?.buy_box || {};
  const docs = profile?.investor?.documents || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-10 h-10" />
            <h1 className="text-4xl font-bold">Your Investor Dashboard</h1>
          </div>
          <p className="text-blue-100 text-lg">
            Welcome back, {profile?.full_name || 'Investor'}! Manage your deal flow and connect with verified agents.
          </p>
          
          {/* Metric Pills */}
          <div className="flex gap-4 mt-6 flex-wrap">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
              <Star className="w-4 h-4" />
              <span className="text-sm">
                Plan: <strong>{profile?.subscription_tier || 'None'}</strong>
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm">
                Verified: {isVerified ? (
                  <strong className="text-emerald-200">Yes ✅</strong>
                ) : (
                  <strong className="text-orange-200">Required</strong>
                )}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm">
                NDA: {hasNDA ? (
                  <strong className="text-emerald-200">Signed ✅</strong>
                ) : (
                  <strong className="text-orange-200">Required</strong>
                )}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">
                Last updated: <strong>{new Date(profile?.updated_date || Date.now()).toLocaleDateString()}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Verification Banner */}
        {!isVerified && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-red-900 mb-2">Identity Verification Required</h3>
                <p className="text-red-800 mb-4">
                  Please verify your identity to access agent profiles and deal rooms. This is required before you can sign the NDA.
                </p>
                <Link to={createPageUrl("Verify")}>
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Shield className="w-4 h-4 mr-2" />
                    Verify Identity
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* NDA Banner */}
        {isVerified && !hasNDA && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">NDA Signature Required</h3>
                <p className="text-orange-800 mb-4">
                  Sign our NDA to access verified agent profiles and secure deal rooms. This protects all confidential information shared on the platform.
                </p>
                <Link to={createPageUrl("Agents")}>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    <Shield className="w-4 h-4 mr-2" />
                    Sign NDA Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Banner */}
        {!hasActiveSubscription && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <Star className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2">Upgrade to Unlock Full Access</h3>
                <p className="text-blue-800 mb-4">
                  Subscribe to browse agents, view verified reviews, create deal rooms, and more.
                </p>
                <Link to={createPageUrl("Pricing")}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    View Plans
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Buy Box Summary */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Buy Box</h2>
              </div>
              <Link to={createPageUrl("InvestorBuyBox")}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            </div>
            
            {buyBox.asset_types || buyBox.markets || buyBox.min_budget ? (
              <div className="space-y-4">
                {buyBox.asset_types && buyBox.asset_types.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Asset Types</p>
                    <div className="flex flex-wrap gap-2">
                      {buyBox.asset_types.map((type, idx) => (
                        <Badge key={idx} variant="secondary">{type}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {buyBox.markets && buyBox.markets.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Target Markets</p>
                    <div className="flex flex-wrap gap-2">
                      {buyBox.markets.map((market, idx) => (
                        <Badge key={idx} variant="secondary">{market}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {(buyBox.min_budget || buyBox.max_budget) && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Budget Range</p>
                    <p className="font-semibold text-slate-900">
                      ${buyBox.min_budget?.toLocaleString() || '0'} - ${buyBox.max_budget?.toLocaleString() || '∞'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">No buy box configured yet</p>
                <Link to={createPageUrl("InvestorBuyBox")}>
                  <Button size="sm">Set Up Buy Box</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Suggested Agents */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-900">Suggested Agents</h2>
              </div>
              <Link to={createPageUrl("Agents")}>
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
            
            <div className="space-y-3">
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">Complete your buy box to see agent matches</p>
                <Link to={createPageUrl("InvestorBuyBox")}>
                  <Button size="sm" variant="outline">Set Up Buy Box</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-bold text-slate-900">Documents</h2>
              </div>
              <Link to={createPageUrl("InvestorDocuments")}>
                <Button variant="outline" size="sm">Manage</Button>
              </Link>
            </div>
            
            {docs.length > 0 ? (
              <div className="space-y-2">
                {docs.slice(0, 3).map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{doc.type}</p>
                    </div>
                  </div>
                ))}
                {docs.length > 3 && (
                  <p className="text-xs text-slate-500 text-center pt-2">
                    +{docs.length - 3} more documents
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">No documents uploaded yet</p>
                <Link to={createPageUrl("InvestorDocuments")}>
                  <Button size="sm">Upload Documents</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Links</h2>
            <div className="space-y-2">
              <Link to={createPageUrl("Pricing")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Star className="w-4 h-4 text-blue-600" />
                  Subscription & Plans
                </Button>
              </Link>
              <Link to={createPageUrl("Profile")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Building className="w-4 h-4 text-slate-600" />
                  My Profile
                </Button>
              </Link>
              <Link to={createPageUrl("DealRooms")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Deal Rooms
                </Button>
              </Link>
              <Link to={createPageUrl("AccountBilling")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Billing & Payment
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

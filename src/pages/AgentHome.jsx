
import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Shield, FileText, TrendingUp, CheckCircle,
  AlertCircle, Building, Award, MapPin, ArrowRight, Star, Mail, XCircle
} from "lucide-react";

export default function AgentHome() {
  const { profile, loading } = useCurrentProfile();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  const isVerified = profile?.vetted || profile?.agent?.verification_status === 'verified';
  const hasNDA = profile?.nda_accepted;
  const agentData = profile?.agent || {};
  const docs = agentData.documents || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-10 h-10" />
            <h1 className="text-4xl font-bold">Your Agent Dashboard</h1>
          </div>
          <p className="text-emerald-100 text-lg">
            Welcome back, {profile?.full_name || 'Agent'}! Connect with serious investors and grow your business.
          </p>
          
          {/* Metric Pills */}
          <div className="flex gap-4 mt-6 flex-wrap">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm">
                Status: <strong>{isVerified ? 'Verified' : 'Pending'}</strong>
              </span>
            </div>
            <div className={`backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2 ${
              hasNDA ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}>
              {hasNDA ? (
                <>
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">
                    NDA: <strong>Signed ✅</strong>
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm">
                    NDA: <strong>Required</strong>
                  </span>
                </>
              )}
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">
                Deals Closed: <strong>0</strong>
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
        {/* NDA Banner */}
        {!hasNDA && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-red-900 mb-2">NDA Required</h3>
                <p className="text-red-800 mb-4">
                  Sign the platform NDA to access investor profiles, deal rooms, and protected features.
                </p>
                <Link to={createPageUrl("NDA")}>
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Shield className="w-4 h-4 mr-2" />
                    Sign NDA
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Verification Banner */}
        {!isVerified && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <Award className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">Complete Verification</h3>
                <p className="text-orange-800 mb-4">
                  Get your profile verified to appear in investor searches and unlock all features. Free for agents!
                </p>
                <Link to={createPageUrl("Vetting")}>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    Start Verification
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* My Profile */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-900">My Profile</h2>
              </div>
              <Link to={createPageUrl("AgentProfile")}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            </div>
            
            <div className="space-y-4">
              {agentData.brokerage && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">Brokerage</p>
                  <p className="font-semibold text-slate-900">{agentData.brokerage}</p>
                </div>
              )}
              
              {agentData.license_number && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">License Number</p>
                  <p className="font-semibold text-slate-900">{agentData.license_number}</p>
                </div>
              )}
              
              {agentData.markets && agentData.markets.length > 0 && (
                <div>
                  <p className="text-sm text-slate-600 mb-2">Markets</p>
                  <div className="flex flex-wrap gap-2">
                    {agentData.markets.map((market, idx) => (
                      <Badge key={idx} variant="secondary">
                        <MapPin className="w-3 h-3 mr-1" />
                        {market}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {agentData.specialties && agentData.specialties.length > 0 && (
                <div>
                  <p className="text-sm text-slate-600 mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {agentData.specialties.map((spec, idx) => (
                      <Badge key={idx} variant="secondary">{spec}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {(!agentData.brokerage && !agentData.license_number && !agentData.markets) && (
                <div className="text-center py-8">
                  <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 mb-3">Complete your agent profile</p>
                  <Link to={createPageUrl("AgentProfile")}>
                    <Button size="sm">Edit Profile</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Investor Feed */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Investor Feed</h2>
              </div>
              <Link to={createPageUrl("Investors")}>
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
            
            <div className="space-y-3">
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">Complete your profile to see investor matches</p>
                <Link to={createPageUrl("AgentProfile")}>
                  <Button size="sm" variant="outline">Complete Profile</Button>
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
              <Link to={createPageUrl("AgentDocuments")}>
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
                <p className="text-slate-600 mb-3">Upload license & resume</p>
                <Link to={createPageUrl("AgentDocuments")}>
                  <Button size="sm">Upload Documents</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Links</h2>
            <div className="space-y-2">
              <Link to={createPageUrl("Vetting")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Verification Status
                </Button>
              </Link>
              <Link to={createPageUrl("Matches")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Users className="w-4 h-4 text-blue-600" />
                  My Leads
                </Button>
              </Link>
              <Link to={createPageUrl("DealRooms")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Deal Rooms
                </Button>
              </Link>
              <Link to={createPageUrl("Inbox")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Mail className="w-4 h-4 text-slate-600" />
                  Messages
                </Button>
              </Link>
              {!hasNDA && (
                <Link to={createPageUrl("NDA")}>
                  <Button variant="outline" className="w-full justify-start gap-3 border-red-200 text-red-700 hover:bg-red-50">
                    <Shield className="w-4 h-4" />
                    Sign NDA (Required)
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Agent Benefits */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Why AgentVault?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Free Membership</h3>
              <p className="text-sm text-slate-600">No fees to join or use AgentVault. Always free for agents.</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Qualified Investors</h3>
              <p className="text-sm text-slate-600">Connect with serious, pre-vetted investors only.</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <Star className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Build Reputation</h3>
              <p className="text-sm text-slate-600">Earn verified reviews and grow your business.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

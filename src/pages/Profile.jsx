import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/AuthGuard";
import { 
  User, Mail, Phone, Building, MapPin, Award, 
  Target, CheckCircle, Edit, Loader2, Calendar, ArrowLeft, RefreshCw,
  Shield, Star, DollarSign, FileText
} from "lucide-react";

function ProfileContent() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      console.log('[Profile] 🔄 Loading profile data...');

      // Force no-cache to get fresh data
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const state = await response.json();
        console.log('[Profile] ✅ Loaded fresh state:', state);
        console.log('[Profile] COMPLETE Profile data:', state.profile);
        setSession(state);
      } else {
        console.error('[Profile] ❌ Failed to load session:', response.status);
      }

      setLoading(false);
    } catch (error) {
      console.error('[Profile] ❌ Load error:', error);
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  const profile = session?.profile || {};
  const hasCompletedOnboarding = session?.onboarding?.completed || false;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Back Button & Refresh */}
        <div className="flex items-center justify-between mb-6">
          <Link to={createPageUrl("Dashboard")} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Header with Photo */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
          <div className="flex items-start gap-6 mb-6">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              {profile.headshotUrl ? (
                <img 
                  src={profile.headshotUrl} 
                  alt={profile.full_name || 'Profile'} 
                  className="w-24 h-24 rounded-full object-cover border-4 border-slate-100"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center text-white text-3xl font-bold">
                  {(profile.full_name || session?.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Header Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {profile.full_name || 'Your Profile'}
              </h1>
              <p className="text-slate-600 mb-3">{session?.email || 'No email'}</p>
              
              <div className="flex gap-2 items-center flex-wrap">
                {hasCompletedOnboarding ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    Incomplete
                  </Badge>
                )}
                
                {profile.user_type && (
                  <Badge variant="secondary" className="capitalize">
                    {profile.user_type}
                  </Badge>
                )}
                
                {profile.vetted && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
                
                {profile.status && (
                  <Badge 
                    className={
                      profile.status === 'approved' ? 'bg-green-100 text-green-800' :
                      profile.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {profile.status}
                  </Badge>
                )}
              </div>
            </div>

            {/* Edit Button */}
            <Link to={createPageUrl("AccountProfile")}>
              <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Edit className="w-4 h-4" />
                Edit Profile
              </Button>
            </Link>
          </div>

          {/* Completion Date */}
          {session?.onboarding?.completedAt && (
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
              <Calendar className="w-4 h-4" />
              <span>Profile completed on {new Date(session.onboarding.completedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
          )}
        </div>

        {/* Bio Section */}
        {profile.bio && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">About</h2>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {/* Profile Information */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Basic Information</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-slate-600">Full Name</p>
                  <p className="font-semibold text-slate-900">
                    {profile.full_name || 'Not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-slate-600">Email</p>
                  <p className="font-semibold text-slate-900 break-all">
                    {session?.email || profile.email || 'Not set'}
                  </p>
                </div>
              </div>

              {profile.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Phone</p>
                    <p className="font-semibold text-slate-900">{profile.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-slate-600">Account Type</p>
                  <Badge variant="secondary" className="mt-1 capitalize">
                    {profile.user_type || 'Not set'}
                  </Badge>
                </div>
              </div>

              {profile.role && (
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Platform Role</p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {profile.role}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Professional Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Professional Details</h2>
            <div className="space-y-4">
              {profile.company ? (
                <div className="flex items-start gap-3">
                  <Building className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Company</p>
                    <p className="font-semibold text-slate-900">{profile.company}</p>
                  </div>
                </div>
              ) : null}

              {profile.accreditation ? (
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Accreditation</p>
                    <p className="font-semibold text-slate-900">{profile.accreditation}</p>
                  </div>
                </div>
              ) : null}

              {profile.licenseNumber && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">License Number</p>
                    <p className="font-semibold text-slate-900">{profile.licenseNumber}</p>
                  </div>
                </div>
              )}

              {profile.licenseState && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">License State</p>
                    <p className="font-semibold text-slate-900">{profile.licenseState}</p>
                  </div>
                </div>
              )}

              {profile.broker && (
                <div className="flex items-start gap-3">
                  <Building className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Broker</p>
                    <p className="font-semibold text-slate-900">{profile.broker}</p>
                  </div>
                </div>
              )}

              {profile.reputationScore !== undefined && profile.reputationScore !== null && (
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Reputation Score</p>
                    <p className="font-semibold text-slate-900">{profile.reputationScore}/100</p>
                  </div>
                </div>
              )}

              {!profile.company && !profile.accreditation && !profile.licenseNumber && !profile.broker && (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm mb-3">No professional details added yet</p>
                  <Link to={createPageUrl("AccountProfile")}>
                    <Button variant="outline" size="sm">
                      Add Details
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Info */}
        {(profile.subscription_tier && profile.subscription_tier !== 'none') && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Subscription</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Plan</p>
                <Badge variant="secondary" className="mt-1 capitalize text-base">
                  {profile.subscription_tier}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-600">Status</p>
                <Badge 
                  className={`mt-1 ${
                    profile.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                    profile.subscription_status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                    profile.subscription_status === 'cancelled' ? 'bg-orange-100 text-orange-800' :
                    'bg-slate-100 text-slate-800'
                  }`}
                >
                  {profile.subscription_status || 'None'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Markets */}
        {profile.markets && profile.markets.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Target Markets</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.markets.map((market, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm">
                  {market}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {/* Goals */}
        {profile.goals ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Goals</h2>
            </div>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{profile.goals}</p>
          </div>
        ) : null}

        {/* Proof Links */}
        {profile.proofLinks && profile.proofLinks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Verification Documents</h2>
            </div>
            <div className="space-y-2">
              {profile.proofLinks.map((link, idx) => (
                <a 
                  key={idx} 
                  href={link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:text-blue-700 hover:underline text-sm break-all"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* NDA Status */}
        {profile.nda_accepted && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">NDA Status</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-slate-700">NDA Accepted</span>
              </div>
              {profile.nda_accepted_at && (
                <p className="text-sm text-slate-600">
                  Signed on {new Date(profile.nda_accepted_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
              {profile.nda_version && (
                <p className="text-xs text-slate-500">Version: {profile.nda_version}</p>
              )}
            </div>
          </div>
        )}

        {/* Incomplete Prompt */}
        {!hasCompletedOnboarding && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2">Complete Your Profile</h3>
                <p className="text-blue-800 mb-4">
                  Fill out all required information to unlock full access to AgentVault.
                </p>
                <Link to={createPageUrl("Onboarding")}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Complete Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline">
              Back to Dashboard
            </Button>
          </Link>
          <Link to={createPageUrl("AccountProfile")}>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Edit className="w-4 h-4" />
              Edit Profile
            </Button>
          </Link>
        </div>

        {/* Debug Info (only shown in console) */}
        {console.log('[Profile] All available fields:', Object.keys(profile))}
        {console.log('[Profile] Complete profile object:', profile)}
      </div>
    </div>
  );
}

export default function Profile() {
  return (
    <AuthGuard requireAuth={true}>
      <ProfileContent />
    </AuthGuard>
  );
}
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/AuthGuard";
import { 
  User, Mail, Phone, Building, MapPin, Award, 
  Target, CheckCircle, Edit, Loader2, Calendar, ArrowLeft, RefreshCw
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
        console.log('[Profile] Profile data:', {
          full_name: state.profile?.full_name,
          user_type: state.profile?.user_type,
          markets: state.profile?.markets,
          phone: state.profile?.phone,
          company: state.profile?.company,
          goals: state.profile?.goals,
          completed: state.onboarding?.completed
        });
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

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {profile.full_name || 'Your Profile'}
              </h1>
              <p className="text-slate-600">{session?.email || 'No email'}</p>
            </div>
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
              <Link to={createPageUrl("AccountProfile")}>
                <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </Button>
              </Link>
            </div>
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
                    {session?.email || 'Not set'}
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
              ) : (
                <div className="text-slate-500 text-sm italic">No company listed</div>
              )}

              {profile.accreditation ? (
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Accreditation</p>
                    <p className="font-semibold text-slate-900">{profile.accreditation}</p>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-sm italic">No accreditation listed</div>
              )}

              {!profile.company && !profile.accreditation && (
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
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Target Markets</h2>
            </div>
            <p className="text-slate-500 text-sm italic">No markets listed yet</p>
          </div>
        )}

        {/* Goals */}
        {profile.goals ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Goals</h2>
            </div>
            <p className="text-slate-700 leading-relaxed">{profile.goals}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Goals</h2>
            </div>
            <p className="text-slate-500 text-sm italic">No goals listed yet</p>
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
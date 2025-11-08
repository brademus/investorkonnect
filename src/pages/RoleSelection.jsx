import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, ArrowRight, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function RoleSelection() {
  const navigate = useNavigate();
  const { loading, user, profile, onboarded, role } = useCurrentProfile();
  const [updating, setUpdating] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    document.title = "Select Your Role - AgentVault";

    // Redirect if already has role and onboarded
    if (!loading && user && onboarded && role && role !== 'member') {
      if (role === 'investor') {
        navigate(createPageUrl("Matches"), { replace: true });
      } else if (role === 'agent') {
        navigate(createPageUrl("AgentDashboard"), { replace: true });
      }
    }

    // Redirect to login if not authenticated
    if (!loading && !user) {
      base44.auth.redirectToLogin(window.location.pathname);
    }
  }, [loading, user, onboarded, role, navigate]);

  const handleRoleSelection = async (chosenRole) => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    setSelectedRole(chosenRole);
    setUpdating(true);

    try {
      // Update profile with selected role
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      
      if (profiles.length > 0) {
        // Update existing profile
        await base44.entities.Profile.update(profiles[0].id, {
          user_role: chosenRole
        });
      } else {
        // Create new profile
        await base44.entities.Profile.create({
          user_id: user.id,
          email: user.email,
          user_role: chosenRole,
          role: 'member'
        });
      }

      toast.success(`You're now registered as an ${chosenRole}!`);

      // Navigate to appropriate onboarding
      if (chosenRole === 'investor') {
        navigate(createPageUrl("InvestorOnboarding"));
      } else {
        navigate(createPageUrl("AgentOnboarding"));
      }

    } catch (error) {
      console.error('Role selection error:', error);
      toast.error("Failed to save role. Please try again.");
      setUpdating(false);
      setSelectedRole(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            How will you use AgentVault?
          </h1>
          <p className="text-xl text-slate-600">
            Choose your role to get started
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Investor Card */}
          <button
            onClick={() => handleRoleSelection('investor')}
            disabled={updating}
            className={`bg-white rounded-2xl p-8 border-3 transition-all hover:shadow-2xl group text-left ${
              selectedRole === 'investor' ? 'border-blue-600 shadow-xl' : 'border-slate-200 hover:border-blue-400'
            } ${updating && selectedRole !== 'investor' ? 'opacity-50' : ''}`}
          >
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-200 transition-colors">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              I'm an Investor
            </h2>
            
            <p className="text-slate-600 mb-6 leading-relaxed">
              Looking to find verified, investor-friendly agents to help me identify and close deals
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                </div>
                Browse verified agent profiles
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                </div>
                Get matched with top agents in your market
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                </div>
                Secure deal rooms with NDA protection
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                </div>
                AI-powered contract drafting (Pro plan)
              </li>
            </ul>

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-600">
                {updating && selectedRole === 'investor' ? 'Setting up...' : 'Select Investor'}
              </span>
              {updating && selectedRole === 'investor' ? (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
              )}
            </div>
          </button>

          {/* Agent Card */}
          <button
            onClick={() => handleRoleSelection('agent')}
            disabled={updating}
            className={`bg-white rounded-2xl p-8 border-3 transition-all hover:shadow-2xl group text-left ${
              selectedRole === 'agent' ? 'border-emerald-600 shadow-xl' : 'border-slate-200 hover:border-emerald-400'
            } ${updating && selectedRole !== 'agent' ? 'opacity-50' : ''}`}
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-200 transition-colors">
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              I'm an Agent
            </h2>
            
            <p className="text-slate-600 mb-6 leading-relaxed">
              Join a selective network of investor-focused agents and connect with serious buyers
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                </div>
                Access serious, pre-qualified investors
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                </div>
                Build reputation with verified reviews
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                </div>
                Manage leads in your dashboard
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                </div>
                Free membership (always)
              </li>
            </ul>

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-600">
                {updating && selectedRole === 'agent' ? 'Setting up...' : 'Select Agent'}
              </span>
              {updating && selectedRole === 'agent' ? (
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
              )}
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
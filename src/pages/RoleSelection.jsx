import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useWizard } from "@/components/WizardContext";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, ArrowLeft, Shield, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * STEP 2: ROLE SELECTION
 * 
 * User chooses Investor or Agent.
 * Flow: Map → Role → LOGIN → PostAuth → Onboarding
 * 
 * This page does NOT require auth.
 * When user selects role, we trigger login with state+role params.
 */
export default function RoleSelection() {
  const navigate = useNavigate();
  const { selectedState, setSelectedRole } = useWizard();
  const [selectedChoice, setSelectedChoice] = useState(null);

  useEffect(() => {
    document.title = "Choose Your Role - AgentVault";
  }, []);

  const handleRoleSelection = (chosenRole) => {
    console.log('[RoleSelection] 🎯 Role selected:', chosenRole);
    
    setSelectedChoice(chosenRole);
    setSelectedRole(chosenRole);

    // Build callback URL with state + role params
    // This way PostAuth knows what the user intended
    const params = new URLSearchParams();
    if (selectedState) {
      params.set('state', selectedState);
    }
    params.set('intendedRole', chosenRole);
    
    const callbackUrl = createPageUrl("PostAuth") + '?' + params.toString();
    
    console.log('[RoleSelection] 🔐 Triggering login with callback:', callbackUrl);
    
    // Trigger login - user will come back to PostAuth with these params
    base44.auth.redirectToLogin(callbackUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      {/* NO TOP NAV */}
      
      <div className="max-w-5xl w-full">
        
        {/* Back Button */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Home"))}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Map
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
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
            disabled={selectedChoice !== null}
            className={`bg-white rounded-3xl p-8 border-3 transition-all group text-left shadow-xl hover:shadow-2xl ${
              selectedChoice === 'investor' ? 'border-blue-600 scale-105' : 'border-slate-200 hover:border-blue-400'
            } ${selectedChoice && selectedChoice !== 'investor' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-200 group-hover:scale-110 transition-all">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              I'm an Investor
            </h2>
            
            <p className="text-slate-600 mb-6 leading-relaxed text-lg">
              Looking to find verified, investor-friendly agents to help me identify and close deals
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Browse verified agent profiles</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Get matched with top agents in your market</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Secure deal rooms with NDA protection</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>AI-powered contract drafting (Pro plan)</span>
              </li>
            </ul>

            <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold text-lg">
              {selectedChoice === 'investor' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Redirecting to sign in...
                </>
              ) : (
                'Select Investor →'
              )}
            </div>
          </button>

          {/* Agent Card */}
          <button
            onClick={() => handleRoleSelection('agent')}
            disabled={selectedChoice !== null}
            className={`bg-white rounded-3xl p-8 border-3 transition-all group text-left shadow-xl hover:shadow-2xl ${
              selectedChoice === 'agent' ? 'border-emerald-600 scale-105' : 'border-slate-200 hover:border-emerald-400'
            } ${selectedChoice && selectedChoice !== 'agent' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-200 group-hover:scale-110 transition-all">
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              I'm an Agent
            </h2>
            
            <p className="text-slate-600 mb-6 leading-relaxed text-lg">
              Join a selective network of investor-focused agents and connect with serious buyers
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Access serious, pre-qualified investors</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Build reputation with verified reviews</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Manage leads in your dashboard</span>
              </li>
              <li className="flex items-start gap-3 text-slate-700">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Free membership (always)</span>
              </li>
            </ul>

            <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold text-lg">
              {selectedChoice === 'agent' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Redirecting to sign in...
                </>
              ) : (
                'Select Agent →'
              )}
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
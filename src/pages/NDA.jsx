import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, Lock, FileText, Loader2, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * STEP 6: NDA ACCEPTANCE
 * 
 * Click-wrap NDA required before matching/rooms.
 * No top nav. Linear flow only.
 */
function NDAContent() {
  const navigate = useNavigate();
  const { loading, role, hasNDA, refresh } = useCurrentProfile();
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "NDA Required - AgentVault";
  }, []);

  // Redirect if already accepted (check after loading completes)
  useEffect(() => {
    if (!loading && hasNDA) {
      console.log('[NDA] Already accepted, redirecting...');
      const nextRoute = role === 'investor' ? createPageUrl("Matches") : createPageUrl("AgentDashboard");
      setTimeout(() => {
        navigate(nextRoute, { replace: true });
      }, 500);
    }
  }, [loading, hasNDA, role, navigate]);

  const handleAccept = async () => {
    if (!agreed) {
      toast.error("Please read and agree to the NDA terms");
      return;
    }

    console.log('[NDA] Accepting NDA...');
    setAccepting(true);
    setError(null);

    try {
      console.log('[NDA] Calling ndaAccept function...');
      const response = await base44.functions.invoke('ndaAccept');
      
      console.log('[NDA] Response:', response.data);
      
      if (response.data?.ok) {
        console.log('[NDA] ✅ NDA accepted successfully');
        toast.success("NDA accepted successfully!");
        
        // Refresh profile to get updated NDA status
        console.log('[NDA] Refreshing profile...');
        await refresh();
        
        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate based on role
        console.log('[NDA] Navigating to next step for role:', role);
        if (role === 'investor') {
          navigate(createPageUrl("Matches"), { replace: true });
        } else {
          navigate(createPageUrl("AgentDashboard"), { replace: true });
        }
      } else {
        const errorMsg = response.data?.error || "Failed to accept NDA";
        console.error('[NDA] ❌ Backend returned error:', errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
        setAccepting(false);
      }
    } catch (error) {
      console.error('[NDA] ❌ Exception:', error);
      const errorMsg = error.message || "Failed to accept NDA. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Already accepted - show success message while redirecting
  if (hasNDA) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">NDA Already Signed ✓</h2>
            <p className="text-slate-600 mb-6">
              {role === 'investor' ? 'Redirecting to matches...' : 'Redirecting to dashboard...'}
            </p>
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      {/* NO TOP NAV */}
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Confidentiality & NDA Required</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Required to access agent profiles and deal rooms
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Lock className="w-5 h-5 text-blue-600" />
            </div>
            <h4 className="font-semibold text-sm text-slate-900 mb-1">Deal Protection</h4>
            <p className="text-xs text-slate-600">Legally binding confidentiality</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="font-semibold text-sm text-slate-900 mb-1">Enforceable</h4>
            <p className="text-xs text-slate-600">Legal contract with remedies</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <h4 className="font-semibold text-sm text-slate-900 mb-1">One-Time</h4>
            <p className="text-xs text-slate-600">Accept once, valid forever</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
          
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 mb-1">Error</h4>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-6 max-h-96 overflow-y-auto border border-slate-200 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">AgentVault Non-Disclosure Agreement v1.0</h3>
            
            <div className="prose prose-sm text-slate-700 space-y-4">
              <p>
                This Non-Disclosure Agreement ("Agreement") is entered into by and between AgentVault ("Platform") and you ("User").
              </p>
              
              <h4 className="font-semibold text-slate-900">1. Confidential Information</h4>
              <p>
                "Confidential Information" means all deal information, property details, investment strategies, financial information, 
                agent contact details, and any other information shared through the Platform that is marked as confidential or would 
                reasonably be considered confidential.
              </p>
              
              <h4 className="font-semibold text-slate-900">2. Obligations</h4>
              <p>User agrees to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintain confidentiality of all Confidential Information</li>
                <li>Use Confidential Information only for legitimate real estate investment purposes</li>
                <li>Not share, copy, or distribute Confidential Information without written consent</li>
                <li>Notify Platform immediately of any unauthorized disclosure</li>
                <li>Return or destroy Confidential Information upon request</li>
              </ul>
              
              <h4 className="font-semibold text-slate-900">3. Term</h4>
              <p>
                This Agreement remains in effect for 5 years from the date of acceptance or until Confidential Information 
                becomes publicly available through no fault of User.
              </p>
              
              <h4 className="font-semibold text-slate-900">4. Remedies</h4>
              <p>
                User acknowledges that breach of this Agreement may cause irreparable harm to Platform and other users. 
                Platform may seek injunctive relief, monetary damages, and attorney fees for any breach.
              </p>
              
              <h4 className="font-semibold text-slate-900">5. Governing Law</h4>
              <p>
                This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law principles.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 mb-6">
            <Checkbox
              id="nda-agree"
              checked={agreed}
              onCheckedChange={setAgreed}
              className="mt-1"
              disabled={accepting}
            />
            <Label htmlFor="nda-agree" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
              I have read and agree to the terms of this Non-Disclosure Agreement. I understand that this is a legally 
              binding contract and that I am responsible for maintaining confidentiality of all information accessed through AgentVault.
            </Label>
          </div>

          <Button
            onClick={handleAccept}
            disabled={!agreed || accepting}
            className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5 mr-2" />
                I Accept & Continue
              </>
            )}
          </Button>

          <p className="text-center text-xs text-slate-500 mt-4">
            Questions? Contact <a href="mailto:legal@agentvault.com" className="text-blue-600 hover:text-blue-700">legal@agentvault.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NDA() {
  return (
    <StepGuard requiredStep={5}> {/* Requires VERIFY */}
      <NDAContent />
    </StepGuard>
  );
}
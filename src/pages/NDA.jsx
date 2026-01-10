import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { ndaAccept } from "@/components/functions";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, Lock, FileText, Loader2, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { devLog } from "@/components/devLogger";
import { DEMO_MODE } from "@/components/config/demo";

/**
 * STEP 6: NDA ACCEPTANCE
 * 
 * Click-wrap NDA required before accessing dashboard.
 * After acceptance, redirects to Dashboard (not matches).
 */
function NDAContent() {
  const navigate = useNavigate();
  const { loading, hasNDA, refresh, profile, user, kycVerified } = useCurrentProfile();
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

  // ADMIN BYPASS: Auto-sign NDA for admin users
  useEffect(() => {
    const handleAdminNDA = async () => {
      if (!loading && user?.role === 'admin') {
        console.log('[NDA] Admin user detected - auto-signing NDA');
        
        try {
          // Auto-sign NDA for admin if not already signed
          if (profile && !profile.nda_accepted) {
            await base44.entities.Profile.update(profile.id, {
              nda_accepted: true,
              nda_accepted_at: new Date().toISOString(),
              nda_version: 'v1.0'
            });
            await refresh();
          }
          
          // Redirect to Dashboard
          toast.success('Admin access granted - NDA bypassed');
          setTimeout(() => {
            navigate(createPageUrl("Dashboard"), { replace: true });
          }, 500);
        } catch (err) {
          console.error('[NDA] Admin auto-sign error:', err);
        }
      }
    };
    
    handleAdminNDA();
  }, [loading, user, profile, navigate, refresh]);

  useEffect(() => {
    document.title = "NDA Required - Investor Konnect";
  }, []);

  // Redirect if already accepted (check after loading completes)
  useEffect(() => {
    if (!loading && hasNDA) {
      devLog('[NDA] Already accepted, redirecting to dashboard...');
      setTimeout(() => {
        navigate(createPageUrl("Dashboard"), { replace: true });
      }, 500);
    }
  }, [loading, hasNDA, navigate]);


  const handleAccept = async () => {
    if (!agreed) {
      toast.error("Please read and agree to the NDA terms");
      return;
    }

    devLog('[NDA] 🎯 Accepting NDA...');
    setAccepting(true);
    setError(null);

    try {
      devLog('[NDA] Updating profile directly with NDA acceptance...');
      
      // Directly update the profile - skip the backend function that may have issues
      if (profile && profile.id) {
        await base44.entities.Profile.update(profile.id, {
          nda_accepted: true,
          nda_accepted_at: new Date().toISOString(),
          nda_version: 'v1.0'
        });
        devLog('[NDA] ✅ Profile updated with NDA flags');
        
        const response = { data: { ok: true } };
        
          toast.success("NDA accepted successfully!");
        
        // Force profile refresh to load new data
        devLog('[NDA] Refreshing profile...');
        await refresh();
        
        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to Dashboard
        devLog('[NDA] Navigating to Dashboard...');
        navigate(createPageUrl("Dashboard"), { replace: true });
      } else {
        throw new Error("Profile not available");
      }
    } catch (error) {
      devLog('[NDA] ❌ Exception:', error);
      const errorMsg = error.message || "Failed to accept NDA. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="ik-shell flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Loading...</p>
        </div>
      </div>
    );
  }

  // Already accepted - show success message while redirecting
  if (hasNDA) {
    return (
      <div className="ik-shell flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="ik-card p-8">
            <div className="w-16 h-16 bg-[#D1FAE5] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-[#10B981]" />
            </div>
            <h2 className="text-2xl font-bold text-[#111827] mb-2">NDA Already Signed ✓</h2>
            <p className="text-[#6B7280] mb-6">Redirecting to dashboard...</p>
            <Loader2 className="w-8 h-8 text-[#D3A029] animate-spin mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#E3C567] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#E3C567] mb-2">Non-Disclosure Agreement</h1>
          <p className="text-[#808080]">
            Required to access agent profiles and deal rooms
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4 text-center">
            <Lock className="w-6 h-6 text-[#E3C567] mx-auto mb-2" />
            <p className="text-xs font-medium text-[#FAFAFA]">Deal Protection</p>
          </div>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4 text-center">
            <FileText className="w-6 h-6 text-[#E3C567] mx-auto mb-2" />
            <p className="text-xs font-medium text-[#FAFAFA]">Enforceable</p>
          </div>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-[#E3C567] mx-auto mb-2" />
            <p className="text-xs font-medium text-[#FAFAFA]">One-Time</p>
          </div>
        </div>

        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-5 sm:p-6 shadow-sm">
          
          {/* Error Display */}
          {error && (
            <div className="bg-[#DC2626]/20 border border-[#DC2626]/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[#FAFAFA] mb-1">Error</h4>
                  <p className="text-sm text-[#FAFAFA]">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#141414] rounded-xl p-5 max-h-64 overflow-y-auto border border-[#1F1F1F] mb-5">
            <h3 className="text-base font-bold text-[#E3C567] mb-3">Investor Konnect Non-Disclosure Agreement v1.0</h3>
            
            <div className="prose prose-sm text-[#FAFAFA] space-y-4">
              <p>
                This Non-Disclosure Agreement ("Agreement") is entered into by and between Investor Konnect ("Platform") and you ("User").
              </p>
              
              <h4 className="font-semibold text-[#111827]">1. Confidential Information</h4>
              <p>
                "Confidential Information" means all deal information, property details, investment strategies, financial information, 
                agent contact details, and any other information shared through the Platform that is marked as confidential or would 
                reasonably be considered confidential.
              </p>
              
              <h4 className="font-semibold text-[#111827]">2. Obligations</h4>
              <p>User agrees to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintain confidentiality of all Confidential Information</li>
                <li>Use Confidential Information only for legitimate real estate investment purposes</li>
                <li>Not share, copy, or distribute Confidential Information without written consent</li>
                <li>Notify Platform immediately of any unauthorized disclosure</li>
                <li>Return or destroy Confidential Information upon request</li>
              </ul>
              
              <h4 className="font-semibold text-[#111827]">3. Term</h4>
              <p>
                This Agreement remains in effect for 5 years from the date of acceptance or until Confidential Information 
                becomes publicly available through no fault of User.
              </p>
              
              <h4 className="font-semibold text-[#111827]">4. Remedies</h4>
              <p>
                User acknowledges that breach of this Agreement may cause irreparable harm to Platform and other users. 
                Platform may seek injunctive relief, monetary damages, and attorney fees for any breach.
              </p>
              
              <h4 className="font-semibold text-[#111827]">5. Governing Law</h4>
              <p>
                This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law principles.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 mb-5 p-3 bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl">
            <Checkbox
              id="nda-agree"
              checked={agreed}
              onCheckedChange={setAgreed}
              className="mt-0.5"
              disabled={accepting}
            />
            <Label htmlFor="nda-agree" className="text-sm text-[#FAFAFA] cursor-pointer leading-relaxed">
              I have read and agree to the terms of this Non-Disclosure Agreement. I understand this is a legally binding contract.
            </Label>
          </div>

          <Button
            onClick={handleAccept}
            disabled={!agreed || accepting}
            className="w-full h-12 bg-[#E3C567] hover:bg-[#EDD89F] text-black font-medium rounded-xl disabled:opacity-50"
          >
            {accepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Accept & Continue
              </>
            )}
          </Button>

          <p className="text-center text-xs text-[#808080] mt-4">
            Questions? Contact <a href="mailto:legal@investorkonnect.com" className="text-[#E3C567] hover:underline">legal@investorkonnect.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NDA() {
  // DEMO MODE: Remove StepGuard to allow direct access (not that users would be sent here anyway)
  return <NDAContent />;
}
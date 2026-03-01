import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";

import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, Lock, FileText, Loader2, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import AgentParticipationAgreement from "@/components/AgentParticipationAgreement";



/**
 * STEP 6: NDA ACCEPTANCE
 * 
 * Click-wrap NDA required before accessing dashboard.
 * After acceptance, redirects to Dashboard (not matches).
 */
function NDAContent() {
  const navigate = useNavigate();
  const { loading, hasNDA, refresh, profile, user, kycVerified, onboarded } = useCurrentProfile();
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const isAgent = profile?.user_role === 'agent';

  useEffect(() => {
    document.title = "NDA Required - Investor Konnect";
  }, []);

  useEffect(() => {
    if (loading) return;
    if (hasNDA) { navigate(createPageUrl("Pipeline"), { replace: true }); return; }
    if (user?.role === 'admin') {
      (async () => {
        if (profile && !profile.nda_accepted) {
          await base44.entities.Profile.update(profile.id, { nda_accepted: true, nda_accepted_at: new Date().toISOString(), nda_version: 'v1.0' });
        }
        toast.success('Admin access granted');
        navigate(createPageUrl("Pipeline"), { replace: true });
      })().catch(() => {});
      return;
    }
    if (!profile) { navigate(createPageUrl("PostAuth"), { replace: true }); return; }
    if (!onboarded) {
      const r = profile.user_role;
      if (r === 'investor') navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      else if (r === 'agent') navigate(createPageUrl("AgentOnboarding"), { replace: true });
      return;
    }
    if (profile.user_role === 'investor') {
      const sub = profile.subscription_status;
      if (sub !== 'active' && sub !== 'trialing') { navigate(createPageUrl("Pricing"), { replace: true }); return; }
    }
    if (!kycVerified) { navigate(createPageUrl("IdentityVerification"), { replace: true }); return; }
  }, [loading, kycVerified, hasNDA]);


  const handleAccept = async () => {
    if (!agreed) {
      toast.error("Please read and agree to the NDA terms");
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      let currentProfile = profile;
      if (!currentProfile?.id) {
        const profiles = await base44.entities.Profile.filter({ user_id: user?.id });
        currentProfile = profiles[0];
      }
      if (!currentProfile?.id) throw new Error("Profile not available");
      
      await base44.entities.Profile.update(currentProfile.id, {
        nda_accepted: true,
        nda_accepted_at: new Date().toISOString(),
        nda_version: isAgent ? 'agent-v1.0' : 'v1.0'
      });
      
      toast.success("NDA accepted successfully!");
      refresh();
      setTimeout(() => { navigate(createPageUrl("Pipeline"), { replace: true }); }, 800);
    } catch (error) {
      console.error('[NDA] Exception:', error);
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
            <p className="text-[#6B7280] mb-6">Redirecting to pipeline...</p>
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
          <h1 className="text-2xl sm:text-3xl font-bold text-[#E3C567] mb-2">
            {isAgent ? "Agent Platform Participation Agreement" : "Investor Platform Participation Agreement"}
          </h1>
          <p className="text-[#808080]">
            {isAgent
              ? "Required before accessing the agent dashboard. By signing, you confirm you have read and agree to the following."
              : "Required to access agent profiles and deal rooms"}
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
            {isAgent ? (
              <>
                <h3 className="text-base font-bold text-[#E3C567] mb-3">Investor Agent Platform Participation Agreement v1.0</h3>
                <AgentParticipationAgreement />
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-[#E3C567] mb-3">Investor Platform Participation Agreement</h3>
                <div className="prose prose-sm text-[#FAFAFA] space-y-4">
                  <p>
                    This Investor Platform Participation Agreement ("Agreement") is entered into by and between Investor Konnect, LLC ("Platform") and Registered Investor User ("Investor"). Effective upon digital execution.
                  </p>

                  <h4 className="font-semibold text-[#E3C567]">1. Purpose of the Platform</h4>
                  <p>The Platform connects vetted real estate investors and wholesalers with licensed real estate agents for transaction support.</p>
                  <p>The Platform:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Is NOT a licensed brokerage.</li>
                    <li>Does NOT represent buyers or sellers.</li>
                    <li>Does NOT negotiate contracts.</li>
                    <li>Does NOT provide legal, financial, or tax advice.</li>
                    <li>Does NOT guarantee deal flow or profits.</li>
                  </ul>
                  <p>Platform is solely a matching and coordination system.</p>

                  <h4 className="font-semibold text-[#E3C567]">2. Independent Status</h4>
                  <p>Investor acknowledges:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Platform is not acting as agent, broker, partner, or fiduciary.</li>
                    <li>Investor remains fully responsible for:
                      <ul className="list-disc pl-6 mt-1 space-y-1">
                        <li>All contracts entered into</li>
                        <li>Compliance with local and federal laws</li>
                        <li>Assignment legality</li>
                        <li>Disclosure requirements</li>
                        <li>Transaction execution</li>
                      </ul>
                    </li>
                  </ul>
                  <p>Nothing in this Agreement creates a partnership, joint venture, or agency relationship.</p>

                  <h4 className="font-semibold text-[#E3C567]">3. Non-Circumvention (Agent Protection Clause)</h4>
                  <p>Investor agrees:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Not to bypass or attempt to bypass the Platform to work directly with Platform-introduced agents.</li>
                    <li>Not to solicit agents introduced through the Platform for off-platform transactions.</li>
                    <li>Not to remove agents from the Platform to avoid tracking or accountability.</li>
                    <li>Not to form undisclosed side agreements with Platform-introduced agents.</li>
                  </ul>
                  <p>This restriction applies during participation and for <strong>24 months</strong> following termination.</p>
                  <p>Violation may result in:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Immediate removal</li>
                    <li>Permanent ban</li>
                    <li>Legal action</li>
                    <li>Liquidated damages to be determined by court</li>
                  </ul>

                  <h4 className="font-semibold text-[#E3C567]">4. Confidentiality & Non-Disclosure</h4>
                  <p>Investor agrees to maintain confidentiality regarding:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Agent identities</li>
                    <li>Agent contact information</li>
                    <li>Platform systems</li>
                    <li>Platform processes</li>
                    <li>Platform scoring systems</li>
                    <li>Internal ranking data</li>
                    <li>Seller information introduced through Platform</li>
                  </ul>
                  <p>Confidential information may only be used for legitimate transaction purposes. Obligation survives termination for 3 years.</p>

                  <h4 className="font-semibold text-[#E3C567]">5. Platform Use Requirement</h4>
                  <p>Investor agrees that:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>All transactions involving Platform-introduced agents must be logged in the Platform.</li>
                    <li>Status updates must be provided when requested.</li>
                    <li>Investor will not process Platform-introduced transactions off-platform.</li>
                  </ul>
                  <p>Failure to comply may result in suspension.</p>

                  <h4 className="font-semibold text-[#E3C567]">6. Ethical Conduct & Seller Protection</h4>
                  <p>Investor agrees:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>To operate lawfully in all transactions.</li>
                    <li>To provide required disclosures in wholesale, novation, or creative transactions.</li>
                    <li>Not to misrepresent ownership interest, assignment rights, or financing structures.</li>
                    <li>Not to exploit seller distress unlawfully.</li>
                    <li>Not to engage in predatory conduct.</li>
                  </ul>
                  <p>Investor remains solely responsible for legal compliance in their state(s).</p>

                  <h4 className="font-semibold text-[#E3C567]">7. Respect for Licensed Activity</h4>
                  <p>Investor acknowledges:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Agents must comply with brokerage rules.</li>
                    <li>Agents cannot violate state licensing laws.</li>
                    <li>Investor shall not pressure agents to conceal assignment structures, withhold required disclosures, violate brokerage policies, or breach fiduciary duties.</li>
                  </ul>

                  <h4 className="font-semibold text-[#E3C567]">8. No Guarantee of Results</h4>
                  <p>Platform does not guarantee deal volume, agent performance, closing success, or profitability. Investor assumes full transactional risk.</p>

                  <h4 className="font-semibold text-[#E3C567]">9. Limitation of Liability</h4>
                  <p>Platform shall not be liable for failed transactions, contract disputes, commission disputes, seller claims, regulatory enforcement actions, agent misconduct, or investor losses. Maximum liability of Platform, if any, shall not exceed $1,000.</p>

                  <h4 className="font-semibold text-[#E3C567]">10. Indemnification</h4>
                  <p>Investor agrees to indemnify and hold harmless the Platform from any claims, damages, regulatory actions, or legal costs arising from investor's transactions, assignment disputes, seller disputes, financing disputes, regulatory violations, or misrepresentation.</p>

                  <h4 className="font-semibold text-[#E3C567]">11. Monitoring & Removal</h4>
                  <p>Platform reserves the right to monitor investor behavior, collect agent feedback, suspend or remove investor accounts, and deny future participation at its sole discretion.</p>
                  <p>Grounds for removal include circumvention, repeated deal fallout, ethical complaints, misrepresentation, and legal violations. Platform is not required to provide prior notice before removal.</p>

                  <h4 className="font-semibold text-[#E3C567]">12. Governing Law & Dispute Resolution</h4>
                  <p>This Agreement shall be governed by the laws of the State of Texas. All disputes shall be resolved through binding arbitration. Prevailing party entitled to attorney fees.</p>

                  <h4 className="font-semibold text-[#E3C567]">13. Term & Survival</h4>
                  <p>This Agreement remains in effect until terminated. The following sections survive termination: Non-Circumvention, Confidentiality, Indemnification, and Limitation of Liability.</p>

                  <h4 className="font-semibold text-[#E3C567]">14. Digital Acknowledgment</h4>
                  <p>By signing electronically, Investor confirms:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>I understand Platform is not a brokerage.</li>
                    <li>I agree to the Non-Circumvention clause.</li>
                    <li>I accept full responsibility for my transactions.</li>
                    <li>I agree to comply with Platform standards.</li>
                  </ul>
                </div>
              </>
            )}
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
              {isAgent
                ? "I have read and agree to the Agent Platform Participation Agreement. I confirm broker approval for participation and understand this is a legally binding contract."
                : "I have read and agree to the terms of this Investor Platform Participation Agreement. I understand this is a legally binding contract."}
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
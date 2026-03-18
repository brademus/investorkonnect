import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Users, Shield, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import TeamMemberInfoStep from "@/components/team/TeamMemberInfoStep";
import TeamPhoneStep from "@/components/team/TeamPhoneStep";
import PhoneVerifyStep from "@/components/onboarding/PhoneVerifyStep";
import TeamNDAStep from "@/components/team/TeamNDAStep";

const STEPS = ["invite", "info", "phone", "verify_phone", "identity", "nda", "done"];

export default function AcceptInvite() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const seatId = urlParams.get("seatId");

  const [loading, setLoading] = useState(true);
  const [seat, setSeat] = useState(null);
  const [ownerName, setOwnerName] = useState("");
  const [responding, setResponding] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [step, setStep] = useState("invite"); // current step
  const [saving, setSaving] = useState(false);

  // Form state
  const [info, setInfo] = useState({ firstName: "", lastName: "", licenseNumber: "" });
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [ndaAgreed, setNdaAgreed] = useState(false);
  const [ownerRole, setOwnerRole] = useState("agent");

  // Identity verification
  const [idStatus, setIdStatus] = useState("pending");
  const [idMessage, setIdMessage] = useState("");
  const idStartedRef = useRef(false);

  useEffect(() => {
    if (!seatId) { setLoading(false); return; }
    const load = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) { base44.auth.redirectToLogin(window.location.href); return; }
      try {
        const res = await base44.functions.invoke("teamAcceptInvite", { seat_id: seatId, action: "info" });
        if (!res.data?.ok) { setErrorMsg(res.data?.error || "Invitation not found."); setLoading(false); return; }
        setSeat(res.data.seat);
        setOwnerName(res.data.owner_name || res.data.seat.owner_email);
        setOwnerRole(res.data.owner_role || "agent");
        if (res.data.already_handled === "accepted") { setStep("done"); }
        else if (res.data.already_handled === "declined") { setStep("declined"); }
      } catch (err) {
        setErrorMsg(err?.response?.data?.error || "Could not load invitation.");
      }
      setLoading(false);
    };
    load();
  }, [seatId]);

  const handleAccept = async () => {
    setResponding(true);
    try {
      const res = await base44.functions.invoke("teamAcceptInvite", { seat_id: seatId, action: "accept" });
      if (res.data?.ok) {
        toast.success("Invitation accepted! Let's set up your account.");
        setStep("info");
      } else {
        toast.error(res.data?.error || "Something went wrong");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to accept invitation");
    }
    setResponding(false);
  };

  const handleDecline = async () => {
    setResponding(true);
    try {
      const res = await base44.functions.invoke("teamAcceptInvite", { seat_id: seatId, action: "decline" });
      if (res.data?.ok) { toast.info("Invitation declined."); setStep("declined"); }
    } catch (err) { toast.error("Failed to decline"); }
    setResponding(false);
  };

  const saveInfoAndContinue = async () => {
    if (!info.firstName?.trim() || !info.lastName?.trim()) { toast.error("Please enter your full name"); return; }
    if (ownerRole === "agent" && !info.licenseNumber?.trim()) { toast.error("Please enter your license number"); return; }
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const profile = profiles[0];
      if (profile) {
        const updateData = {
          full_name: `${info.firstName.trim()} ${info.lastName.trim()}`,
          onboarding_first_name: info.firstName.trim(),
          onboarding_last_name: info.lastName.trim(),
        };
        if (ownerRole === "agent" && info.licenseNumber?.trim()) {
          updateData.agent = { ...(profile.agent || {}), license_number: info.licenseNumber.trim() };
        }
        await base44.entities.Profile.update(profile.id, updateData);
      }
      setStep("phone");
    } catch (err) {
      toast.error("Failed to save info");
    }
    setSaving(false);
  };

  const handlePhoneContinue = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Please enter a valid phone number"); return; }
    setStep("verify_phone");
  };

  const handlePhoneVerified = async () => {
    setPhoneVerified(true);
    // Save phone to profile
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (profiles[0]) await base44.entities.Profile.update(profiles[0].id, { phone });
    } catch {}
    setStep("identity");
  };

  const handleVerifyCode = async () => {
    const codeInput = document.querySelector("[data-phone-code]");
    const code = codeInput?.value?.trim();
    if (!code || code.length !== 6) { toast.error("Please enter the 6-digit code"); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("verifyPhoneCode", { code, phone });
      if (res.data?.verified) {
        toast.success("Phone verified!");
        handlePhoneVerified();
      } else {
        toast.error(res.data?.error || "Invalid code");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Verification failed");
    }
    setSaving(false);
  };

  // Identity verification (Stripe)
  useEffect(() => {
    if (step !== "identity" || idStartedRef.current) return;
    idStartedRef.current = true;
    startIdentityVerification();
  }, [step]);

  const startIdentityVerification = async () => {
    setIdStatus("loading");
    setIdMessage("Preparing verification...");
    try {
      const resp = await base44.functions.invoke("createStripeIdentitySession", {});
      const { client_secret, publishable_key, session_id } = resp.data || {};
      if (!client_secret || !publishable_key) throw new Error("Could not initialize verification");

      setIdMessage("Loading verification module...");
      await new Promise((resolve, reject) => {
        if (window.Stripe) return resolve();
        const script = document.createElement("script");
        script.src = "https://js.stripe.com/v3/";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

      setIdStatus("modal");
      setIdMessage("Complete verification in the popup window");
      const stripe = window.Stripe(publishable_key);
      const result = await stripe.verifyIdentity(client_secret);
      if (result?.error) throw new Error(result.error.message || "Verification cancelled");

      setIdStatus("polling");
      setIdMessage("Confirming your verification...");
      let finalStatus = "processing";
      for (let i = 0; i < 10; i++) {
        try {
          const { data } = await base44.functions.invoke("getStripeIdentityStatus", { session_id });
          finalStatus = data?.status;
          if (finalStatus === "verified" || finalStatus === "requires_input" || finalStatus === "canceled") break;
        } catch {}
        await new Promise(r => setTimeout(r, 1500));
      }
      if (finalStatus === "requires_input" || finalStatus === "canceled") throw new Error("Verification not completed. Please try again.");

      setIdStatus("success");
      setTimeout(() => setStep("nda"), 800);
    } catch (err) {
      setIdStatus("error");
      setIdMessage(err?.message || "Verification failed");
    }
  };

  const handleNdaAccept = async () => {
    if (!ndaAgreed) { toast.error("Please agree to the terms"); return; }
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const profile = profiles[0];
      if (profile) {
        await base44.entities.Profile.update(profile.id, {
          nda_accepted: true,
          nda_accepted_at: new Date().toISOString(),
          nda_version: "team-v1.0",
          onboarding_completed_at: new Date().toISOString(),
          onboarding_version: "team-1.0",
        });
      }
      try { sessionStorage.removeItem("__ik_profile_cache"); } catch {}
      toast.success("You're all set!");
      setStep("done");
      setTimeout(() => navigate(createPageUrl("Pipeline"), { replace: true }), 1200);
    } catch (err) {
      toast.error("Failed to save. Please try again.");
    }
    setSaving(false);
  };

  // --- Progress bar ---
  const stepIndex = STEPS.indexOf(step);
  const totalOnboarding = STEPS.length - 2; // exclude "invite" and "done"
  const progressIndex = Math.max(0, stepIndex - 1);
  const showProgress = stepIndex >= 1 && stepIndex < STEPS.length - 1;

  // --- RENDERS ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  if (!seatId || errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-black">
        <div className="ik-page-card max-w-md w-full text-center py-12">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#FAFAFA] mb-2">Invalid Invitation</h2>
          <p className="text-[#808080] mb-6">{errorMsg || "No invitation ID provided."}</p>
          <Button onClick={() => navigate(createPageUrl("Home"))} className="bg-[#E3C567] text-black hover:bg-[#EDD89F]">Go Home</Button>
        </div>
      </div>
    );
  }

  if (step === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-black">
        <div className="ik-page-card max-w-md w-full text-center py-12">
          <XCircle className="w-12 h-12 text-[#808080] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#FAFAFA] mb-2">Invitation Declined</h2>
          <p className="text-[#808080] mb-6">You can always ask the team owner to re-invite you later.</p>
          <Button onClick={() => navigate(createPageUrl("Home"))} variant="outline" className="border-[#333] text-[#FAFAFA]">Go Home</Button>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-black">
        <div className="ik-page-card max-w-md w-full text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#E3C567] mb-2">Welcome to the Team!</h2>
          <p className="text-[#808080] mb-6">Redirecting to your dashboard...</p>
          <Loader2 className="w-6 h-6 text-[#E3C567] animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="h-16 flex items-center justify-center border-b border-[#1F1F1F] flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2a5ae75f8_616CA829-4C69-40A9-8555-BE50375B7FC6.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-base font-light tracking-wide text-[#E3C567]" style={{ fontFamily: "'Cinzel', serif" }}>Investor Konnect</span>
        </div>
      </header>

      {/* Progress bar */}
      {showProgress && (
        <div className="max-w-lg mx-auto w-full px-6 pt-6">
          <div className="flex items-center gap-1 mb-1">
            {Array.from({ length: totalOnboarding }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= progressIndex ? "bg-[#E3C567]" : "bg-[#1F1F1F]"}`} />
            ))}
          </div>
          <p className="text-xs text-[#808080] text-right">Step {progressIndex + 1} of {totalOnboarding}</p>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-lg w-full">
          <div className="ik-page-card p-8">

            {/* STEP: Invite accept/decline */}
            {step === "invite" && (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-[#E3C567]/15 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-[#E3C567]" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#E3C567] mb-2">Team Invitation</h2>
                  <p className="text-[#808080]">You've been invited to join a team</p>
                </div>
                <div className="rounded-xl p-5 border border-[#1F1F1F] bg-[#0D0D0D] mb-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-[#808080] uppercase tracking-wider mb-1">Invited by</p>
                      <p className="text-[#FAFAFA] font-semibold">{ownerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#808080] uppercase tracking-wider mb-1">Your Role</p>
                      <div className="flex items-center gap-2">
                        {seat.team_role === "admin" ? (
                          <><Shield className="w-4 h-4 text-[#E3C567]" /><span className="text-[#FAFAFA] font-semibold">Admin</span></>
                        ) : (
                          <><Eye className="w-4 h-4 text-[#808080]" /><span className="text-[#FAFAFA] font-semibold">Viewer</span></>
                        )}
                      </div>
                      <p className="text-xs text-[#808080] mt-1">
                        {seat.team_role === "admin" ? "Full access to create, edit, and manage all deals." : "View-only access to all deals and activity."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleDecline} disabled={responding} variant="outline" className="flex-1 border-[#333] text-[#FAFAFA] hover:bg-[#1F1F1F]">
                    {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Decline"}
                  </Button>
                  <Button onClick={handleAccept} disabled={responding} className="flex-1 bg-[#E3C567] text-black hover:bg-[#EDD89F] font-semibold">
                    {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" /> Accept</>}
                  </Button>
                </div>
              </>
            )}

            {/* STEP: Basic info */}
            {step === "info" && (
              <>
                <TeamMemberInfoStep data={info} onChange={setInfo} isAgent={ownerRole === "agent"} />
                <div className="flex justify-end mt-8">
                  <Button onClick={saveInfoAndContinue} disabled={saving} className="bg-[#E3C567] text-black hover:bg-[#EDD89F] font-semibold px-8 h-12 rounded-xl">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {/* STEP: Phone input */}
            {step === "phone" && (
              <>
                <TeamPhoneStep phone={phone} onChange={setPhone} />
                <div className="flex justify-between mt-8">
                  <Button onClick={() => setStep("info")} variant="outline" className="border-[#333] text-[#FAFAFA]">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={handlePhoneContinue} className="bg-[#E3C567] text-black hover:bg-[#EDD89F] font-semibold px-8 h-12 rounded-xl">
                    Send Code <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {/* STEP: Verify phone code */}
            {step === "verify_phone" && (
              <>
                <PhoneVerifyStep phone={phone} />
                <div className="flex justify-between mt-8">
                  <Button onClick={() => setStep("phone")} variant="outline" className="border-[#333] text-[#FAFAFA]">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={handleVerifyCode} disabled={saving} className="bg-[#E3C567] text-black hover:bg-[#EDD89F] font-semibold px-8 h-12 rounded-xl">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    {saving ? "Verifying..." : "Verify & Continue"}
                  </Button>
                </div>
              </>
            )}

            {/* STEP: Identity verification */}
            {step === "identity" && (
              <div className="text-center py-4">
                {idStatus === "success" ? (
                  <>
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#E3C567] mb-2">Identity Verified!</h3>
                    <p className="text-[#808080]">Continuing...</p>
                  </>
                ) : idStatus === "error" ? (
                  <>
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-red-500 mb-2">Verification Failed</h3>
                    <p className="text-[#808080] mb-6">{idMessage}</p>
                    <Button onClick={() => { idStartedRef.current = false; startIdentityVerification(); }} className="bg-[#E3C567] text-black hover:bg-[#EDD89F] font-semibold">
                      Try Again
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-[#E3C567]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Loader2 className="w-10 h-10 text-[#E3C567] animate-spin" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#E3C567] mb-2">
                      {idStatus === "modal" ? "Verification In Progress" : "Setting Up..."}
                    </h3>
                    <p className="text-[#808080]">{idMessage || "Preparing identity verification..."}</p>
                  </>
                )}
              </div>
            )}

            {/* STEP: NDA */}
            {step === "nda" && (
              <>
                <TeamNDAStep agreed={ndaAgreed} onAgreedChange={setNdaAgreed} isAgent={ownerRole === "agent"} />
                <div className="flex justify-end mt-6">
                  <Button onClick={handleNdaAccept} disabled={!ndaAgreed || saving} className="bg-[#E3C567] text-black hover:bg-[#EDD89F] font-semibold px-8 h-12 rounded-xl w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                    {saving ? "Saving..." : "Accept & Join Team"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";

/**
 * Phone verification component — sends a 6-digit SMS code and verifies it.
 * Props:
 *   phone: string (formatted phone)
 *   verified: boolean
 *   onVerified: () => void
 */
export default function PhoneVerification({ phone, verified, onVerified }) {
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef(null);

  const digits = (phone || "").replace(/\D/g, "");
  const isValidPhone = digits.length >= 10;

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Reset state when phone changes
  useEffect(() => {
    setCodeSent(false);
    setCode("");
  }, [digits]);

  const handleSendCode = async () => {
    if (!isValidPhone || sending) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("sendVerificationCode", { phone });
      if (res.data?.ok) {
        setCodeSent(true);
        setCooldown(60);
        toast.success("Verification code sent!");
        setTimeout(() => inputRef.current?.focus(), 200);
      } else {
        toast.error(res.data?.error || "Failed to send code");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to send code");
    }
    setSending(false);
  };

  const handleVerify = async () => {
    if (!code.trim() || verifying) return;
    setVerifying(true);
    try {
      const res = await base44.functions.invoke("verifyPhoneCode", { code: code.trim(), phone });
      if (res.data?.verified) {
        toast.success("Phone verified!");
        onVerified();
      } else {
        toast.error(res.data?.error || "Verification failed");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Verification failed");
    }
    setVerifying(false);
  };

  if (verified) {
    return (
      <div className="flex items-center gap-2 mt-3 px-1">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-sm text-green-400 font-medium">Phone verified</span>
      </div>
    );
  }

  if (!isValidPhone) return null;

  if (!codeSent) {
    return (
      <Button
        type="button"
        onClick={handleSendCode}
        disabled={sending}
        className="mt-3 bg-[#E3C567] text-black hover:bg-[#EDD89F] rounded-xl h-12 text-base font-semibold w-full"
      >
        {sending ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending code...</>
        ) : (
          <><MessageSquare className="w-4 h-4 mr-2" /> Verify Phone Number</>
        )}
      </Button>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-[#808080]">
        Enter the 6-digit code sent to <span className="text-[#FAFAFA] font-medium">{phone}</span>
      </p>
      <div className="flex gap-3">
        <Input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          inputMode="numeric"
          className="h-14 text-center text-2xl tracking-[0.5em] font-mono bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 flex-1"
        />
        <Button
          type="button"
          onClick={handleVerify}
          disabled={code.length !== 6 || verifying}
          className="bg-[#E3C567] text-black hover:bg-[#EDD89F] rounded-xl h-14 px-6 text-base font-semibold"
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
        </Button>
      </div>
      <button
        type="button"
        onClick={handleSendCode}
        disabled={cooldown > 0 || sending}
        className="text-sm text-[#E3C567] hover:text-[#EDD89F] disabled:text-[#666] transition-colors"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
    </div>
  );
}
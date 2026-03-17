import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";

/**
 * Full-page phone verification step for onboarding.
 * Auto-sends code on mount. User enters 6-digit code to verify.
 *
 * Props:
 *   phone: string
 *   onVerified: () => void   — called after successful verification
 */
export default function PhoneVerifyStep({ phone }) {
  const [sending, setSending] = useState(true);
  const [codeSent, setCodeSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const sentOnce = useRef(false);

  // Auto-send on mount
  useEffect(() => {
    if (!sentOnce.current) {
      sentOnce.current = true;
      sendCode();
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Focus input after code sent
  useEffect(() => {
    if (codeSent) setTimeout(() => inputRef.current?.focus(), 200);
  }, [codeSent]);

  const sendCode = async () => {
    setSending(true);
    setError("");
    try {
      const res = await base44.functions.invoke("sendVerificationCode", { phone });
      if (res.data?.ok) {
        setCodeSent(true);
        setCooldown(60);
      } else {
        setError(res.data?.error || "Failed to send code");
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to send code");
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && code.length === 6) {
      // Parent handles verify via the Next button
    }
  };

  return (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Verify your phone</h3>
      <p className="text-[18px] text-[#808080] mb-10">
        {codeSent
          ? <>Enter the 6-digit code we sent to <span className="text-[#FAFAFA] font-medium">{phone}</span></>
          : "Sending verification code..."
        }
      </p>

      {sending && !codeSent ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-10 h-10 animate-spin text-[#E3C567]" />
          <p className="text-[#808080]">Sending code to {phone}...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-center">
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              className="h-20 text-center text-4xl tracking-[0.5em] font-mono bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 max-w-[320px]"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setCode(""); sendCode(); }}
              disabled={cooldown > 0 || sending}
              className="text-sm text-[#E3C567] hover:text-[#EDD89F] disabled:text-[#666] transition-colors"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
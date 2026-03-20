import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import OtpBoxes from "./OtpBoxes";

/**
 * Full-page phone verification step for onboarding.
 * Auto-sends code on mount. User enters 4-digit code to verify.
 */
export default function PhoneVerifyStep({ phone }) {
  const [sending, setSending] = useState(true);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const sentOnce = useRef(false);

  useEffect(() => {
    if (!sentOnce.current) {
      sentOnce.current = true;
      sendCode();
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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

  return (
    <div>
      <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Verify your phone</h3>
      <p className="text-[18px] text-[#808080] mb-10">
        {codeSent
          ? <>Enter the 4-digit code we sent to <span className="text-[#FAFAFA] font-medium">{phone}</span></>
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
          <OtpBoxes
            value={code}
            onChange={(val) => { setCode(val); setError(""); }}
            autoFocus={codeSent}
          />

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
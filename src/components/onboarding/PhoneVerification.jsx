import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import OtpBoxes from "./OtpBoxes";

/**
 * Phone verification dialog — triggered externally via `open` prop.
 * Auto-sends SMS code on open. User enters 4-digit code to verify.
 */
export default function PhoneVerification({ phone, open, onOpenChange, onVerified }) {
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (open && !hasSentRef.current) {
      hasSentRef.current = true;
      sendCode();
    }
    if (!open) {
      hasSentRef.current = false;
      setCode("");
      setCodeSent(false);
      setError("");
    }
  }, [open]);

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

  const handleVerify = async () => {
    if (!code.trim() || verifying) return;
    setVerifying(true);
    setError("");
    try {
      const res = await base44.functions.invoke("verifyPhoneCode", { code: code.trim(), phone });
      if (res.data?.verified) {
        toast.success("Phone verified!");
        onVerified();
        onOpenChange(false);
      } else {
        setError(res.data?.error || "Invalid code. Please try again.");
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Verification failed");
    }
    setVerifying(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0D0D0D] border-[#1F1F1F]">
        <DialogHeader>
          <DialogTitle className="text-[#E3C567] text-xl flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Verify Your Phone
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {sending && !codeSent ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-[#E3C567]" />
              <p className="text-[#808080] text-sm">Sending verification code...</p>
            </div>
          ) : (
            <>
              <p className="text-[#FAFAFA] text-sm">
                We sent a 4-digit code to <span className="text-[#E3C567] font-medium">{phone}</span>
              </p>

              <OtpBoxes
                value={code}
                onChange={(val) => { setCode(val); setError(""); }}
                autoFocus={codeSent && open}
              />

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <Button
                type="button"
                onClick={handleVerify}
                disabled={code.length !== 4 || verifying}
                className="w-full h-12 bg-[#E3C567] text-black hover:bg-[#EDD89F] rounded-xl text-base font-semibold"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                {verifying ? "Verifying..." : "Verify & Continue"}
              </Button>

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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
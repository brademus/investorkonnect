import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Phone verification dialog — triggered externally via `open` prop.
 * Auto-sends SMS code on open. User enters 6-digit code to verify.
 *
 * Props:
 *   phone: string
 *   open: boolean
 *   onOpenChange: (bool) => void
 *   onVerified: () => void
 */
export default function PhoneVerification({ phone, open, onOpenChange, onVerified }) {
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const hasSentRef = useRef(false);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-send code when dialog opens
  useEffect(() => {
    if (open && !hasSentRef.current) {
      hasSentRef.current = true;
      sendCode();
    }
    if (!open) {
      // Reset on close
      hasSentRef.current = false;
      setCode("");
      setCodeSent(false);
      setError("");
    }
  }, [open]);

  // Focus input after code sent
  useEffect(() => {
    if (codeSent && open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [codeSent, open]);

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && code.length === 6) handleVerify();
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
                We sent a 6-digit code to <span className="text-[#E3C567] font-medium">{phone}</span>
              </p>

              <Input
                ref={inputRef}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                onKeyDown={handleKeyDown}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                className="h-16 text-center text-3xl tracking-[0.5em] font-mono bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30"
              />

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <Button
                type="button"
                onClick={handleVerify}
                disabled={code.length !== 6 || verifying}
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
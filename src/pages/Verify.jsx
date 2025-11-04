import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, Phone, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Verify() {
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    document.title = "Verify Your Account - AgentVault";
    
    loadProfile();
    // Load EmailJS for OTP
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.async = true;
    script.onload = () => {
      window.emailjs?.init('EMAILJS_PUBLIC_KEY_PLACEHOLDER');
    };
    document.body.appendChild(script);
  }, []);

  const loadProfile = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ created_by: user.email });
      if (profiles.length > 0) {
        setProfile(profiles[0]);
      }
    } catch (error) {
      navigate(createPageUrl("SignIn"));
    }
  };

  const sendEmailOTP = async () => {
    // Demo mode: Accept "000000"
    toast.success("Verification code sent to your email!");
    
    // In production, send via EmailJS:
    // await window.emailjs.send('SERVICE_ID', 'TEMPLATE_OTP', { to_email: user.email, code: '123456' });
  };

  const sendPhoneOTP = async () => {
    toast.success("Verification code sent to your phone!");
  };

  const verifyEmail = async () => {
    if (emailCode === "000000") {
      setVerifying(true);
      await base44.entities.Profile.update(profile.id, {
        verification_email: true
      });
      
      if (window.gtag) {
        window.gtag('event', 'verification_email', {
          method: 'OTP'
        });
      }
      
      toast.success("Email verified!");
      setTimeout(() => navigate(createPageUrl("Dashboard")), 1500);
    } else {
      toast.error("Invalid code. Use 000000 for demo.");
    }
  };

  const verifyPhone = async () => {
    if (phoneCode === "000000") {
      await base44.entities.Profile.update(profile.id, {
        verification_phone: true
      });
      toast.success("Phone verified!");
    } else {
      toast.error("Invalid code. Use 000000 for demo.");
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Verify Your Account</h1>
          <p className="text-slate-600">Secure your account with two-factor verification</p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-slate-200 space-y-8">
          {/* Email Verification */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Mail className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-slate-900">Email Verification</h3>
                  <p className="text-sm text-slate-600">{profile.email || "No email set"}</p>
                </div>
              </div>
              {profile.verification_email && (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            
            {!profile.verification_email ? (
              <div className="space-y-3">
                <Button onClick={sendEmailOTP} variant="outline" className="w-full">
                  Send Verification Code
                </Button>
                <div>
                  <Label htmlFor="email-code">Enter Code</Label>
                  <Input
                    id="email-code"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    placeholder="000000"
                    maxLength="6"
                  />
                </div>
                <Button onClick={verifyEmail} disabled={verifying} className="w-full bg-blue-600 hover:bg-blue-700">
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Verify Email
                </Button>
                <p className="text-xs text-slate-500">Demo: Use code 000000</p>
              </div>
            ) : (
              <p className="text-sm text-emerald-600">✓ Email verified</p>
            )}
          </div>

          {/* Phone Verification */}
          <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Phone className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="font-semibold text-slate-900">Phone Verification (Optional)</h3>
                  <p className="text-sm text-slate-600">{profile.phone || "No phone set"}</p>
                </div>
              </div>
              {profile.verification_phone && (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            
            {!profile.verification_phone ? (
              <div className="space-y-3">
                <Button onClick={sendPhoneOTP} variant="outline" className="w-full">
                  Send SMS Code
                </Button>
                <div>
                  <Label htmlFor="phone-code">Enter Code</Label>
                  <Input
                    id="phone-code"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    placeholder="000000"
                    maxLength="6"
                  />
                </div>
                <Button onClick={verifyPhone} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Verify Phone
                </Button>
                <p className="text-xs text-slate-500">Demo: Use code 000000</p>
              </div>
            ) : (
              <p className="text-sm text-emerald-600">✓ Phone verified</p>
            )}
          </div>

          <div className="pt-6 border-t border-slate-200 text-center">
            <Button onClick={() => navigate(createPageUrl("Dashboard"))} variant="outline">
              Skip for Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/components/useCurrentProfile";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const { refresh } = useCurrentProfile();

  useEffect(() => {
    document.title = "Success - Investor Konnect";
    // Refresh profile to get updated subscription status
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-12 shadow-2xl">
          <div className="w-20 h-20 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-[#10B981]" />
          </div>
          
          <h1 className="text-3xl font-bold text-[#E3C567] mb-4">
            You're All Set!
          </h1>
          
          <p className="text-[#808080] mb-8">
            Your subscription is now active. Welcome to Investor Konnect!
          </p>

          <Button
            onClick={() => {
              console.log('Navigating to IdentityVerification');
              navigate(createPageUrl("IdentityVerification"));
            }}
            className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold rounded-full h-12"
          >
            Continue to Identity Verification
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile, refresh } = useCurrentProfile();
  const [loading, setLoading] = useState(true);

  const sessionId = params.get("session_id");

  useEffect(() => {
    const confirmSubscription = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        // Poll until subscription_status is actually 'active' or 'trialing'
        let attempts = 0;
        let subscriptionConfirmed = false;

        while (attempts < 15 && !subscriptionConfirmed) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (refresh) {
            await refresh();
          }
          
          // Check if subscription is now active
          if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
            subscriptionConfirmed = true;
            break;
          }
          
          attempts++;
        }

        setLoading(false);
      } catch (error) {
        console.error("Failed to confirm subscription:", error);
        setLoading(false);
      }
    };

    confirmSubscription();
  }, [refresh, sessionId, profile?.subscription_status]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-[#E3C567] rounded-full blur-lg opacity-50"></div>
            <div className="relative w-24 h-24 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-[#E3C567]" />
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-[#E3C567] mb-3">
          Welcome!
        </h1>

        <p className="text-lg text-[#FAFAFA] mb-8">
          Your subscription is active
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => navigate(createPageUrl("IdentityVerification"))}
            className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-12 rounded-full flex items-center justify-center gap-2"
          >
            Continue to Verification
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
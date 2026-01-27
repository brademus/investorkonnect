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
      try {
        // Wait a moment for Stripe webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Refresh profile to get updated subscription status
        if (refresh) {
          await refresh();
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Failed to confirm subscription:", error);
        setLoading(false);
      }
    };

    confirmSubscription();
  }, [refresh]);

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

        <p className="text-lg text-[#FAFAFA] mb-2">
          Your subscription is active
        </p>

        <p className="text-sm text-[#808080] mb-8">
          {loading ? "Confirming your subscription..." : "You now have full access to all features. Your 14-day trial has started."}
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => navigate(createPageUrl("Pipeline"))}
            className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold h-12 rounded-full flex items-center justify-center gap-2"
          >
            Go to Pipeline
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
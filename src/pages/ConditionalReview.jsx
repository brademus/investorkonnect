import React from "react";
import { Clock, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";

export default function ConditionalReview() {
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 bg-[#F59E0B]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-[#F59E0B]" />
        </div>

        <h1 className="text-3xl font-bold text-[#FAFAFA] mb-3">
          We're Reviewing Your Profile
        </h1>

        <p className="text-[#808080] text-base leading-relaxed mb-6">
          Thank you for completing the vetting questionnaire. The Investor Konnect team is currently reviewing your application.
        </p>

        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 justify-center mb-3">
            <Mail className="w-5 h-5 text-[#E3C567]" />
            <span className="text-sm font-medium text-[#FAFAFA]">What happens next?</span>
          </div>
          <p className="text-sm text-[#808080] leading-relaxed">
            Please check back in a little while or watch for an email from us. 
            We'll notify you once a decision has been made about your account.
          </p>
        </div>

        <Button
          onClick={() => base44.auth.logout(createPageUrl("Home"))}
          variant="outline"
          className="bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border-[#1F1F1F] hover:border-[#E3C567] rounded-full px-8"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import AgentParticipationAgreement from "@/components/AgentParticipationAgreement";

/**
 * NDA acceptance step for team member onboarding
 */
export default function TeamNDAStep({ agreed, onAgreedChange, isAgent }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-7 h-7 text-[#E3C567]" />
        <h3 className="text-[28px] font-bold text-[#E3C567]">Platform Agreement</h3>
      </div>
      <p className="text-[#808080] mb-6">Please read and accept the participation agreement to continue.</p>

      <div className="bg-[#141414] rounded-xl p-5 max-h-52 overflow-y-auto border border-[#1F1F1F] mb-5 text-sm text-[#FAFAFA]">
        {isAgent ? (
          <AgentParticipationAgreement />
        ) : (
          <div className="prose prose-sm space-y-3">
            <p>This Investor Platform Participation Agreement governs your use of Investor Konnect. By accepting, you agree to non-circumvention, confidentiality, platform use requirements, ethical conduct standards, and all other terms outlined in the full agreement.</p>
            <p>Full agreement available at <a href="mailto:legal@investorkonnect.com" className="text-[#E3C567]">legal@investorkonnect.com</a>.</p>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 p-3 bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl">
        <Checkbox
          id="team-nda-agree"
          checked={agreed}
          onCheckedChange={onAgreedChange}
          className="mt-0.5"
        />
        <Label htmlFor="team-nda-agree" className="text-sm text-[#FAFAFA] cursor-pointer leading-relaxed">
          {isAgent
            ? "I have read and agree to the Agent Platform Participation Agreement."
            : "I have read and agree to the Investor Platform Participation Agreement."}
        </Label>
      </div>
    </div>
  );
}
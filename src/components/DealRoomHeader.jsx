import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, CheckCircle, Clock, Share2, MoreVertical, 
  FileText, Shield, DollarSign
} from "lucide-react";

const STAGE_LABELS = {
  new_contract: "New Contract",
  walkthrough_scheduled: "Walkthrough Scheduled",
  evaluate_deal: "Evaluate Deal",
  marketing: "Marketing",
  under_contract: "Under Contract",
  closing: "Closing",
  closed: "Closed"
};

const STAGE_COLORS = {
  new_contract: "bg-blue-100 text-blue-800 border-blue-200",
  walkthrough_scheduled: "bg-purple-100 text-purple-800 border-purple-200",
  evaluate_deal: "bg-yellow-100 text-yellow-800 border-yellow-200",
  marketing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  under_contract: "bg-orange-100 text-orange-800 border-orange-200",
  closing: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-gray-100 text-gray-800 border-gray-200"
};

const CONTRACT_STATUS = {
  not_sent: { label: "Not Sent", color: "bg-gray-100 text-gray-700", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700", icon: FileText },
  partially_signed: { label: "Partially Signed", color: "bg-yellow-100 text-yellow-700", icon: FileText },
  fully_signed: { label: "Fully Signed", color: "bg-green-100 text-green-700", icon: CheckCircle }
};

const ESCROW_STATUS = {
  none: { label: "Not Created", color: "bg-gray-100 text-gray-700" },
  created: { label: "Created", color: "bg-blue-100 text-blue-700" },
  funded: { label: "Funded", color: "bg-green-100 text-green-700" },
  inspection: { label: "In Inspection", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Released", color: "bg-green-100 text-green-700" },
  disputed: { label: "Disputed", color: "bg-red-100 text-red-700" }
};

function getPrimaryCTA(deal, room, role) {
  // Logic for determining the primary CTA based on state
  if (!room?.ndaAcceptedInvestor || !room?.ndaAcceptedAgent) {
    return { label: "Send NDA", action: "send_nda" };
  }
  
  if (deal?.contract_status === "not_sent") {
    return { label: "Send Contract for Signature", action: "send_contract" };
  }
  
  if (room?.escrow_status === "none" && deal?.contract_status === "fully_signed") {
    return { label: "Create Escrow", action: "create_escrow" };
  }
  
  if (room?.escrow_status === "created") {
    return { label: "Send Escrow Funding Link", action: "fund_escrow" };
  }
  
  if (deal?.pipeline_stage === "closing" && room?.escrow_status === "funded") {
    return { label: "Mark as Closed", action: "mark_closed" };
  }
  
  return { label: "View Next Steps", action: "view_steps" };
}

function getBlockers(deal, room) {
  const blockers = [];
  
  if (!room?.ndaAcceptedInvestor || !room?.ndaAcceptedAgent) {
    blockers.push("NDA not signed");
  }
  
  if (!deal?.documents_complete) {
    blockers.push("Documents missing");
  }
  
  if (blockers.length === 0) {
    return { type: "success", text: "All prerequisites complete" };
  }
  
  return { type: "warning", text: blockers.join(" • ") };
}

export default function DealRoomHeader({ deal, room, role, onAction }) {
  const stage = deal?.pipeline_stage || "new_contract";
  const contractStatus = deal?.contract_status || "not_sent";
  const escrowStatus = room?.escrow_status || "none";
  
  const cta = getPrimaryCTA(deal, room, role);
  const blockers = getBlockers(deal, room);
  
  const ContractIcon = CONTRACT_STATUS[contractStatus]?.icon || Clock;

  return (
    <div className="sticky top-0 z-30 bg-[#0F0F0F] border-b border-[#333333] shadow-xl">
      <div className="px-6 py-4">
        {/* Top Row: Title & Stage */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-light text-[#FAFAFA] mb-1 tracking-wide">
              {/* Security: Hide address from agents until agreement signed */}
              {role === 'agent' && deal?._is_redacted
                ? `${deal?.city || 'City'}, ${deal?.state || 'State'}`
                : (deal?.property_address || deal?.title || "Deal Room")
              }
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#A6A6A6]">
                {deal?.id?.slice(0, 8) || "Deal"}
              </span>
              <Badge className={`${STAGE_COLORS[stage]} border font-medium`}>
                {STAGE_LABELS[stage]}
              </Badge>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#333333] bg-transparent text-[#A6A6A6] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]"
              onClick={() => onAction?.("view_timeline")}
            >
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-[#333333] bg-transparent text-[#A6A6A6] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]"
              onClick={() => onAction?.("share")}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-[#333333] bg-transparent text-[#A6A6A6] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]"
              onClick={() => onAction?.("more")}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Bottom Row: Status Chips, Blockers & Primary CTA */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Status Chips & Blockers */}
          <div className="flex items-center gap-4 flex-1">
            {/* Contract Status */}
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#A6A6A6]" />
              <Badge className={`${CONTRACT_STATUS[contractStatus]?.color} border font-medium flex items-center gap-1.5`}>
                <ContractIcon className="w-3 h-3" />
                {CONTRACT_STATUS[contractStatus]?.label}
              </Badge>
            </div>

            {/* Escrow Status */}
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#A6A6A6]" />
              <Badge className={`${ESCROW_STATUS[escrowStatus]?.color} border font-medium flex items-center gap-1.5`}>
                <DollarSign className="w-3 h-3" />
                {ESCROW_STATUS[escrowStatus]?.label}
              </Badge>
            </div>

            {/* Blockers */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              blockers.type === "success" 
                ? "border-green-800/30 bg-green-950/30 text-green-400" 
                : "border-yellow-800/30 bg-yellow-950/30 text-yellow-400"
            }`}>
              {blockers.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">{blockers.text}</span>
            </div>
          </div>

          {/* Right: Primary CTA */}
          <Button
            className="bg-gradient-to-r from-[#E5C37F] to-[#C9A961] hover:from-[#F0D699] hover:to-[#D4AF37] text-[#0F0F0F] px-6 py-5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            onClick={() => onAction?.(cta.action)}
          >
            {cta.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
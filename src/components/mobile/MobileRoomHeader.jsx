import React from "react";
import { ChevronLeft, User, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";

export default function MobileRoomHeader({ currentRoom, counterpartName, isSigned, isAgent, onBack, onOpenRoomsDrawer }) {
  const navigate = useNavigate();

  const handleProfileTap = () => {
    if (isAgent && currentRoom?.investorId) {
      navigate(`${createPageUrl("InvestorProfile")}?profileId=${currentRoom.investorId}`);
    } else if (!isAgent) {
      const agentId = currentRoom?.locked_agent_id || currentRoom?.agent_ids?.[0];
      if (agentId) navigate(`${createPageUrl("AgentProfile")}?profileId=${agentId}`);
    }
  };

  return (
    <div className="h-12 flex items-center px-2 bg-[#0D0D0D] border-b border-[#1F1F1F] flex-shrink-0">
      {/* Back to Pipeline */}
      <button onClick={onBack} aria-label="Back to Pipeline" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#1F1F1F]">
        <ChevronLeft className="w-5 h-5 text-[#FAFAFA]" />
      </button>

      {/* Avatar + name */}
      <button onClick={handleProfileTap} className="flex items-center gap-2 flex-1 min-w-0 px-1">
        <div className="w-7 h-7 rounded-full overflow-hidden bg-[#E3C567]/20 flex items-center justify-center flex-shrink-0">
          {currentRoom?.counterparty_headshot && isSigned ? (
            <img src={currentRoom.counterparty_headshot} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-3.5 h-3.5 text-[#E3C567]" />
          )}
        </div>
        <span className="text-[13px] font-semibold text-[#FAFAFA] truncate">
          {isSigned || isAgent ? counterpartName : "Agent"}
        </span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSigned ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
      </button>

      {/* Hamburger — opens Rooms drawer */}
      <button onClick={onOpenRoomsDrawer} aria-label="Switch deal" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#1F1F1F]">
        <Menu className="w-5 h-5 text-[#FAFAFA]" />
      </button>
    </div>
  );
}
import React from "react";
import { ChevronLeft, User, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";

export default function MobileRoomHeader({ currentRoom, counterpartName, isSigned, isAgent, onBack, onOpenRoomsDrawer }) {
  const navigate = useNavigate();

  const handleProfileTap = (e) => {
    e.stopPropagation();
    if (isAgent && currentRoom?.investorId) {
      navigate(`${createPageUrl("InvestorProfile")}?profileId=${currentRoom.investorId}`);
    } else if (!isAgent) {
      const agentId = currentRoom?.locked_agent_id || currentRoom?.agent_ids?.[0];
      if (agentId) navigate(`${createPageUrl("AgentProfile")}?profileId=${agentId}`);
    }
  };

  return (
    <div className="h-14 flex items-center px-1 bg-[#0D0D0D] border-b border-[#1F1F1F] flex-shrink-0">
      {/* Back to Pipeline — larger, isolated touch target */}
      <button
        onClick={(e) => { e.stopPropagation(); onBack(); }}
        aria-label="Back to Pipeline"
        className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-[#1F1F1F] active:bg-[#2A2A2A] flex-shrink-0"
      >
        <ChevronLeft className="w-6 h-6 text-[#FAFAFA]" />
      </button>

      {/* Avatar + name — only the chip itself opens profile */}
      <div className="flex-1 min-w-0 flex items-center px-1">
        <button
          onClick={handleProfileTap}
          className="inline-flex items-center gap-2 min-w-0 max-w-full py-1.5 pl-1.5 pr-3 rounded-full hover:bg-[#1F1F1F] active:bg-[#2A2A2A]"
        >
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
      </div>

      {/* Hamburger — opens Rooms drawer */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenRoomsDrawer(); }}
        aria-label="Switch deal"
        className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-[#1F1F1F] active:bg-[#2A2A2A] flex-shrink-0"
      >
        <Menu className="w-5 h-5 text-[#FAFAFA]" />
      </button>
    </div>
  );
}
import React from "react";
import { Input } from "@/components/ui/input";
import { Search, User } from "lucide-react";
import { Logo } from "@/components/Logo";
import { createPageUrl } from "@/components/utils";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { getSellerCompLabel } from "@/components/utils/dealCompDisplay";

export default function RoomSidebar({ rooms, activeRoomId, userRole, onRoomClick, search, onSearchChange }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-[#1F1F1F]">
        <div className="flex items-center gap-3 mb-5">
          <Logo size="default" showText={false} linkTo={createPageUrl("Pipeline")} />
          <h2 className="text-xl font-bold text-[#E3C567]">Messages</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
          <Input placeholder="Search..." value={search} onChange={e => onSearchChange(e.target.value)} className="h-11 pl-11 rounded-full bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] focus:border-[#E3C567]" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {rooms.filter(r => {
          if (!search) return true;
          const q = search.toLowerCase();
          return (r.counterparty_name || r.title || r.city || '').toLowerCase().includes(q);
        }).map(room => {
          const isActive = room.id === activeRoomId;
          const canSeeAddress = userRole === 'investor' || room.is_fully_signed;
          const compLabel = getSellerCompLabel(room.agreement?.exhibit_a_terms, room.proposed_terms);
          const badge = getAgreementStatusLabel({ room, agreement: room.agreement, role: userRole });

          return (
            <button key={room.id} onClick={() => onRoomClick(room)} className={`w-full text-left px-5 py-4 border-b border-[#1F1F1F] flex items-center gap-4 transition-all ${isActive ? "bg-[#E3C567]/20 border-l-4 border-l-[#E3C567]" : "hover:bg-[#141414] border-l-4 border-l-transparent"}`}>
              <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-[#E3C567]/20 flex items-center justify-center">
                {room.counterparty_headshot ? (
                  <img src={room.counterparty_headshot} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-[#E3C567]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[15px] font-semibold text-[#FAFAFA] truncate">
                    {userRole === 'agent' && room.budget > 0 ? `$${room.budget.toLocaleString()} • ${[room.city, room.state].filter(Boolean).join(', ')}` : room.is_fully_signed ? (room.counterparty_name || 'Room') : userRole === 'investor' ? 'Agent' : 'Investor'}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {badge && <span className={`text-[10px] border px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>}
                  </div>
                </div>
                {(room.city || room.property_address) && (
                  <p className="text-sm text-[#E3C567] truncate font-medium">
                    {canSeeAddress ? (room.property_address || room.title) : [room.city, room.state].filter(Boolean).join(', ')}
                  </p>
                )}
                {room.budget > 0 && <div className="text-xs text-[#34D399] font-semibold">${room.budget.toLocaleString()}</div>}
                {compLabel && <div className="text-xs text-[#E3C567]">Comp: {compLabel}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
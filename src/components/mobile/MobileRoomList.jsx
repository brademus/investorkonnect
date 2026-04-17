import React from "react";
import { User, Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function MobileRoomList({ rooms, userRole, search, onSearchChange, onRoomClick }) {
  const isAgent = userRole === "agent";

  const filtered = (rooms || []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.title || "").toLowerCase().includes(q) ||
      (r.property_address || "").toLowerCase().includes(q) ||
      (r.counterparty_name || "").toLowerCase().includes(q) ||
      (r.city || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1F1F1F]">
        <h1 className="text-xl font-bold text-[#E3C567] mb-3" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Messages
        </h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search deals..."
            className="pl-10 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] rounded-full h-10"
          />
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <MessageSquare className="w-10 h-10 text-[rgba(255,255,255,0.15)] mb-3" />
            <p className="text-sm text-[rgba(255,255,255,0.35)]">
              {search.trim() ? "No matching deals" : "No deals in progress yet. Create one from the Pipeline."}
            </p>
          </div>
        ) : (
          filtered.map((r) => {
            const isSigned = r.is_fully_signed || r.agreement_status === "fully_signed" || r.request_status === "locked";
            const price = isAgent
              ? r.estimated_list_price > 0 ? `$${r.estimated_list_price.toLocaleString()}` : null
              : r.budget > 0 ? `$${r.budget.toLocaleString()}` : null;

            return (
              <button
                key={r.id}
                onClick={() => onRoomClick(r)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#1F1F1F] hover:bg-[#141414] transition-colors text-left"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-[#E3C567]/20 flex items-center justify-center flex-shrink-0">
                  {r.counterparty_headshot && isSigned ? (
                    <img src={r.counterparty_headshot} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-[#E3C567]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#FAFAFA] truncate">
                      {isSigned ? (r.counterparty_name || "Deal") : (isAgent ? `${r.city || "City"}, ${r.state || "ST"}` : (r.property_address || r.title || "Deal"))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {price && <span className="text-xs text-[#2D8A6E] font-medium">{price}</span>}
                    <span className="text-xs text-[#808080]">{[r.city, r.state].filter(Boolean).join(", ")}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex flex-col items-end gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${isSigned ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
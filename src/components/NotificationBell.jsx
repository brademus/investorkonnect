import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";
import { toast } from "sonner";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [roomIds, setRoomIds] = useState([]);

  useEffect(() => {
    base44.functions.invoke("getUnreadMessageCount", {})
      .then(res => {
        const data = res.data || {};
        setCount(data.count || 0);
        setRoomIds(data.roomIds || []);
      })
      .catch(() => {});
  }, []);

  const handleClick = () => {
    if (count > 0 && roomIds.length > 0) {
      navigate(`${createPageUrl("Room")}?roomId=${roomIds[0]}`);
    } else {
      toast("No new messages", { duration: 2000 });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-2 rounded-full border border-[#1F1F1F] bg-[#1A1A1A] hover:bg-[#222] hover:border-[#E3C567] transition-all"
      aria-label={`${count} unread messages`}
    >
      <Bell className={`w-5 h-5 ${count > 0 ? "text-[#E3C567]" : "text-[#808080]"}`} />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
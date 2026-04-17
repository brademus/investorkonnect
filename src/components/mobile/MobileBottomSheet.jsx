import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function MobileBottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full bg-[#0D0D0D] border-t border-[#1F1F1F] rounded-t-2xl pb-safe max-h-[70vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F1F] sticky top-0 bg-[#0D0D0D] z-10">
          <h3 className="text-base font-semibold text-[#FAFAFA]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1F1F1F]">
            <X className="w-4 h-4 text-[#808080]" />
          </button>
        </div>
        <div className="px-5 py-3">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </div>
  );
}
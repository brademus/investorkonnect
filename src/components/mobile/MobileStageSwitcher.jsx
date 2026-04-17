import React, { useRef, useEffect } from "react";

export default function MobileStageSwitcher({ stages, activeStageId, dealsByStage, onStageSelect }) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }, [activeStageId]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 scrollbar-none snap-x"
      style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
    >
      {stages.map((stage) => {
        const count = (dealsByStage.get(stage.id) || []).length;
        const isActive = stage.id === activeStageId;
        return (
          <button
            key={stage.id}
            ref={isActive ? activeRef : null}
            onClick={() => onStageSelect(stage.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap snap-start transition-colors flex-shrink-0 ${
              isActive
                ? "bg-[#E3C567] text-black"
                : "bg-[#1F1F1F] text-[#808080]"
            }`}
          >
            {stage.label}
            <span
              className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold px-1 ${
                isActive ? "bg-black/20 text-black" : "bg-[#333] text-[#808080]"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
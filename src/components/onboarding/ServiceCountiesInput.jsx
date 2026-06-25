import React, { useState } from "react";
import { Loader2, CheckCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCountyCentroid } from "@/components/utils/agentScoring";

/**
 * Validated multi-county input for an agent's additional service areas.
 * Each county is checked against the agent's licensed states before it is
 * added. Counties that don't resolve in any licensed state are rejected,
 * so the saved list always works for distance/county matching.
 *
 * value: array of { name, state } objects
 * states: array of licensed state codes (e.g. ["TX", "FL"])
 */
export default function ServiceCountiesInput({ value = [], onChange, states = [] }) {
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const addCounty = async () => {
    const raw = text.trim().replace(/,$/, "");
    if (!raw) return;
    if (states.length === 0) {
      setError("Select your licensed states first.");
      return;
    }
    const clean = raw.replace(/\s+county$/i, "").trim();
    if (value.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      setError("Already added.");
      return;
    }
    setChecking(true);
    setError("");
    // Find the first licensed state where this county exists
    let matchedState = null;
    for (const st of states) {
      const coords = await getCountyCentroid(clean, st);
      if (coords) { matchedState = st; break; }
    }
    setChecking(false);
    if (!matchedState) {
      setError(`"${clean}" not found in ${states.join(", ")}. Enter the county name only.`);
      return;
    }
    onChange([...value, { name: clean, state: matchedState }]);
    setText("");
  };

  const removeCounty = (name) => {
    onChange(value.filter((c) => c.name !== name));
  };

  return (
    <div>
      <label className="text-[#FAFAFA] text-[14px] md:text-[19px] font-bold block">Additional Service Areas</label>
      <p className="text-xs md:text-sm text-[#808080] mt-0.5 mb-2 md:mb-3">
        Other counties you actively work in — boosts your matching for deals there. Optional.
      </p>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => { setText(e.target.value); setError(""); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCounty(); }
          }}
          placeholder="e.g., Harris, Dallas, Bexar"
          className="flex-1 h-11 md:h-14 text-[14px] md:text-[17px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30"
        />
        <button
          type="button"
          onClick={addCounty}
          disabled={checking}
          className="px-4 rounded-lg bg-[#E3C567] text-black font-semibold text-sm hover:bg-[#EDD89F] transition-colors disabled:opacity-60 flex items-center gap-1.5"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
        </button>
      </div>
      <div className="mt-1.5 min-h-[18px]">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!error && !checking && (
          <p className="text-xs text-[#808080]">County name only (e.g., "Harris" not "Harris County").</p>
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((c) => (
            <span key={c.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[#E3C567]/10 text-[#E3C567] border border-[#E3C567]/30">
              <CheckCircle className="w-3.5 h-3.5" /> {c.name}, {c.state}
              <button
                type="button"
                onClick={() => removeCounty(c.name)}
                className="ml-0.5 text-[#E3C567]/60 hover:text-[#E3C567] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useState, useRef, useEffect } from "react";

/**
 * Strict walkthrough time input.
 * Forces format: HH:MMAM or HH:MMPM (no space, e.g. "02:30PM")
 * 
 * Flow:
 * 1. User types 2-digit hour (01-12)
 * 2. Colon auto-inserted
 * 3. User types 2-digit minutes (00-59)
 * 4. AM/PM auto-prompted — user types A or P to complete
 * 
 * Value emitted is always in format "HH:MMAM" or "HH:MMPM" (no space).
 */
export default function WalkthroughTimeInput({ value, onChange, className = "" }) {
  const inputRef = useRef(null);
  
  // Display value is what the user sees in the input
  const [displayValue, setDisplayValue] = useState(value || "");

  // Sync external value changes (e.g. hydration from saved data)
  useEffect(() => {
    if (value && value !== displayValue) {
      // Normalize incoming value to our strict format
      const normalized = normalizeExternalValue(value);
      if (normalized) {
        setDisplayValue(normalized);
      } else {
        setDisplayValue(value);
      }
    }
  }, [value]);

  // Normalize values from outside (e.g. "02:30 PM" -> "02:30PM", "2:30PM" -> "02:30PM")
  const normalizeExternalValue = (val) => {
    if (!val) return "";
    const s = val.trim().replace(/\s+/g, "");
    // Already in our format?
    const match = s.match(/^(\d{1,2}):(\d{2})(AM|PM|am|pm)$/i);
    if (match) {
      const h = match[1].padStart(2, "0");
      const m = match[2];
      const p = match[3].toUpperCase();
      return `${h}:${m}${p}`;
    }
    // With space: "02:30 PM"
    const spaceMatch = val.trim().match(/^(\d{1,2}):(\d{2})\s+(AM|PM|am|pm)$/i);
    if (spaceMatch) {
      const h = spaceMatch[1].padStart(2, "0");
      const m = spaceMatch[2];
      const p = spaceMatch[3].toUpperCase();
      return `${h}:${m}${p}`;
    }
    return null;
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    const formatted = buildFormattedTime(raw);
    setDisplayValue(formatted);

    // Only emit to parent when we have a complete valid time
    if (isComplete(formatted)) {
      onChange(formatted);
    } else {
      // Emit partial so parent knows it's incomplete
      onChange(formatted);
    }
  };

  const buildFormattedTime = (raw) => {
    // Strip everything except digits, A, P, M (case insensitive)
    let chars = raw.toUpperCase().replace(/[^0-9APM]/g, "");

    let result = "";
    let pos = 0;

    // --- HOUR (2 digits) ---
    // First hour digit: must be 0 or 1
    if (pos < chars.length) {
      const d1 = chars[pos];
      if (d1 >= "0" && d1 <= "1") {
        result += d1;
        pos++;
      } else {
        // Invalid first digit — stop
        return result;
      }
    } else return result;

    // Second hour digit
    if (pos < chars.length) {
      const d2 = chars[pos];
      const h1 = result[0];
      // If first digit is 1, second must be 0-2
      if (h1 === "1") {
        if (d2 >= "0" && d2 <= "2") {
          result += d2;
          pos++;
        } else {
          return result;
        }
      } else {
        // First digit is 0, second must be 1-9
        if (d2 >= "1" && d2 <= "9") {
          result += d2;
          pos++;
        } else {
          return result;
        }
      }
    } else return result;

    // --- AUTO COLON ---
    result += ":";

    // --- MINUTES (2 digits) ---
    if (pos < chars.length) {
      const m1 = chars[pos];
      if (m1 >= "0" && m1 <= "5") {
        result += m1;
        pos++;
      } else {
        return result;
      }
    } else return result;

    if (pos < chars.length) {
      const m2 = chars[pos];
      if (m2 >= "0" && m2 <= "9") {
        result += m2;
        pos++;
      } else {
        return result;
      }
    } else return result;

    // --- AM/PM ---
    if (pos < chars.length) {
      const c = chars[pos];
      if (c === "A") {
        result += "AM";
        pos++;
        // Skip the M if user typed it
        if (pos < chars.length && chars[pos] === "M") pos++;
      } else if (c === "P") {
        result += "PM";
        pos++;
        if (pos < chars.length && chars[pos] === "M") pos++;
      } else if (c === "M") {
        // They typed M without A or P — ignore
      }
    }

    return result;
  };

  const isComplete = (val) => {
    return /^\d{2}:\d{2}(AM|PM)$/.test(val);
  };

  // Determine helper text
  const getHelperText = () => {
    const v = displayValue;
    if (!v) return "Type hour (01-12)";
    if (v.length === 1) return "Type second hour digit";
    if (v.length === 3) return "Type minutes (00-59)";
    if (v.length === 4) return "Type second minute digit";
    if (v.length === 5) return "Type A or P for AM/PM";
    if (isComplete(v)) return "";
    return "";
  };

  const helper = getHelperText();

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder="HH:MMAM/PM"
        maxLength={7}
        className={`flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      />
      {helper && (
        <p className="text-xs text-[#808080] mt-1">{helper}</p>
      )}
    </div>
  );
}
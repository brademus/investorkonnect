import React, { useRef, useEffect } from "react";

const CODE_LENGTH = 4;

/**
 * 4-box OTP input with auto-advance and paste support.
 * Props: value (string), onChange (string => void), autoFocus (bool)
 */
export default function OtpBoxes({ value = "", onChange, autoFocus = false }) {
  const digits = value.split("").slice(0, CODE_LENGTH);
  while (digits.length < CODE_LENGTH) digits.push("");
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setDigit = (index, char) => {
    const next = [...digits];
    next[index] = char;
    const joined = next.join("");
    onChange(joined);
    if (char && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = "";
        onChange(next.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleInput = (index, e) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    if (char) setDigit(index, char);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
      refs.current[focusIdx]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleInput(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          className="w-16 h-20 text-center text-3xl font-mono rounded-xl bg-[#141414] border border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 outline-none transition-all"
        />
      ))}
    </div>
  );
}
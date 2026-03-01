import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Shared phone input with auto-formatting.
 */
export default function PhoneInput({ value, onChange }) {
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    let formatted = '';
    if (digits.length === 0) formatted = '';
    else if (digits.length <= 3) formatted = '(' + digits;
    else if (digits.length <= 6) formatted = '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
    else formatted = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
    onChange(formatted);
  };

  return (
    <div>
      <Label htmlFor="phone" className="text-[#FAFAFA] text-[19px] font-medium">Phone Number *</Label>
      <Input
        id="phone"
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder="(555) 123-4567"
        className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30"
      />
    </div>
  );
}
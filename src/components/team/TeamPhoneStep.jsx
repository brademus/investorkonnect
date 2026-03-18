import React from "react";
import PhoneInput from "@/components/onboarding/PhoneInput";

/**
 * Step 2a of team member onboarding: collect phone number
 */
export default function TeamPhoneStep({ phone, onChange }) {
  return (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Verify Your Phone</h3>
      <p className="text-[#808080] mb-8">Enter your phone number. We'll send a verification code.</p>
      <PhoneInput value={phone} onChange={onChange} />
    </div>
  );
}
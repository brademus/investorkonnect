import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Hash } from "lucide-react";

/**
 * Step 1 of team member onboarding: collect name and license number
 */
export default function TeamMemberInfoStep({ data, onChange, isAgent = true }) {
  return (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Welcome to the Team</h3>
      <p className="text-[#808080] mb-8">Please provide your basic information to get started.</p>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[#FAFAFA] text-sm mb-2 block">First Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
              <Input
                value={data.firstName || ""}
                onChange={(e) => onChange({ ...data, firstName: e.target.value })}
                placeholder="First name"
                className="pl-10 h-12 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
              />
            </div>
          </div>
          <div>
            <Label className="text-[#FAFAFA] text-sm mb-2 block">Last Name</Label>
            <Input
              value={data.lastName || ""}
              onChange={(e) => onChange({ ...data, lastName: e.target.value })}
              placeholder="Last name"
              className="h-12 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
            />
          </div>
        </div>

        {isAgent && (
          <div>
            <Label className="text-[#FAFAFA] text-sm mb-2 block">Agent License Number</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
              <Input
                value={data.licenseNumber || ""}
                onChange={(e) => onChange({ ...data, licenseNumber: e.target.value })}
                placeholder="e.g. 12345678"
                className="pl-10 h-12 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567]"
              />
            </div>
            <p className="text-xs text-[#808080] mt-1">Your real estate agent license number</p>
          </div>
        )}
      </div>
    </div>
  );
}
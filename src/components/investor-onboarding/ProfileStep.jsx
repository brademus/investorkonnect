import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProfileStep({ data, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Let's start with your profile</h2>
        <p className="text-slate-600">Help us understand your investment setup</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            value={data.full_name || ''}
            onChange={(e) => onChange({ full_name: e.target.value })}
            placeholder="John Smith"
            className="text-lg py-6"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            value={data.phone || ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
            className="text-lg py-6"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company / Entity Name</Label>
          <Input
            id="company"
            value={data.company || ''}
            onChange={(e) => onChange({ company: e.target.value })}
            placeholder="Smith Investment Group LLC"
            className="text-lg py-6"
          />
          <p className="text-sm text-slate-500">Optional - leave blank if investing as individual</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="investor_type">Investor Type *</Label>
          <Select
            value={data.investor_type || ''}
            onValueChange={(value) => onChange({ investor_type: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select investor type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
              <SelectItem value="llc">LLC</SelectItem>
              <SelectItem value="fund">Fund</SelectItem>
              <SelectItem value="family_office">Family Office</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="experience_level">Experience Level *</Label>
          <Select
            value={data.experience_level || ''}
            onValueChange={(value) => onChange({ experience_level: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select experience level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New (0–1 deals)</SelectItem>
              <SelectItem value="intermediate">Intermediate (2–10 deals)</SelectItem>
              <SelectItem value="experienced">Experienced (10+ deals)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="typical_hold_period">Typical Hold Period *</Label>
          <Select
            value={data.typical_hold_period || ''}
            onValueChange={(value) => onChange({ typical_hold_period: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="How long do you hold properties?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_1y">Less than 1 year</SelectItem>
              <SelectItem value="1_3y">1–3 years</SelectItem>
              <SelectItem value="3_7y">3–7 years</SelectItem>
              <SelectItem value="over_7y">7+ years</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="decision_speed">Decision Speed *</Label>
          <Select
            value={data.decision_speed || ''}
            onValueChange={(value) => onChange({ decision_speed: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="How fast can you make decisions?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="same_day">Same day</SelectItem>
              <SelectItem value="3_days">Within 3 days</SelectItem>
              <SelectItem value="1_2_weeks">Within 1–2 weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
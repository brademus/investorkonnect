import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LEAD_TYPES = [
  { id: 'on_market', label: 'On-market listings' },
  { id: 'off_market', label: 'Off-market / Pocket listings' },
  { id: 'wholesale', label: 'Wholesale assignments' },
  { id: 'new_construction', label: 'New construction' },
  { id: 'reo', label: 'REO / Auction' },
];

const SERVICE_EXPECTATIONS = [
  { id: 'help_evaluate', label: 'Help evaluate deals (numbers)' },
  { id: 'negotiate', label: 'Negotiate aggressively' },
  { id: 'coordinate_rehab', label: 'Help coordinate rehab team' },
  { id: 'pm_referrals', label: 'Property management referrals' },
];

export default function AgentPreferencesStep({ data, onChange }) {
  const toggleLeadType = (id) => {
    const current = data.lead_types_desired || [];
    const updated = current.includes(id)
      ? current.filter(l => l !== id)
      : [...current, id];
    onChange({ lead_types_desired: updated });
  };

  const toggleServiceExpectation = (id) => {
    const current = data.service_expectations || [];
    const updated = current.includes(id)
      ? current.filter(s => s !== id)
      : [...current, id];
    onChange({ service_expectations: updated });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Agent relationship preferences</h2>
        <p className="text-slate-600">Help us match you with the right agents</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="communication">Communication Style *</Label>
          <Select
            value={data.communication_style || ''}
            onValueChange={(value) => onChange({ communication_style: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="How do you prefer to communicate?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text first</SelectItem>
              <SelectItem value="email">Email first</SelectItem>
              <SelectItem value="phone">Phone calls ok</SelectItem>
              <SelectItem value="weekly_recap">Weekly recap preferred</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Lead Types Desired (select all that apply) *</Label>
          <div className="grid grid-cols-1 gap-3">
            {LEAD_TYPES.map(type => (
              <div key={type.id} className="flex items-center gap-3">
                <Checkbox
                  id={`lead-${type.id}`}
                  checked={(data.lead_types_desired || []).includes(type.id)}
                  onCheckedChange={() => toggleLeadType(type.id)}
                />
                <Label htmlFor={`lead-${type.id}`} className="cursor-pointer font-normal">
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Service Expectations (select all that apply) *</Label>
          <div className="grid grid-cols-1 gap-3">
            {SERVICE_EXPECTATIONS.map(service => (
              <div key={service.id} className="flex items-center gap-3">
                <Checkbox
                  id={`service-${service.id}`}
                  checked={(data.service_expectations || []).includes(service.id)}
                  onCheckedChange={() => toggleServiceExpectation(service.id)}
                />
                <Label htmlFor={`service-${service.id}`} className="cursor-pointer font-normal">
                  {service.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="exclusivity">Exclusivity Preference *</Label>
          <Select
            value={data.exclusivity_preference || ''}
            onValueChange={(value) => onChange({ exclusivity_preference: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="How do you prefer to work with agents?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one_per_market">Happy to work with 1 primary agent per market</SelectItem>
              <SelectItem value="multiple">Open to multiple agents at once</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4 mt-6">
          <h4 className="font-semibold text-emerald-900 mb-2">Almost done! 🎉</h4>
          <p className="text-sm text-emerald-800">
            After completing this step, you'll verify your identity and sign an NDA before accessing our verified agent network.
          </p>
        </div>
      </div>
    </div>
  );
}
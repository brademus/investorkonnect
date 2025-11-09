import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEAL_TYPES = [
  { id: 'on_market', label: 'On-market MLS listings' },
  { id: 'off_market', label: 'Off-market / pocket listings' },
  { id: 'pre_foreclosure', label: 'Pre-foreclosures / distressed' },
  { id: 'tenant_occupied', label: 'Tenant-occupied properties' },
  { id: 'new_construction', label: 'New construction' },
];

const STRUCTURES = [
  { id: 'own_100', label: 'I buy 100% and own the asset' },
  { id: 'equity_jv', label: 'Equity partnerships / joint ventures' },
  { id: 'debt_funding', label: 'Debt funding (I'm the lender)' },
  { id: 'creative', label: 'Creative finance (sub-to, seller finance, etc.)' },
];

export default function DealStructureStep({ data, onChange }) {
  const toggleDealType = (id) => {
    const current = data.deal_types_open_to || [];
    const updated = current.includes(id)
      ? current.filter(d => d !== id)
      : [...current, id];
    onChange({ deal_types_open_to: updated });
  };

  const toggleStructure = (id) => {
    const current = data.preferred_deal_structure || [];
    const updated = current.includes(id)
      ? current.filter(s => s !== id)
      : [...current, id];
    onChange({ preferred_deal_structure: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Deal structure & preferences</h2>
        <p className="text-slate-600">How you want to structure deals</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <Label className="text-base font-semibold">What types of deals are you open to? (select all that apply) *</Label>
          <div className="grid grid-cols-1 gap-3">
            {DEAL_TYPES.map(type => (
              <div key={type.id} className="flex items-center gap-3">
                <Checkbox
                  id={`deal-${type.id}`}
                  checked={(data.deal_types_open_to || []).includes(type.id)}
                  onCheckedChange={() => toggleDealType(type.id)}
                />
                <Label htmlFor={`deal-${type.id}`} className="cursor-pointer font-normal">
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Preferred deal structure (select all that apply) *</Label>
          <div className="grid grid-cols-1 gap-3">
            {STRUCTURES.map(structure => (
              <div key={structure.id} className="flex items-center gap-3">
                <Checkbox
                  id={`structure-${structure.id}`}
                  checked={(data.preferred_deal_structure || []).includes(structure.id)}
                  onCheckedChange={() => toggleStructure(structure.id)}
                />
                <Label htmlFor={`structure-${structure.id}`} className="cursor-pointer font-normal">
                  {structure.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="what_important">What's more important to you right now? *</Label>
          <Select
            value={data.most_important_now || ''}
            onValueChange={(value) => onChange({ most_important_now: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select what matters most" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash_on_cash">Highest cash-on-cash return</SelectItem>
              <SelectItem value="appreciation">Long-term appreciation</SelectItem>
              <SelectItem value="fast_flips">Fast flips / short timelines</SelectItem>
              <SelectItem value="capital_preservation">Capital preservation / low risk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hold_period">What's your target hold period for buy-and-hold deals?</Label>
          <Select
            value={data.target_hold_period || ''}
            onValueChange={(value) => onChange({ target_hold_period: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select hold period (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_1y">Less than 1 year</SelectItem>
              <SelectItem value="1_3y">1–3 years</SelectItem>
              <SelectItem value="3_7y">3–7 years</SelectItem>
              <SelectItem value="over_7y">7+ years</SelectItem>
              <SelectItem value="depends">Not sure / depends</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-slate-500">Optional</p>
        </div>
      </div>
    </div>
  );
}
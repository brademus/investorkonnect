import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FINANCING_OPTIONS = [
  { id: 'all_cash', label: 'All cash' },
  { id: 'conventional', label: 'Conventional loans' },
  { id: 'hard_money', label: 'Hard money / private money' },
  { id: 'dscr', label: 'DSCR / investor loans' },
  { id: 'partnerships', label: 'Partnerships / JV equity' },
  { id: 'other', label: 'Other' },
];

export default function CapitalFinancingStep({ data, onChange }) {
  const toggleFinancing = (id) => {
    const current = data.financing_methods || [];
    const updated = current.includes(id)
      ? current.filter(f => f !== id)
      : [...current, id];
    onChange({ financing_methods: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Capital & financing</h2>
        <p className="text-slate-600">We'll verify later - for now, just give us the general picture</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="capital_available">Roughly how much capital do you have available to deploy in the next 12 months? *</Label>
          <Select
            value={data.capital_available_12mo || ''}
            onValueChange={(value) => onChange({ capital_available_12mo: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select capital range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_50k">Less than $50k</SelectItem>
              <SelectItem value="50k_150k">$50k–$150k</SelectItem>
              <SelectItem value="150k_300k">$150k–$300k</SelectItem>
              <SelectItem value="300k_600k">$300k–$600k</SelectItem>
              <SelectItem value="600k_1m">$600k–$1M</SelectItem>
              <SelectItem value="over_1m">$1M+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">How do you typically finance your deals? (select all that apply) *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FINANCING_OPTIONS.map(option => (
              <div key={option.id} className="flex items-center gap-3">
                <Checkbox
                  id={`financing-${option.id}`}
                  checked={(data.financing_methods || []).includes(option.id)}
                  onCheckedChange={() => toggleFinancing(option.id)}
                />
                <Label htmlFor={`financing-${option.id}`} className="cursor-pointer font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
          {(data.financing_methods || []).includes('other') && (
            <Input
              placeholder="Specify other financing method"
              value={data.financing_other || ''}
              onChange={(e) => onChange({ financing_other: e.target.value })}
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="financing_status">Do you already have financing lined up for your next deal? *</Label>
          <Select
            value={data.financing_lined_up || ''}
            onValueChange={(value) => onChange({ financing_lined_up: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="in_process">In process</SelectItem>
              <SelectItem value="not_yet">Not yet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pof_verification">Would you like to complete proof-of-funds verification later to earn a "Verified Investor" check mark?</Label>
          <Select
            value={data.pof_verification_intent || ''}
            onValueChange={(value) => onChange({ pof_verification_intent: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select preference (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="maybe">Maybe later</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-slate-500">This is just a preference - verification is separate</p>
        </div>
      </div>
    </div>
  );
}
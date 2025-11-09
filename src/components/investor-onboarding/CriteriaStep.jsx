import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const FINANCING_OPTIONS = [
  { id: 'all_cash', label: 'All Cash' },
  { id: 'conventional', label: 'Conventional' },
  { id: 'dscr', label: 'DSCR' },
  { id: 'hard_money', label: 'Hard Money' },
  { id: 'private_capital', label: 'Private Capital / Partners' },
  { id: '1031', label: '1031 Exchange' },
];

export default function CriteriaStep({ data, onChange }) {
  const toggleFinancing = (id) => {
    const current = data.preferred_financing || [];
    const updated = current.includes(id)
      ? current.filter(f => f !== id)
      : [...current, id];
    onChange({ preferred_financing: updated });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Financial criteria & buy box</h2>
        <p className="text-slate-600">Define your investment parameters</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price_min">Min Price Per Deal *</Label>
            <Input
              id="price_min"
              type="number"
              min="0"
              value={data.price_per_deal_min || ''}
              onChange={(e) => onChange({ price_per_deal_min: e.target.value })}
              placeholder="e.g., 100000"
              className="text-lg py-6"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_max">Max Price Per Deal *</Label>
            <Input
              id="price_max"
              type="number"
              min="0"
              value={data.price_per_deal_max || ''}
              onChange={(e) => onChange({ price_per_deal_max: e.target.value })}
              placeholder="e.g., 500000"
              className="text-lg py-6"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="capital_deploy">Total Capital to Deploy (next 12 months) *</Label>
          <Input
            id="capital_deploy"
            type="number"
            min="0"
            value={data.total_capital_to_deploy || ''}
            onChange={(e) => onChange({ total_capital_to_deploy: e.target.value })}
            placeholder="e.g., 1000000"
            className="text-lg py-6"
          />
          <p className="text-sm text-slate-500">Approximate buying power</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min_cap_rate">Minimum Cap Rate (%)</Label>
            <Input
              id="min_cap_rate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={data.min_cap_rate || ''}
              onChange={(e) => onChange({ min_cap_rate: e.target.value })}
              placeholder="e.g., 7.5"
              className="text-lg py-6"
            />
            <p className="text-sm text-slate-500">Optional</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="target_coc">Target Cash-on-Cash (%)</Label>
            <Input
              id="target_coc"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={data.target_cash_on_cash || ''}
              onChange={(e) => onChange({ target_cash_on_cash: e.target.value })}
              placeholder="e.g., 12.0"
              className="text-lg py-6"
            />
            <p className="text-sm text-slate-500">Optional</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min_units">Min Units (for MF)</Label>
            <Input
              id="min_units"
              type="number"
              min="0"
              value={data.min_deal_size_units || ''}
              onChange={(e) => onChange({ min_deal_size_units: e.target.value })}
              placeholder="e.g., 5"
              className="text-lg py-6"
            />
            <p className="text-sm text-slate-500">Optional</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_units">Max Units (for MF)</Label>
            <Input
              id="max_units"
              type="number"
              min="0"
              value={data.max_deal_size_units || ''}
              onChange={(e) => onChange({ max_deal_size_units: e.target.value })}
              placeholder="e.g., 50"
              className="text-lg py-6"
            />
            <p className="text-sm text-slate-500">Optional</p>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Preferred Financing (select all that apply) *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FINANCING_OPTIONS.map(option => (
              <div key={option.id} className="flex items-center gap-3">
                <Checkbox
                  id={`financing-${option.id}`}
                  checked={(data.preferred_financing || []).includes(option.id)}
                  onCheckedChange={() => toggleFinancing(option.id)}
                />
                <Label htmlFor={`financing-${option.id}`} className="cursor-pointer font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
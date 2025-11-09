import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STRATEGIES = [
  { id: 'fix_flip', label: 'Fix & flip' },
  { id: 'brrrr', label: 'BRRRR (buy-rehab-rent-refi-repeat)' },
  { id: 'long_term_rental', label: 'Long-term rentals' },
  { id: 'short_term_rental', label: 'Short-term / vacation rentals' },
  { id: 'small_mf', label: 'Small multifamily (2–4 units)' },
  { id: 'large_mf', label: 'Larger multifamily (5+ units)' },
  { id: 'land', label: 'Land / infill lots' },
  { id: 'new_construction', label: 'New construction / development' },
  { id: 'wholesaling', label: 'Wholesaling / assignments' },
  { id: 'other', label: 'Other' },
];

const PROPERTY_TYPES = [
  { id: 'sfh', label: 'Single-family homes' },
  { id: 'townhomes', label: 'Townhomes / condos' },
  { id: 'duplex_4plex', label: 'Duplex / triplex / fourplex' },
  { id: '5plus', label: '5+ unit apartments' },
  { id: 'mixed_use', label: 'Mixed-use' },
  { id: 'land', label: 'Land' },
  { id: 'other', label: 'Other' },
];

export default function StrategyDealsStep({ data, onChange }) {
  const toggleStrategy = (id) => {
    const current = data.investment_strategies || [];
    const updated = current.includes(id)
      ? current.filter(s => s !== id)
      : [...current, id];
    onChange({ investment_strategies: updated });
  };

  const togglePropertyType = (id) => {
    const current = data.property_types || [];
    const updated = current.includes(id)
      ? current.filter(p => p !== id)
      : [...current, id];
    onChange({ property_types: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Investment strategies & deal types</h2>
        <p className="text-slate-600">Tell us what you're looking for</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <Label className="text-base font-semibold">Which investment strategies are you interested in? (select all that apply) *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STRATEGIES.map(strategy => (
              <div key={strategy.id} className="flex items-center gap-3">
                <Checkbox
                  id={`strategy-${strategy.id}`}
                  checked={(data.investment_strategies || []).includes(strategy.id)}
                  onCheckedChange={() => toggleStrategy(strategy.id)}
                />
                <Label htmlFor={`strategy-${strategy.id}`} className="cursor-pointer font-normal">
                  {strategy.label}
                </Label>
              </div>
            ))}
          </div>
          {(data.investment_strategies || []).includes('other') && (
            <Input
              placeholder="Specify other strategy"
              value={data.strategy_other || ''}
              onChange={(e) => onChange({ strategy_other: e.target.value })}
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_strategy">What's your primary strategy right now? *</Label>
          <Select
            value={data.primary_strategy || ''}
            onValueChange={(value) => onChange({ primary_strategy: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select primary strategy" />
            </SelectTrigger>
            <SelectContent>
              {STRATEGIES.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">What property types are you open to? (select all that apply) *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROPERTY_TYPES.map(type => (
              <div key={type.id} className="flex items-center gap-3">
                <Checkbox
                  id={`property-${type.id}`}
                  checked={(data.property_types || []).includes(type.id)}
                  onCheckedChange={() => togglePropertyType(type.id)}
                />
                <Label htmlFor={`property-${type.id}`} className="cursor-pointer font-normal">
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
          {(data.property_types || []).includes('other') && (
            <Input
              placeholder="Specify other property type"
              value={data.property_type_other || ''}
              onChange={(e) => onChange({ property_type_other: e.target.value })}
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="condition">What condition are you comfortable with? *</Label>
          <Select
            value={data.property_condition || ''}
            onValueChange={(value) => onChange({ property_condition: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select condition preference" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="turnkey">Turn-key / rent-ready</SelectItem>
              <SelectItem value="light_cosmetic">Light cosmetic work</SelectItem>
              <SelectItem value="heavy_rehab">Full gut / heavy rehab</SelectItem>
              <SelectItem value="teardown">Teardowns / development sites</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
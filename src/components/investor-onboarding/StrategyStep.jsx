import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const STRATEGIES = [
  { id: 'fix_flip', label: 'Fix & Flip' },
  { id: 'brrrr', label: 'BRRRR' },
  { id: 'long_term_rental', label: 'Long-term Rentals' },
  { id: 'short_term_rental', label: 'Short-term / Mid-term Rentals' },
  { id: 'small_mf', label: 'Small Multifamily (2–20 units)' },
  { id: 'large_mf', label: 'Large Multifamily (20+ units)' },
  { id: 'mixed_use', label: 'Mixed-use / Small Commercial' },
  { id: 'development', label: 'Development / Land' },
  { id: 'value_add', label: 'Value-add' },
  { id: 'nnn', label: 'NNN / Cash-flow Only' },
];

const ASSET_TYPES = [
  { id: 'sfr', label: 'Single-family' },
  { id: 'duplex_4plex', label: 'Duplex / Triplex / Fourplex' },
  { id: 'small_mf', label: 'Small Multifamily (5–20 units)' },
  { id: 'large_mf', label: 'Large Multifamily (20+ units)' },
  { id: 'office', label: 'Office' },
  { id: 'retail', label: 'Retail' },
  { id: 'industrial', label: 'Industrial / Flex' },
  { id: 'land', label: 'Land' },
  { id: 'mixed_use', label: 'Mixed-use' },
];

const CONDITIONS = [
  { id: 'turnkey', label: 'Turn-key' },
  { id: 'light_cosmetic', label: 'Light cosmetic' },
  { id: 'heavy_rehab', label: 'Heavy rehab' },
  { id: 'teardown', label: 'Teardown / Development' },
];

export default function StrategyStep({ data, onChange }) {
  const toggleStrategy = (id) => {
    const current = data.strategies || [];
    const updated = current.includes(id)
      ? current.filter(s => s !== id)
      : [...current, id];
    onChange({ strategies: updated });
  };

  const toggleAssetType = (id) => {
    const current = data.asset_types || [];
    const updated = current.includes(id)
      ? current.filter(a => a !== id)
      : [...current, id];
    onChange({ asset_types: updated });
  };

  const toggleCondition = (id) => {
    const current = data.condition_preferences || [];
    const updated = current.includes(id)
      ? current.filter(c => c !== id)
      : [...current, id];
    onChange({ condition_preferences: updated });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Your investment strategy</h2>
        <p className="text-slate-600">Tell us what types of deals you pursue</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-semibold">Strategies (select all that apply) *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STRATEGIES.map(strategy => (
              <div key={strategy.id} className="flex items-center gap-3">
                <Checkbox
                  id={`strategy-${strategy.id}`}
                  checked={(data.strategies || []).includes(strategy.id)}
                  onCheckedChange={() => toggleStrategy(strategy.id)}
                />
                <Label htmlFor={`strategy-${strategy.id}`} className="cursor-pointer font-normal">
                  {strategy.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Asset Types (select all that apply) *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ASSET_TYPES.map(asset => (
              <div key={asset.id} className="flex items-center gap-3">
                <Checkbox
                  id={`asset-${asset.id}`}
                  checked={(data.asset_types || []).includes(asset.id)}
                  onCheckedChange={() => toggleAssetType(asset.id)}
                />
                <Label htmlFor={`asset-${asset.id}`} className="cursor-pointer font-normal">
                  {asset.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Property Condition Preferences *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONDITIONS.map(condition => (
              <div key={condition.id} className="flex items-center gap-3">
                <Checkbox
                  id={`condition-${condition.id}`}
                  checked={(data.condition_preferences || []).includes(condition.id)}
                  onCheckedChange={() => toggleCondition(condition.id)}
                />
                <Label htmlFor={`condition-${condition.id}`} className="cursor-pointer font-normal">
                  {condition.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deal_volume">Target Deal Volume (next 12 months) *</Label>
          <Input
            id="deal_volume"
            type="number"
            min="0"
            value={data.deal_volume_goal || ''}
            onChange={(e) => onChange({ deal_volume_goal: e.target.value })}
            placeholder="e.g., 3"
            className="text-lg py-6"
          />
          <p className="text-sm text-slate-500">Number of deals or doors you aim to acquire</p>
        </div>
      </div>
    </div>
  );
}
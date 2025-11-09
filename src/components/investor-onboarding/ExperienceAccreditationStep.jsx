import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HOLDING_STRUCTURES = [
  { id: 'personal', label: 'Personal name' },
  { id: 'llc', label: 'LLC / company' },
  { id: 'partnership', label: 'Partnership / syndication' },
  { id: 'sdira', label: 'Self-directed retirement account' },
];

export default function ExperienceAccreditationStep({ data, onChange }) {
  const toggleHoldingStructure = (id) => {
    const current = data.investment_holding_structures || [];
    const updated = current.includes(id)
      ? current.filter(h => h !== id)
      : [...current, id];
    onChange({ investment_holding_structures: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Final details</h2>
        <p className="text-slate-600">Complete your investor profile</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accredited">Do you consider yourself an accredited investor?</Label>
          <Select
            value={data.accredited_investor || ''}
            onValueChange={(value) => onChange({ accredited_investor: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select status (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="not_sure">Not sure</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-slate-500">Optional - for informational purposes</p>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">How do you typically hold your investments? (select all that apply)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HOLDING_STRUCTURES.map(structure => (
              <div key={structure.id} className="flex items-center gap-3">
                <Checkbox
                  id={`holding-${structure.id}`}
                  checked={(data.investment_holding_structures || []).includes(structure.id)}
                  onCheckedChange={() => toggleHoldingStructure(structure.id)}
                />
                <Label htmlFor={`holding-${structure.id}`} className="cursor-pointer font-normal">
                  {structure.label}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500">Optional</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="background_links">Share any links that help us understand your investing background</Label>
          <Textarea
            id="background_links"
            value={data.background_links || ''}
            onChange={(e) => onChange({ background_links: e.target.value })}
            placeholder="LinkedIn, website, portfolio, BiggerPockets profile, etc."
            className="min-h-24"
          />
          <p className="text-sm text-slate-500">Optional - one link per line</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="anything_else">Anything else your future agent should know about you or your strategy?</Label>
          <Textarea
            id="anything_else"
            value={data.anything_else_for_agent || ''}
            onChange={(e) => onChange({ anything_else_for_agent: e.target.value })}
            placeholder="Additional context, constraints, goals, or preferences..."
            className="min-h-32"
          />
          <p className="text-sm text-slate-500">Optional - any final details</p>
        </div>

        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-6 mt-6">
          <h4 className="font-semibold text-emerald-900 mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-emerald-800 mb-3">
            After submitting, you'll verify your identity and sign an NDA before accessing our network of verified, investor-friendly agents.
          </p>
          <ul className="text-sm text-emerald-800 space-y-1">
            <li>✓ Identity verification takes 2-3 minutes</li>
            <li>✓ NDA protects your deal information</li>
            <li>✓ Then you'll see your matched agents</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
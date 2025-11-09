import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TEAM_OPTIONS = [
  { id: 'gc', label: 'General Contractor' },
  { id: 'pm', label: 'Property Manager' },
  { id: 'lender', label: 'Lender' },
  { id: 'attorney', label: 'Attorney' },
  { id: 'cpa', label: 'CPA' },
  { id: 'none', label: 'None yet' },
];

export default function DealMechanicsStep({ data, onChange }) {
  const toggleTeamMember = (id) => {
    const current = data.team_in_place || [];
    const updated = current.includes(id)
      ? current.filter(t => t !== id)
      : [...current, id];
    onChange({ team_in_place: updated });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Deal mechanics & readiness</h2>
        <p className="text-slate-600">Let agents know how ready you are</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Checkbox
            id="has_pof"
            checked={data.has_proof_of_funds || false}
            onCheckedChange={(checked) => onChange({ has_proof_of_funds: checked })}
          />
          <Label htmlFor="has_pof" className="cursor-pointer font-normal">
            I have proof of funds ready
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="has_preapproval"
            checked={data.has_preapproval_or_term_sheet || false}
            onCheckedChange={(checked) => onChange({ has_preapproval_or_term_sheet: checked })}
          />
          <Label htmlFor="has_preapproval" className="cursor-pointer font-normal">
            I have pre-approval or term sheet
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeline">Timeline to Close *</Label>
          <Select
            value={data.timeline_to_close || ''}
            onValueChange={(value) => onChange({ timeline_to_close: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="How quickly can you close?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_14">Less than 14 days</SelectItem>
              <SelectItem value="15_30">15–30 days</SelectItem>
              <SelectItem value="31_60">31–60 days</SelectItem>
              <SelectItem value="over_60">60+ days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Team in Place (select all that apply)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEAM_OPTIONS.map(option => (
              <div key={option.id} className="flex items-center gap-3">
                <Checkbox
                  id={`team-${option.id}`}
                  checked={(data.team_in_place || []).includes(option.id)}
                  onCheckedChange={() => toggleTeamMember(option.id)}
                />
                <Label htmlFor={`team-${option.id}`} className="cursor-pointer font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="constraints">Constraints or Red Flags</Label>
          <Textarea
            id="constraints"
            value={data.constraints_or_red_flags || ''}
            onChange={(e) => onChange({ constraints_or_red_flags: e.target.value })}
            placeholder="e.g., 'No rural properties', 'No flood zones', 'Must be on public sewer'"
            className="min-h-24"
          />
          <p className="text-sm text-slate-500">Optional - any deal-breakers or special requirements</p>
        </div>
      </div>
    </div>
  );
}
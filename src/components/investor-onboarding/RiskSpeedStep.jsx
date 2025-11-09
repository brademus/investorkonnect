import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RiskSpeedStep({ data, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Risk, speed, and seriousness</h2>
        <p className="text-slate-600">Help agents understand your decision-making process</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="decision_speed">How quickly can you make a decision on a deal once you have the numbers? *</Label>
          <Select
            value={data.decision_speed_on_deal || ''}
            onValueChange={(value) => onChange({ decision_speed_on_deal: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select decision timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24_hours">Within 24 hours</SelectItem>
              <SelectItem value="2_3_days">2–3 days</SelectItem>
              <SelectItem value="about_week">About a week</SelectItem>
              <SelectItem value="longer">Longer than a week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="earnest_money">What's your typical earnest money deposit (as a % of purchase price)?</Label>
          <Input
            id="earnest_money"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={data.typical_earnest_money_pct || ''}
            onChange={(e) => onChange({ typical_earnest_money_pct: e.target.value })}
            placeholder="e.g., 1.0"
            className="text-lg py-6"
          />
          <p className="text-sm text-slate-500">Optional - enter percentage (e.g., 1.0 for 1%)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="non_refundable">Are you comfortable with non-refundable earnest money in the right deal? *</Label>
          <Select
            value={data.comfortable_non_refundable_em || ''}
            onValueChange={(value) => onChange({ comfortable_non_refundable_em: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select comfort level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes, in some cases</SelectItem>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="depends">Depends / would discuss with agent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recent_deal">Tell us about your last or most recent real estate deal.</Label>
          <Textarea
            id="recent_deal"
            value={data.most_recent_deal || ''}
            onChange={(e) => onChange({ most_recent_deal: e.target.value })}
            placeholder="Location, purchase price, strategy, outcome..."
            className="min-h-32"
          />
          <p className="text-sm text-slate-500">Optional - helps us understand your experience</p>
        </div>
      </div>
    </div>
  );
}
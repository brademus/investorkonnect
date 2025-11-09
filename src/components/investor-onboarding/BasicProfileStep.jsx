import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BasicProfileStep({ data, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Let's start with the basics</h2>
        <p className="text-slate-600">Help us understand your investment experience</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="investor_description">What best describes you as an investor? *</Label>
          <Select
            value={data.investor_description || ''}
            onValueChange={(value) => onChange({ investor_description: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select your investor profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New / just getting started</SelectItem>
              <SelectItem value="few_deals">Have done a few deals</SelectItem>
              <SelectItem value="full_time">Full-time / professional investor</SelectItem>
              <SelectItem value="family_office">Family office / fund</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deals_24mo">How many real estate investment deals have you closed in the last 24 months? *</Label>
          <Select
            value={data.deals_closed_24mo || ''}
            onValueChange={(value) => onChange({ deals_closed_24mo: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select deal count" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0</SelectItem>
              <SelectItem value="1_2">1–2</SelectItem>
              <SelectItem value="3_5">3–5</SelectItem>
              <SelectItem value="6_10">6–10</SelectItem>
              <SelectItem value="11_plus">11+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="typical_deal_size">What's your typical deal size (purchase price)? *</Label>
          <Select
            value={data.typical_deal_size || ''}
            onValueChange={(value) => onChange({ typical_deal_size: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select typical purchase price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_150k">Under $150k</SelectItem>
              <SelectItem value="150k_300k">$150k–$300k</SelectItem>
              <SelectItem value="300k_600k">$300k–$600k</SelectItem>
              <SelectItem value="600k_1m">$600k–$1M</SelectItem>
              <SelectItem value="over_1m">$1M+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
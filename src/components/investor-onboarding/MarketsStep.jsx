import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function MarketsStep({ data, onChange, initialState }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Target markets</h2>
        <p className="text-slate-600">Within your chosen state: {initialState}</p>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">{initialState}</span>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900">Your State</h4>
              <p className="text-sm text-blue-700">Selected earlier in the flow</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="specific_areas">Within {initialState}, are you targeting any specific cities or counties?</Label>
          <Textarea
            id="specific_areas"
            value={data.specific_cities_counties || ''}
            onChange={(e) => onChange({ specific_cities_counties: e.target.value })}
            placeholder="e.g., Phoenix, Scottsdale or Travis County"
            className="min-h-20"
          />
          <p className="text-sm text-slate-500">Optional - leave blank if you're open to anywhere</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="area_importance">How important is staying within those areas vs. anywhere in the state? *</Label>
          <Select
            value={data.market_area_importance || ''}
            onValueChange={(value) => onChange({ market_area_importance: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select importance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="only_listed">Only in the areas I listed</SelectItem>
              <SelectItem value="prefer_but_open">Prefer those areas but open to others</SelectItem>
              <SelectItem value="anywhere">Open to anywhere in the state</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">What's your ideal price range in this state?</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_price">Min Price</Label>
              <Input
                id="min_price"
                type="number"
                min="0"
                value={data.state_price_min || ''}
                onChange={(e) => onChange({ state_price_min: e.target.value })}
                placeholder="e.g., 200000"
                className="text-lg py-6"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_price">Max Price</Label>
              <Input
                id="max_price"
                type="number"
                min="0"
                value={data.state_price_max || ''}
                onChange={(e) => onChange({ state_price_max: e.target.value })}
                placeholder="e.g., 500000"
                className="text-lg py-6"
              />
            </div>
          </div>
          <p className="text-sm text-slate-500">Optional</p>
        </div>
      </div>
    </div>
  );
}
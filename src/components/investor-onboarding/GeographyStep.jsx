import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function GeographyStep({ data, onChange, initialState }) {
  const [marketInput, setMarketInput] = useState('');
  const [secondaryStatesInput, setSecondaryStatesInput] = useState('');

  const targetMarkets = data.target_markets || [];
  const secondaryStates = data.secondary_states || [];

  const addMarket = () => {
    if (marketInput.trim()) {
      onChange({ target_markets: [...targetMarkets, marketInput.trim()] });
      setMarketInput('');
    }
  };

  const removeMarket = (market) => {
    onChange({ target_markets: targetMarkets.filter(m => m !== market) });
  };

  const toggleSecondaryState = (state) => {
    const updated = secondaryStates.includes(state)
      ? secondaryStates.filter(s => s !== state)
      : [...secondaryStates, state];
    onChange({ secondary_states: updated });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Geography & markets</h2>
        <p className="text-slate-600">Define where you want to invest</p>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">{initialState}</span>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900">Primary State</h4>
              <p className="text-sm text-blue-700">Selected from map: {initialState}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="markets">Target Markets / Cities (within {initialState}) *</Label>
          <div className="flex gap-2">
            <Input
              id="markets"
              value={marketInput}
              onChange={(e) => setMarketInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMarket())}
              placeholder="e.g., Phoenix, Scottsdale, Tempe"
              className="flex-1"
            />
            <button
              type="button"
              onClick={addMarket}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {targetMarkets.map((market, idx) => (
              <Badge key={idx} variant="secondary" className="px-3 py-1 text-sm">
                {market}
                <button
                  type="button"
                  onClick={() => removeMarket(market)}
                  className="ml-2 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-500">Press Enter or click Add after each city</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="consider_other"
              checked={data.will_consider_other_markets || false}
              onCheckedChange={(checked) => onChange({ will_consider_other_markets: checked })}
            />
            <Label htmlFor="consider_other" className="cursor-pointer font-normal">
              I'm open to other markets / states
            </Label>
          </div>

          {data.will_consider_other_markets && (
            <div className="ml-7 space-y-3 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <Label className="text-base font-semibold">Secondary States (optional)</Label>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {US_STATES.filter(s => s !== initialState).map(state => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => toggleSecondaryState(state)}
                    className={`p-2 rounded border-2 text-sm font-medium transition-all ${
                      secondaryStates.includes(state)
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
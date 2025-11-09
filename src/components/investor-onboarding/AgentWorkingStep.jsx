import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AGENT_SERVICES = [
  { id: 'find_deals', label: 'Finds and sends me deal opportunities' },
  { id: 'underwrite', label: 'Helps underwrite deals' },
  { id: 'negotiate', label: 'Negotiates and structures offers' },
  { id: 'manage_transaction', label: 'Manages the transaction (contract to close)' },
  { id: 'advise_regulations', label: 'Advises on local regulations (STR rules, zoning, etc.)' },
  { id: 'connect_network', label: 'Connects me to lenders/contractors/property managers' },
];

const COMMUNICATION_METHODS = [
  { id: 'text', label: 'Text' },
  { id: 'phone', label: 'Phone calls' },
  { id: 'email', label: 'Email' },
  { id: 'in_app', label: 'In-app messages only' },
];

export default function AgentWorkingStep({ data, onChange }) {
  const toggleService = (id) => {
    const current = data.what_from_agent || [];
    const updated = current.includes(id)
      ? current.filter(s => s !== id)
      : [...current, id];
    onChange({ what_from_agent: updated });
  };

  const toggleCommunication = (id) => {
    const current = data.communication_preferences || [];
    const updated = current.includes(id)
      ? current.filter(c => c !== id)
      : [...current, id];
    onChange({ communication_preferences: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">How you want to work with your agent</h2>
        <p className="text-slate-600">Set expectations for your agent relationship</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <Label className="text-base font-semibold">What are you looking for from an agent? (select all that apply) *</Label>
          <div className="grid grid-cols-1 gap-3">
            {AGENT_SERVICES.map(service => (
              <div key={service.id} className="flex items-center gap-3">
                <Checkbox
                  id={`service-${service.id}`}
                  checked={(data.what_from_agent || []).includes(service.id)}
                  onCheckedChange={() => toggleService(service.id)}
                />
                <Label htmlFor={`service-${service.id}`} className="cursor-pointer font-normal">
                  {service.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">How do you prefer to communicate? (select all that apply) *</Label>
          <div className="grid grid-cols-2 gap-3">
            {COMMUNICATION_METHODS.map(method => (
              <div key={method.id} className="flex items-center gap-3">
                <Checkbox
                  id={`comm-${method.id}`}
                  checked={(data.communication_preferences || []).includes(method.id)}
                  onCheckedChange={() => toggleCommunication(method.id)}
                />
                <Label htmlFor={`comm-${method.id}`} className="cursor-pointer font-normal">
                  {method.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="response_time">What's your preferred response time from an agent on a live deal? *</Label>
          <Select
            value={data.preferred_agent_response_time || ''}
            onValueChange={(value) => onChange({ preferred_agent_response_time: value })}
          >
            <SelectTrigger className="text-lg py-6">
              <SelectValue placeholder="Select preferred response time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="few_hours">Within a few hours</SelectItem>
              <SelectItem value="same_day">Same day</SelectItem>
              <SelectItem value="24_hours">Within 24 hours</SelectItem>
              <SelectItem value="no_preference">No strong preference</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deal_breakers">What are your biggest deal-breakers when working with an agent?</Label>
          <Input
            id="deal_breakers"
            value={data.agent_deal_breakers || ''}
            onChange={(e) => onChange({ agent_deal_breakers: e.target.value })}
            placeholder="e.g., slow responses, pushy sales tactics, lack of market knowledge"
            className="text-lg py-6"
          />
          <p className="text-sm text-slate-500">Optional - helps us match you better</p>
        </div>
      </div>
    </div>
  );
}
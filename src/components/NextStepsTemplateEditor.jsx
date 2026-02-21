import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, FileText } from "lucide-react";
import { DEFAULT_NEXT_STEPS_TEMPLATE, TEMPLATE_PLACEHOLDERS } from "@/components/utils/nextStepsTemplate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Info } from "lucide-react";

export default function NextStepsTemplateEditor({ value, onChange, disabled, templateType, onTypeChange }) {
  const [open, setOpen] = useState(false);
  // Support both old (single value) and new (type + custom) modes
  const effectiveType = onTypeChange ? (templateType || 'default') : (value && value !== DEFAULT_NEXT_STEPS_TEMPLATE ? 'custom' : 'default');

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[#FAFAFA] flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-[#E3C567]" />
          Next Steps Message Template
        </Label>
        <p className="text-xs text-[#808080] mb-4">
          This message is automatically sent to the agent once both parties sign the agreement.
        </p>
      </div>

      {/* Option: Default */}
      <label
        className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all"
        style={{
          borderColor: effectiveType === 'default' ? '#E3C567' : '#1F1F1F',
          backgroundColor: effectiveType === 'default' ? 'rgba(227,197,103,0.1)' : '#141414'
        }}
      >
        <input
          type="radio"
          name="template_type_account"
          checked={effectiveType === 'default'}
          onChange={() => onTypeChange?.('default')}
          disabled={disabled}
          className="sr-only"
        />
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${effectiveType === 'default' ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
          {effectiveType === 'default' && <div className="w-2 h-2 rounded-full bg-black" />}
        </div>
        <div className="flex-1">
          <div className="text-[#FAFAFA] text-sm font-semibold mb-1">Use Investor Konnect Template (Recommended)</div>
          <div className="text-xs text-[#808080]">Professional template that auto-fills property details and your contact info.</div>
        </div>
      </label>

      {/* Option: Custom */}
      <label
        className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all"
        style={{
          borderColor: effectiveType === 'custom' ? '#E3C567' : '#1F1F1F',
          backgroundColor: effectiveType === 'custom' ? 'rgba(227,197,103,0.1)' : '#141414'
        }}
      >
        <input
          type="radio"
          name="template_type_account"
          checked={effectiveType === 'custom'}
          onChange={() => onTypeChange?.('custom')}
          disabled={disabled}
          className="sr-only"
        />
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${effectiveType === 'custom' ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
          {effectiveType === 'custom' && <div className="w-2 h-2 rounded-full bg-black" />}
        </div>
        <div className="text-[#FAFAFA] text-sm font-semibold">Write My Own Custom Message</div>
      </label>

      {/* Custom textarea */}
      {effectiveType === 'custom' && (
        <div className="pl-4 space-y-3">
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={14}
            disabled={disabled}
            placeholder="Write your message to agents here..."
            className="bg-[#141414] border-[#333] text-[#FAFAFA] font-mono text-xs leading-relaxed"
          />
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 text-xs text-[#E3C567] hover:text-[#EDD89F] transition-colors">
                <Info className="w-3.5 h-3.5" />
                {open ? "Hide" : "Show"} available placeholders
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 bg-[#141414] border border-[#1F1F1F] rounded-lg space-y-1.5">
                {TEMPLATE_PLACEHOLDERS.map((p) => (
                  <div key={p.key} className="flex items-start gap-2 text-xs">
                    <code className="bg-[#0D0D0D] text-[#E3C567] px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0">{p.key}</code>
                    <span className="text-[#808080]">{p.label}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, RotateCcw, Info } from "lucide-react";
import { DEFAULT_NEXT_STEPS_TEMPLATE, TEMPLATE_PLACEHOLDERS } from "@/components/utils/nextStepsTemplate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function NextStepsTemplateEditor({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const current = value || DEFAULT_NEXT_STEPS_TEMPLATE;
  const isDefault = !value || value === DEFAULT_NEXT_STEPS_TEMPLATE;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[#FAFAFA] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#E3C567]" />
          Next Steps Message Template
        </Label>
        {!isDefault && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange("")}
            className="text-xs text-[#808080] hover:text-[#E3C567]"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset to default
          </Button>
        )}
      </div>
      <p className="text-xs text-[#808080]">
        This message is automatically sent to the agent once both parties sign the agreement.
      </p>

      <Textarea
        value={current}
        onChange={(e) => onChange(e.target.value)}
        rows={16}
        disabled={disabled}
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
  );
}
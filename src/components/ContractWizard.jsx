import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FileText } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation"; // kept for generate step loading only

const CONTRACT_TEMPLATES = [
  { id: "buyer_rep_v1", name: "Buyer Representation Agreement" },
  { id: "referral_v1", name: "Referral Agreement" },
  { id: "services_v1", name: "Real Estate Services Agreement" }
];

const REQUIRED_KEYS = [
  'investor_name', 'agent_name', 'commission_type', 'agreement_length_days', 'property_region', 'governing_law'
];

const FIELDS = [
  { key: 'investor_name', label: 'Investor Name (Agreement)' },
  { key: 'agent_name', label: 'Agent Name (Agreement)' },
  { key: 'agent_brokerage', label: 'Agent Brokerage (Agreement)' },
  { key: 'agent_license_number', label: 'Agent License Number (Agreement)' },
  { key: 'agent_license_state', label: 'Agent License State (Agreement)' },
  { key: 'commission_type', label: 'Commission Type (Agreement)' },
  { key: 'commission_percentage', label: 'Commission % (Agreement)' },
  { key: 'flat_fee_amount', label: 'Flat Fee (Agreement)' },
  { key: 'agreement_length_days', label: 'Agreement Length (days) (Agreement)' },
  { key: 'agreement_length', label: 'Agreement Length (derived, days)' },
  { key: 'transaction_type', label: 'Transaction Type (Agreement)' },
  { key: 'fee_structure', label: 'Commission / Fee Structure (Derived)' },
  { key: 'strategy_summary', label: 'Strategy Summary' },
  { key: 'exclusivity', label: 'Exclusivity (Agreement)' },
  { key: 'term_start', label: 'Term Start' },
  { key: 'term_end', label: 'Term End' },
  { key: 'governing_law', label: 'Governing Law (Agreement)' },
  { key: 'termination_rights', label: 'Termination (Agreement)' },
  { key: 'property_region', label: 'Property Region (Agreement)' },
  { key: 'retainer_amount', label: 'Retainer Amount (Agreement)' },
  { key: 'retainer_currency', label: 'Retainer Currency (Agreement)' }
];

export default function ContractWizard({ roomId, open, onClose }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  // analysis removed
  const [templateId, setTemplateId] = useState("");
  const [terms, setTerms] = useState({});
  const [missing, setMissing] = useState([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);




  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTemplateId("");
    setTerms({});
    setMissing([]);
    setDraft("");

  }, [open]);

  // Load buyer's agent agreement terms when modal opens
  useEffect(() => {
    if (!open || !roomId) return;
    (async () => {
      try {
        setLoading(true);
        // 1) Load room to get deal_id
        const rooms = await base44.entities.Room.filter({ id: roomId });
        const room = rooms?.[0];
        const dealId = room?.deal_id;
        if (!dealId) { setLoading(false); return; }

        // 2) Load deal only (no chat or agreement lookups)
        const dealList = await base44.entities.Deal.filter({ id: dealId });
        const deal = dealList?.[0] || null;

        // 3) Load profiles from room participants
        let investorProfile = null, agentProfile = null;
        if (room?.investorId || room?.agentId) {
          const [inv, ag] = await Promise.all([
            room?.investorId ? base44.entities.Profile.filter({ id: room.investorId }) : Promise.resolve([]),
            room?.agentId ? base44.entities.Profile.filter({ id: room.agentId }) : Promise.resolve([])
          ]);
          investorProfile = inv?.[0] || null;
          agentProfile = ag?.[0] || null;
        }

        // 4) Build terms solely from deal data (no chat/agreement)
        const pt = deal?.proposed_terms || {};

        const buyerType = pt.buyer_commission_type || '';
        const buyerPct = (pt.buyer_commission_percentage ?? '');
        const buyerFlat = (pt.buyer_flat_fee ?? '');
        const lengthDays = (pt.agreement_length ?? '');
        const txnType = '';

        const feeStr = (() => {
          if (buyerType === 'percentage' && buyerPct) return `${buyerPct}% of purchase price, paid at closing`;
          if (buyerType === 'flat' && buyerFlat) return `Flat fee $${buyerFlat}, paid at closing`;
          return '';
        })();

        const region = [deal?.city, deal?.state].filter(Boolean).join(', ') || deal?.state || '';
        const initialTerms = {
          investor_name: investorProfile?.full_name || '',
          agent_name: agentProfile?.full_name || '',
          agent_brokerage: agentProfile?.agent?.brokerage || agentProfile?.broker || '',
          agent_license_number: agentProfile?.agent?.license_number || agentProfile?.license_number || '',
          agent_license_state: agentProfile?.agent?.license_state || agentProfile?.license_state || '',
          commission_type: buyerType || '',
          commission_percentage: buyerType === 'percentage' ? String(buyerPct) : '',
          flat_fee_amount: buyerType === 'flat' ? String(buyerFlat) : '',
          agreement_length_days: String(lengthDays || ''),
          agreement_length: String(lengthDays || ''),
          transaction_type: txnType || '',
          fee_structure: feeStr,
          exclusivity: pt.exclusivity || '',
          governing_law: deal?.state || '',
          property_region: region,
          strategy_summary: deal?.notes || deal?.description || '',
          termination_rights: pt.termination_rights || '',
          retainer_amount: pt.retainer_amount ?? '',
          retainer_currency: pt.retainer_currency ?? 'USD'
        };

        setTerms(initialTerms);
        const req = [...REQUIRED_KEYS];
        if (initialTerms.commission_type === 'percentage') {
          if (!initialTerms.commission_percentage) req.push('commission_percentage');
        } else if (initialTerms.commission_type === 'flat') {
          if (!initialTerms.flat_fee_amount) req.push('flat_fee_amount');
        }
        const missingKeys = req.filter(k => !initialTerms[k] || String(initialTerms[k]).trim() === '');
        setMissing(missingKeys);
        setStep(2);
        // Suggest default template for buyer rep
        if (!templateId) setTemplateId('buyer_rep_v1');
      } catch (e) {
        // Silent fail - user can still proceed
        console.warn('[ContractWizard] Failed to preload agreement terms', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, roomId]);



  const updateTerm = (k, v) => {
    setTerms(prev => {
      const next = { ...prev, [k]: v };
      const req = [...REQUIRED_KEYS];
      if (next.commission_type === 'percentage') {
        req.push('commission_percentage');
      } else if (next.commission_type === 'flat') {
        req.push('flat_fee_amount');
      }
      const missingKeys = req.filter(key => !next[key] || String(next[key]).trim() === '');
      setMissing(missingKeys);
      return next;
    });
  };

  const generate = async () => {
    if (!templateId) { alert("Please select a template"); return; }
    if (missing.length > 0) { alert("Please fill required fields: " + missing.join(", ")); return; }
    setSaving(true);
    const resp = await base44.functions.invoke('contractGenerateDraft', { room_id: roomId, template_id: templateId, terms });
    const content = resp?.data?.content || resp?.data?.draft || '';
    const generatedDraft = content || '# CONTRACT DRAFT\n\nContent unavailable.';
    setDraft(generatedDraft);
    setStep(4);
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6" />
              <h3 className="text-2xl font-bold">Generate Contract</h3>
            </div>
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white text-xl font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Start – no AI, no chat */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-700 text-sm">
                The wizard uses only the deal data you entered. No chat extraction or AI.
              </div>
              <Button 
                onClick={() => setStep(2)} 
                className="w-full bg-blue-600 hover:bg-blue-700 h-12"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 3 was AI review; removed per requirements */}

          {/* Step 2: Edit Terms */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Contract Template</Label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={templateId} 
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">Select a template</option>
                  {CONTRACT_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>



              <div>
                <Label className="text-sm font-semibold mb-2 block">Buyer’s Agent Agreement Terms (Deal Data Only)</Label>
                <p className="text-xs text-slate-500 mb-2">These values are loaded exclusively from the deal data you entered. No chat extraction.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto border border-blue-200 rounded-lg p-4 bg-blue-50">
                  {FIELDS.map(({ key, label }) => {
                    const isMissing = missing.includes(key);
                    return (
                      <div key={key} className="flex flex-col">
                        <Label className={`text-xs mb-1 ${isMissing ? 'text-rose-600' : 'text-slate-600'}`}>
                          {label}{isMissing ? ' (required)' : ''}
                        </Label>
                        <Input
                          value={terms[key] ?? ''}
                          onChange={(e) => updateTerm(key, e.target.value)}
                          className={`text-sm ${isMissing ? 'border-rose-300 focus:ring-rose-500' : ''}`}
                        />
                      </div>
                    );
                  })}

                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button 
                  onClick={generate} 
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <>
                      <LoadingAnimation className="w-4 h-4 mr-2" />
                      Generating...
                    </>
                  ) : (
                    "Generate Contract Draft"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Preview & Download */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-900 font-medium">
                  ✓ Contract draft generated successfully
                </p>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 block">Preview (Markdown)</Label>
                <textarea 
                  className="w-full h-80 border border-slate-300 rounded-lg p-4 text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  value={draft} 
                  readOnly 
                />
              </div>

              <div className="flex justify-between">
                <a 
                  href={`data:text/markdown;charset=utf-8,${encodeURIComponent(draft)}`}
                  download="contract_draft.md"
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Download .md
                </a>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Edit Terms
                  </Button>
                  <Button 
                    onClick={onClose}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FileText, AlertCircle } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation"; // kept for generate step loading only

const CONTRACT_TEMPLATES = [
  { id: "buyer_rep_v1", name: "Buyer Representation Agreement" },
  { id: "referral_v1", name: "Referral Agreement" },
  { id: "services_v1", name: "Real Estate Services Agreement" }
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
  const [mode, setMode] = useState("template");
  const [agreementData, setAgreementData] = useState(null);

  const mergeMissing = (base, extra) => {
    const out = { ...(base || {}) };
    if (extra && typeof extra === 'object') {
      Object.entries(extra).forEach(([k, v]) => {
        const isEmpty = out[k] === undefined || out[k] === null || String(out[k]).trim() === '';
        if (isEmpty && v !== undefined && v !== null && String(v).trim() !== '') out[k] = v;
      });
    }
    return out;
  };

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setAnalysis(null);
    setTemplateId("");
    setTerms({});
    setMissing([]);
    setDraft("");
    setMode("template");
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

        // 2) Load deal + agreement in parallel
        const [dealList, agreementRes] = await Promise.all([
          base44.entities.Deal.filter({ id: dealId }),
          base44.functions.invoke('getLegalAgreement', { deal_id: dealId })
        ]);
        const deal = dealList?.[0] || null;
        const agreement = agreementRes?.data?.agreement || null;
        setAgreementData(agreement);

        // 3) Load profiles (for names/brokerage/license)
        let investorProfile = null, agentProfile = null;
        if (agreement?.investor_profile_id || agreement?.agent_profile_id) {
          const [inv, ag] = await Promise.all([
            agreement?.investor_profile_id ? base44.entities.Profile.filter({ id: agreement.investor_profile_id }) : Promise.resolve([]),
            agreement?.agent_profile_id ? base44.entities.Profile.filter({ id: agreement.agent_profile_id }) : Promise.resolve([])
          ]);
          investorProfile = inv?.[0] || null;
          agentProfile = ag?.[0] || null;
        }

        // 4) Build buyer's agent terms from agreement exhibit A, falling back to deal.proposed_terms
        const ex = agreement?.exhibit_a_terms || {};
        const pt = deal?.proposed_terms || {};

        const buyerType = ex.buyer_commission_type ?? (ex.compensation_model === 'COMMISSION_PCT' ? 'percentage' : ex.compensation_model === 'FLAT_FEE' ? 'flat' : undefined) ?? pt.buyer_commission_type;
        const buyerPct = (ex.buyer_commission_percentage ?? ex.commission_percentage ?? pt.buyer_commission_percentage ?? '');
        const buyerFlat = (ex.buyer_flat_fee ?? ex.flat_fee_amount ?? pt.buyer_flat_fee ?? '');
        const lengthDays = (ex.agreement_length_days ?? ex.agreement_length ?? pt.agreement_length ?? '');
        const txnType = agreement?.transaction_type || ex.transaction_type || '';

        const feeStr = (() => {
          if (buyerType === 'percentage' && buyerPct) return `${buyerPct}% of purchase price, paid at closing`;
          if (buyerType === 'flat' && buyerFlat) return `Flat fee $${buyerFlat}, paid at closing`;
          return '';
        })();

        const initialTerms = {
          investor_name: investorProfile?.full_name || '',
          agent_name: agentProfile?.full_name || '',
          agent_brokerage: agentProfile?.agent?.brokerage || agentProfile?.broker || '',
          agent_license_number: agentProfile?.agent?.license_number || '',
          agent_license_state: agentProfile?.agent?.license_state || '',
          commission_type: buyerType || '',
          commission_percentage: buyerType === 'percentage' ? String(buyerPct) : '',
          flat_fee_amount: buyerType === 'flat' ? String(buyerFlat) : '',
          agreement_length_days: String(lengthDays || ''),
          agreement_length: String(lengthDays || ''),
          transaction_type: txnType || '',
          fee_structure: feeStr,
          exclusivity: ex.exclusivity || ex.exclusive || pt.exclusivity || '',
          governing_law: agreement?.governing_state || '',
          property_region: deal?.state || agreement?.property_zip || '',
          termination_rights: ex.termination_rights || '',
          retainer_amount: (ex.retainer_amount ?? ex.retainer?.amount ?? ''),
          retainer_currency: (ex.retainer_currency ?? ex.retainer?.currency ?? 'USD')
        };

        setTerms(initialTerms);
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

  /* Removed AI flow per requirements */
  const runAiFlow = async () => { /* no-op */ };
    setLoading(true);
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Use placeholder contract for demo
    const placeholderDraft = `# BUYER REPRESENTATION AGREEMENT

**Generated by AI Contract Flow**

---

## PARTIES

**BUYER (Investor):** [Investor Name]  
**AGENT:** [Agent Name], [Brokerage]

---

## 1. SCOPE OF REPRESENTATION

Agent agrees to represent Buyer in the search, evaluation, negotiation, and acquisition of investment real estate properties in the following markets: [Target Markets].

## 2. PROPERTY CRITERIA

- **Property Types:** Multifamily, Single Family, Commercial
- **Price Range:** $100,000 - $1,000,000
- **Investment Strategy:** Buy & Hold, Value-Add, BRRRR
- **Target Returns:** 8%+ Cash-on-Cash Return

## 3. AGENT DUTIES

Agent agrees to:
- Provide access to on-market and off-market deal flow
- Conduct initial property analysis and due diligence support
- Coordinate property tours and inspections
- Negotiate on behalf of Buyer
- Facilitate transaction through closing

## 4. COMPENSATION

- **Commission:** 2.5-3% of purchase price, paid at closing
- If seller pays commission, no additional fee from Buyer
- **Retainer:** $0 (performance-based only)

## 5. TERM

This Agreement shall remain in effect for 12 months from the date of execution.

## 6. EXCLUSIVITY

Buyer agrees to work exclusively with Agent for properties in the defined markets during the term of this Agreement.

## 7. CONFIDENTIALITY

Both parties agree to maintain confidentiality of all proprietary information shared during the course of this relationship.

## 8. TERMINATION

Either party may terminate this Agreement with 30 days written notice.

---

**SIGNATURES:**

_________________________  
Investor (Buyer)  
Date: _______________

_________________________  
Agent  
Date: _______________

---

*This is a placeholder contract for demonstration purposes.*
`;

    const placeholderAnalysis = {
      overallRisk: 'Low',
      redFlags: [
        'Commission structure should specify exact percentage',
        'Consider adding dispute resolution clause'
      ],
      recommendations: [
        'Add specific termination conditions',
        'Include clause for property inspection contingencies',
        'Specify communication frequency expectations'
      ]
    };

    setAiFlowResult({
      ok: true,
      draft: placeholderDraft,
      analysis: placeholderAnalysis,
      parties: {
        investor: 'Demo Investor',
        agent: 'Demo Agent'
      }
    });
    setDraft(placeholderDraft);
    setAnalysis(placeholderAnalysis);
    setStep(3);
    setLoading(false);
  };

  // Removed chat analysis; proceed directly to edit with preloaded deal/agreement terms
  const analyze = async () => {
    setStep(2);
  };

  const updateTerm = (k, v) => {
    setTerms(prev => ({ ...prev, [k]: v }));
  };

  const generate = async () => {
    if (!templateId) {
      alert("Please select a template");
      return;
    }

    setSaving(true);
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Generate placeholder contract from template
    const templateName = CONTRACT_TEMPLATES.find(t => t.id === templateId)?.name || "Contract";
    
    const generatedDraft = `# ${templateName.toUpperCase()}

**Generated from Template: ${templateId}**

---

## PARTIES

**BUYER/INVESTOR:** ${terms["investor_name"] || "[Investor Name]"}  
**AGENT:** ${terms["agent_name"] || "[Agent Name]"}, ${terms["agent_brokerage"] || "[Brokerage]"}

---

## 1. PURPOSE

This ${templateName} is entered into for the purpose of establishing a professional relationship between the parties for real estate investment services.

## 2. SCOPE

**Target Markets:** ${terms["Target Markets"] || "[Markets]"}  
**Property Types:** ${terms["Property Types"] || "[Property Types]"}  
**Price Range:** ${terms["Price Range"] || "[Price Range]"}

## 3. COMPENSATION

Compensation: ${terms["fee_structure"] || "[fee structure]"}

## 4. TERM

This Agreement shall be effective from ${terms["term_start"] || "[start]"} to ${terms["term_end"] || "[end]"}.
If applicable, Agreement Length: ${terms["agreement_length_days"] || "[days]"} days.

## 5. DUTIES AND OBLIGATIONS

### Agent Responsibilities:
- Identify suitable investment properties
- Provide market analysis and due diligence support
- Negotiate on behalf of the investor
- Coordinate inspections and closing

### Investor Responsibilities:
- Provide clear investment criteria
- Respond to opportunities in a timely manner
- Provide proof of funds when required

## 6. CONFIDENTIALITY

Both parties agree to maintain strict confidentiality regarding all proprietary information, deal terms, and financial details shared during this engagement.

## 7. TERMINATION

Either party may terminate this Agreement with 30 days written notice.

---

**SIGNATURES:**

_________________________  
${terms["investor_name"] || "Investor"}  
Date: _______________

_________________________  
${terms["agent_name"] || "Agent"}  
License #: ${terms["agent_license_number"] || "_______________"}  
Date: _______________

---

*This is a placeholder contract generated from template for demonstration purposes.*
`;
    
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
                onClick={analyze} 
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
                  {FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex flex-col">
                      <Label className="text-xs text-slate-600 mb-1">{label}</Label>
                      <Input
                        value={terms[key] ?? ""}
                        onChange={(e) => updateTerm(key, e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  ))}

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
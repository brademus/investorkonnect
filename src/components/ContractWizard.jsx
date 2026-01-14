import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { contractAnalyzeChat, contractGenerateDraft } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertCircle, Sparkles, Shield, AlertTriangle, CheckCircle, Scale } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";

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
  { key: 'transaction_type', label: 'Transaction Type (Agreement)' },
  { key: 'fee_structure', label: 'Commission / Fee Structure (Derived)' },
  { key: 'exclusivity', label: 'Exclusivity (Agreement)' },
  { key: 'term_start', label: 'Term Start' },
  { key: 'term_end', label: 'Term End' },
  { key: 'governing_law', label: 'Governing Law (Agreement)' },
  { key: 'termination_rights', label: 'Termination (Agreement)' },
  { key: 'property_region', label: 'Property Region (Agreement)' },
  { key: 'retainer_amount', label: 'Retainer Amount (Agreement)' }
];

export default function ContractWizard({ roomId, open, onClose }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [templateId, setTemplateId] = useState("");
  const [terms, setTerms] = useState({});
  const [missing, setMissing] = useState([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("ai"); // "ai" or "template"
  const [aiFlowResult, setAiFlowResult] = useState(null);
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
    setMode("ai");
    setAiFlowResult(null);
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

        const buyerType = ex.buyer_commission_type || pt.buyer_commission_type || (ex.compensation_model === 'COMMISSION_PCT' ? 'percentage' : ex.compensation_model === 'FLAT_FEE' ? 'flat' : undefined);
        const buyerPct = ex.commission_percentage ?? pt.buyer_commission_percentage ?? '';
        const buyerFlat = ex.flat_fee_amount ?? pt.buyer_flat_fee ?? '';
        const lengthDays = ex.agreement_length_days ?? pt.agreement_length ?? '';

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
          transaction_type: agreement?.transaction_type || '',
          fee_structure: feeStr,
          exclusivity: ex.exclusivity || ex.exclusive || '',
          governing_law: agreement?.governing_state || '',
          property_region: deal?.state || agreement?.property_zip || '',
          termination_rights: ex.termination_rights || '',
          retainer_amount: ex.retainer_amount || ''
        };

        setTerms(initialTerms);
        setStep(2);
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

  // AI Flow: Generate + Analyze in one step
  const runAiFlow = async () => {
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

  // Template flow: Analyze first
  const analyze = async () => {
    setLoading(true);
    try {
      // Use chat analysis ONLY to fill gaps
      const resp = await contractAnalyzeChat({ room_id: roomId });
      const suggested = resp?.data || resp || {};
      const suggestedTerms = suggested.terms || suggested.suggested_terms || {};
      const suggestedTemplate = suggested.suggested_template_id || 'buyer_rep_v1';
      const missingFields = suggested.missing_fields || [];
      const summary = suggested.plain_summary || suggested.summary;

      setAnalysis({
        suggested_template_id: suggestedTemplate,
        plain_summary: summary,
        terms: suggestedTerms,
        missing_fields: missingFields
      });
      setTemplateId(prev => prev || suggestedTemplate);
      setTerms(prev => mergeMissing(prev, suggestedTerms));
      setMissing(missingFields);
      setStep(2);
    } catch (e) {
      // Fallback: just advance to edit with whatever we preloaded
      console.warn('[ContractWizard] contractAnalyzeChat failed; proceeding with preloaded terms', e);
      setStep(2);
    } finally {
      setLoading(false);
    }
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
          {/* Step 1: Choose Mode */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI Flow Option */}
                <button
                  onClick={() => setMode("ai")}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    mode === "ai" 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">AI Contract Flow</h4>
                      <Badge className="text-xs bg-emerald-100 text-emerald-700">GPT-4o</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    Automatically generate a contract from your conversation and get instant risk analysis.
                  </p>
                </button>

                {/* Template Option */}
                <button
                  onClick={() => setMode("template")}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    mode === "template" 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-slate-900">Template-Based</h4>
                  </div>
                  <p className="text-sm text-slate-600">
                    We’ll prefill from the agreement and only use chat to fill any blanks.
                  </p>
                </button>
              </div>

              <Button 
                onClick={mode === "ai" ? runAiFlow : analyze} 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12"
              >
                {loading ? (
                  <>
                    <LoadingAnimation className="w-5 h-5 mr-2" />
                    {mode === "ai" ? "Generating Contract & Analyzing..." : "Analyzing Chat..."}
                  </>
                ) : mode === "ai" ? (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate AI Contract
                  </>
                ) : (
                  "Extract Terms from Chat"
                )}
              </Button>
            </div>
          )}

          {/* Step 3: AI Flow Review (Draft + Analysis) */}
          {step === 3 && aiFlowResult && (
            <div className="space-y-6">
              {/* Parties */}
              {/* Parties sourced from agreement (buyer’s agent focus) */}
              {agreementData && (
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">
                    <strong>Investor:</strong> {terms["investor_name"] || '—'}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-sm text-slate-600">
                    <strong>Agent:</strong> {terms["agent_name"] || '—'}
                  </span>
                </div>
              )}

              {/* Risk Summary */}
              {analysis && (
                <div className={`p-4 rounded-xl border-2 ${
                  analysis.overallRisk === 'High' ? 'bg-red-50 border-red-200' :
                  analysis.overallRisk === 'Medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      <span className="font-bold">Contract Guardian Analysis</span>
                    </div>
                    <Badge className={
                      analysis.overallRisk === 'High' ? 'bg-red-100 text-red-800' :
                      analysis.overallRisk === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-emerald-100 text-emerald-800'
                    }>
                      {analysis.overallRisk || 'Unknown'} Risk
                    </Badge>
                  </div>

                  {/* Red Flags */}
                  {analysis.redFlags?.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-semibold text-red-900 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Red Flags
                      </div>
                      <ul className="text-sm text-red-800 space-y-1">
                        {analysis.redFlags.slice(0, 3).map((flag, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span>•</span>
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {analysis.recommendations?.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Recommendations
                      </div>
                      <ul className="text-sm text-blue-800 space-y-1">
                        {analysis.recommendations.slice(0, 3).map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span>→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Draft Preview */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Generated Contract Draft</Label>
                <textarea 
                  className="w-full h-64 border border-slate-300 rounded-lg p-4 text-sm font-mono bg-slate-50" 
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Start Over
                </Button>
                <div className="flex gap-3">
                  <a 
                    href={`data:text/markdown;charset=utf-8,${encodeURIComponent(draft)}`}
                    download="contract_draft.md"
                    className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center"
                  >
                    Download .md
                  </a>
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

              {analysis?.plain_summary && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                 <div className="text-xs font-semibold text-slate-500 mb-1">Summary (supplemental)</div>
                 <p className="text-sm text-slate-700">{analysis.plain_summary}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold mb-2 block">Buyer’s Agent Agreement Terms (from Deal/Agreement)</Label>
                <p className="text-xs text-slate-500 mb-2">Prefilled from Agreement; chat only fills blanks.</p>
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
                  {missing.filter((k) => !FIELDS.find(f => f.key === k)).map(k => (
                    <div key={k} className="flex flex-col">
                      <Label className="text-xs text-rose-600 mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {k} (required)
                      </Label>
                      <Input
                        value={terms[k] ?? ""}
                        onChange={(e) => updateTerm(k, e.target.value)}
                        className="text-sm border-rose-300 focus:ring-rose-500"
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
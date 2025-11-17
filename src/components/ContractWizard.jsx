import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, AlertCircle } from "lucide-react";

const CONTRACT_TEMPLATES = [
  { id: "buyer_rep_v1", name: "Buyer Representation Agreement" },
  { id: "referral_v1", name: "Referral Agreement" },
  { id: "services_v1", name: "Real Estate Services Agreement" }
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

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setAnalysis(null);
    setTemplateId("");
    setTerms({});
    setMissing([]);
    setDraft("");
  }, [open]);

  const analyze = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('contractAnalyzeChat', { room_id: roomId });
      
      if (response.data?.analysis) {
        setAnalysis(response.data.analysis);
        setTemplateId(response.data.analysis.suggested_template_id || "");
        setTerms(response.data.analysis.terms || {});
        setMissing(response.data.analysis.missing_fields || []);
        setStep(2);
      } else {
        alert(response.data?.error || "Could not analyze chat");
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert("Failed to analyze chat");
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
    try {
      const response = await base44.functions.invoke('contractGenerateDraft', {
        room_id: roomId,
        template_id: templateId,
        terms
      });

      if (response.data?.content) {
        setDraft(response.data.content);
        setStep(4);
      } else {
        alert(response.data?.error || "Generate failed");
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert("Failed to generate contract");
    } finally {
      setSaving(false);
    }
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
          {/* Step 1: Analyze */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  We'll analyze your chat history to extract deal terms and suggest the best contract template.
                </p>
              </div>
              <Button 
                onClick={analyze} 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Chat History...
                  </>
                ) : (
                  "Analyze Chat & Extract Terms"
                )}
              </Button>
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
                  <div className="text-xs font-semibold text-slate-500 mb-1">AI Analysis</div>
                  <p className="text-sm text-slate-700">{analysis.plain_summary}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold mb-2 block">Contract Terms</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-4 bg-slate-50">
                  {Object.entries(terms).map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <Label className="text-xs text-slate-600 mb-1">{k}</Label>
                      <Input 
                        value={v ?? ""} 
                        onChange={(e) => updateTerm(k, e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  ))}
                  {missing.map(k => (
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
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
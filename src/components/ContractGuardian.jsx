import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle, Loader2, Sparkles, FileWarning, Scale } from "lucide-react";
import { base44 } from "@/api/base44Client";


/**
 * CONTRACT GUARDIAN - AI Risk Analysis using OpenAI Prompt ID
 * Uses GPT-4o for high-stakes legal analysis
 * Prompt ID: pmpt_69251b41d54c81909c072edf566f67ce0447ce55c0cd42b6
 */
export function ContractGuardian({ contractText, userProfile, onSuggestionApply }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const analyzeContract = async () => {
    setError("AI analysis has been removed. This feature is disabled.");
    setAnalyzing(false);
  };

  const getRiskColor = (risk) => {
    const colors = {
      Low: 'emerald',
      Medium: 'yellow',
      High: 'red'
    };
    return colors[risk] || 'slate';
  };

  const RiskIcon = ({ risk }) => {
    if (risk === 'High') return <AlertTriangle className="w-4 h-4 text-red-600" />;
    if (risk === 'Medium') return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <CheckCircle className="w-4 h-4 text-emerald-600" />;
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Contract Guardian</h3>
            <p className="text-sm text-slate-600">Legal analysis disabled (AI removed)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            <Scale className="w-3 h-3 mr-1" />
            GPT-4o
          </Badge>
          <Button
            onClick={analyzeContract}
            disabled={analyzing || !contractText}
            size="sm"
            className="gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze Contract
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {!analysis && !analyzing && !error && (
        <p className="text-sm text-slate-600">
          Click "Analyze Contract" to get AI-powered risk assessment and safer alternatives based on your profile.
        </p>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Overall Risk */}
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
            <RiskIcon risk={analysis.overallRisk} />
            <div>
              <span className="text-sm text-slate-600">Overall Risk Level: </span>
              <Badge className={`bg-${getRiskColor(analysis.overallRisk)}-100 text-${getRiskColor(analysis.overallRisk)}-800`}>
                {analysis.overallRisk}
              </Badge>
            </div>
          </div>

          {/* Red Flags */}
          {analysis.redFlags?.length > 0 && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Red Flags
              </h4>
              <ul className="space-y-1">
                {analysis.redFlags.map((flag, idx) => (
                  <li key={idx} className="text-sm text-red-800 flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Clause Analysis */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900">Clause-by-Clause Analysis</h4>
            {analysis.clauses?.map((clause, idx) => (
              <div key={idx} className="p-4 bg-white rounded-lg border-2 border-slate-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <RiskIcon risk={clause.risk} />
                    <span className="font-semibold text-slate-900">{clause.section}</span>
                  </div>
                  <Badge className={`bg-${getRiskColor(clause.risk)}-100 text-${getRiskColor(clause.risk)}-800`}>
                    {clause.risk} Risk
                  </Badge>
                </div>
                <p className="text-sm text-slate-700 mb-3">{clause.concern}</p>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
                  <p className="text-xs font-semibold text-emerald-900 mb-1">Safer Alternative:</p>
                  <p className="text-sm text-emerald-800">{clause.suggestion}</p>
                  {onSuggestionApply && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 text-xs"
                      onClick={() => onSuggestionApply(clause.suggestion)}
                    >
                      Apply This Change
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Missing Protections */}
          {analysis.missingProtections?.length > 0 && (
            <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <FileWarning className="w-4 h-4" />
                Missing Protections
              </h4>
              <ul className="space-y-1">
                {analysis.missingProtections.map((item, idx) => (
                  <li key={idx} className="text-sm text-amber-800 flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Negotiation Points */}
          {analysis.negotiationPoints?.length > 0 && (
            <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Key Negotiation Points
              </h4>
              <ul className="space-y-1">
                {analysis.negotiationPoints.map((point, idx) => (
                  <li key={idx} className="text-sm text-purple-800 flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">→</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations?.length > 0 && (
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary */}
          {analysis.summary && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">Summary</h4>
              <p className="text-sm text-slate-700">{analysis.summary}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
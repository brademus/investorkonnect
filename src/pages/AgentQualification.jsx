import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import LoadingAnimation from "@/components/LoadingAnimation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, ChevronRight, ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";

const DEAL_TYPES = [
  {
    title: "1. Wholesale Assignment",
    description: "An investor contracts a property at a discounted price and assigns their purchase rights to a third-party buyer for a fee.",
    bullets: [
      "You may represent the end buyer or co-broker on the disposition side.",
      "You must understand assignment addendums.",
      "Your broker must allow assignment transactions."
    ]
  },
  {
    title: "2. Double Close (Back-to-Back Closing)",
    description: "Investor purchases property and resells it the same day (A→B→C). Two closings occur, sometimes using transactional funding.",
    bullets: [
      "You may represent the investor on resale.",
      "Timelines are tight.",
      "You must be comfortable with investor margin visibility."
    ]
  },
  {
    title: "3. Novation Agreement",
    description: "Seller allows investor to market property on MLS and sell conventionally while remaining on title until resale. Investor earns the spread.",
    bullets: [
      "You may list the property.",
      "You must understand novation structure.",
      "Your broker must allow novation listings."
    ]
  },
  {
    title: "4. Subject-To (Sub2)",
    description: "Investor purchases property subject to the existing mortgage staying in place. Title transfers but the existing loan remains in the seller's name.",
    bullets: [
      "These are not always MLS transactions.",
      "Must understand due-on-sale clause implications.",
      "Broker approval required."
    ]
  },
  {
    title: "5. Seller Financing",
    description: "Seller acts as the lender and finances part or all of the purchase. A promissory note is created and recorded.",
    bullets: [
      "You must understand creative deal structuring.",
      "May require attorney coordination.",
      "Broker must allow creative finance deals."
    ]
  },
  {
    title: "6. Value-Add / BRRRR",
    description: "Buy → Renovate → Rent → Refinance → Repeat.",
    bullets: [
      "You may represent the investor on acquisition and help source off-market or distressed properties.",
      "Rental comps and ARV analysis are critical."
    ]
  }
];

function Step1({ onContinue }) {
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-[#E3C567] mb-3">Do You Qualify to Be an Investor Konnect Agent?</h1>
      <p className="text-[#808080] mb-8">This platform is specifically for investor-type real estate transactions. Please read each deal type below before proceeding.</p>

      <div className="space-y-4 mb-10">
        {DEAL_TYPES.map((dt, i) => (
          <div key={i} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-5">
            <h3 className="text-[#FAFAFA] font-semibold mb-2">{dt.title}</h3>
            <p className="text-[#808080] text-sm mb-3">{dt.description}</p>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#E3C567] mb-1">What this means for you:</p>
              {dt.bullets.map((b, j) => (
                <p key={j} className="text-xs text-[#808080] pl-3">• {b}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6 mb-8 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={check1}
            onChange={e => setCheck1(e.target.checked)}
            className="mt-1 accent-[#E3C567]"
          />
          <span className="text-sm text-[#FAFAFA]">I confirm that I understand the above investor transaction structures and that I and my broker are willing and able to participate in these types of transactions.</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={check2}
            onChange={e => setCheck2(e.target.checked)}
            className="mt-1 accent-[#E3C567]"
          />
          <span className="text-sm text-[#FAFAFA]">I understand that violation of platform rules or interfering with investor transactions may result in immediate removal.</span>
        </label>
      </div>

      <Button
        onClick={onContinue}
        disabled={!check1 || !check2}
        className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold h-12 disabled:opacity-40"
      >
        Continue <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

const QUESTIONS = [
  // CAT 1
  { id: "wholesale_count", label: "How many wholesale deals have you participated in?", type: "radio", options: [
    { label: "None", value: "none", pts: 0 },
    { label: "1–5", value: "1-5", pts: 4 },
    { label: "6–15", value: "6-15", pts: 7 },
    { label: "15+", value: "15+", pts: 10 },
  ]},
  { id: "creative_types", label: "Which of the following creative deal types have you worked with? (Check all that apply)", type: "checkbox", options: [
    { label: "Double Close", value: "double_close", pts: 2 },
    { label: "Novation", value: "novation", pts: 2 },
    { label: "Subject-To (Sub2)", value: "sub2", pts: 2 },
    { label: "Seller Financing", value: "seller_financing", pts: 2 },
    { label: "BRRRR / Value-Add", value: "brrrr", pts: 2 },
  ], maxPts: 10 },
  { id: "investor_pct", label: "What percentage of your current business comes from investor clients?", type: "radio", options: [
    { label: "0–10%", value: "0-10", pts: 2 },
    { label: "10–25%", value: "10-25", pts: 5 },
    { label: "25–50%", value: "25-50", pts: 8 },
    { label: "50%+", value: "50+", pts: 10 },
  ]},
  // CAT 2
  { id: "broker_assignments", label: "Does your broker allow assignment of contract transactions?", type: "radio", isAutoReject: true, options: [
    { label: "Yes", value: "yes", pts: 5 },
    { label: "No", value: "no", pts: 0, autoReject: true },
  ]},
  { id: "broker_creative", label: "Does your broker allow creative finance deals (novation, sub2, seller finance)?", type: "radio", options: [
    { label: "Yes", value: "yes", pts: 5 },
    { label: "No", value: "no", pts: 0 },
  ]},
  { id: "broker_confirm", label: "Are you willing to provide broker confirmation if requested?", type: "radio", options: [
    { label: "Yes", value: "yes", pts: 5 },
    { label: "No", value: "no", pts: 0 },
  ]},
  { id: "broker_conflicts", label: "Have you had any broker conflicts related to investor deals in the past?", type: "radio", options: [
    { label: "No issues", value: "none", pts: 5 },
    { label: "Minor issues", value: "minor", pts: 2 },
    { label: "Major past conflict", value: "major", pts: 0 },
  ]},
  // CAT 3
  { id: "metrics_known", label: "Which of the following metrics do you know how to calculate? (Check all that apply)", type: "checkbox", options: [
    { label: "ARV (After Repair Value)", value: "arv", pts: 2 },
    { label: "MAO (Maximum Allowable Offer)", value: "mao", pts: 2 },
    { label: "Cap Rate", value: "cap_rate", pts: 2 },
    { label: "Cash-on-Cash Return", value: "coc", pts: 2 },
    { label: "Repair estimate methodology", value: "repair", pts: 2 },
  ], maxPts: 10 },
  { id: "comps_speed", label: "How quickly can you typically deliver comps for a deal?", type: "radio", options: [
    { label: "Under 2 hours", value: "2hr", pts: 5 },
    { label: "Same day", value: "same_day", pts: 3 },
    { label: "24+ hours", value: "24hr", pts: 1 },
  ]},
  { id: "low_offers", label: "Are you comfortable submitting low offers on behalf of investor clients?", type: "radio", options: [
    { label: "Yes, comfortable", value: "yes", pts: 5 },
    { label: "Somewhat hesitant", value: "hesitant", pts: 2 },
    { label: "Not comfortable", value: "no", pts: 0 },
  ]},
  { id: "distressed_sellers", label: "Are you comfortable working with distressed sellers?", type: "radio", options: [
    { label: "Yes, comfortable", value: "yes", pts: 5 },
    { label: "Neutral", value: "neutral", pts: 2 },
    { label: "Uncomfortable", value: "no", pts: 0 },
  ]},
  // CAT 4
  { id: "no_bypass", label: "Do you agree not to bypass the platform or work directly with platform-introduced investors outside the platform?", type: "radio", isHighRisk: true, options: [
    { label: "Yes", value: "yes", pts: 10 },
    { label: "Hesitation / No", value: "no", pts: 0, highRisk: true },
  ]},
  { id: "margin_visibility", label: "Are you comfortable with investors having visible margins on deals?", type: "radio", options: [
    { label: "Yes", value: "yes", pts: 5 },
    { label: "Uncomfortable", value: "no", pts: 0 },
  ]},
  { id: "close_timeline", label: "Are you comfortable with 7–14 day close timelines?", type: "radio", options: [
    { label: "Yes", value: "yes", pts: 5 },
    { label: "Prefer 30+ days", value: "prefer_30", pts: 1 },
  ]},
  { id: "investor_reference", label: "Can you provide a reference from an investor client?", type: "radio", options: [
    { label: "Yes", value: "yes", pts: 5 },
    { label: "No", value: "no", pts: 0 },
  ]},
];

function Step2({ onSubmit, submitting }) {
  const [answers, setAnswers] = useState({});
  // Expose raw answers to parent
  const getAnswers = () => answers;

  const setRadio = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const toggleCheck = (id, value) => {
    setAnswers(prev => {
      const current = prev[id] || [];
      return { ...prev, [id]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] };
    });
  };

  const allAnswered = QUESTIONS.every(q => {
    if (q.type === "radio") return !!answers[q.id];
    // Checkbox questions are optional (selecting none is valid)
    return true;
  });

  const handleSubmit = () => {
    // Check auto-reject first
    const brokerAns = answers["broker_assignments"];
    if (brokerAns === "no") {
      onSubmit({ outcome: "rejected", tier: "rejected", autoReject: true });
      return;
    }

    let totalScore = 0;
    for (const q of QUESTIONS) {
      if (q.type === "radio") {
        const ans = answers[q.id];
        const opt = q.options.find(o => o.value === ans);
        if (opt) totalScore += opt.pts;
      } else if (q.type === "checkbox") {
        const checked = answers[q.id] || [];
        let pts = 0;
        for (const v of checked) {
          const opt = q.options.find(o => o.value === v);
          if (opt) pts += opt.pts;
        }
        totalScore += Math.min(pts, q.maxPts || 999);
      }
    }

    let tier, outcome;
    if (totalScore >= 85) { tier = "elite"; outcome = "approved"; }
    else if (totalScore >= 70) { tier = "approved"; outcome = "approved"; }
    else if (totalScore >= 50) { tier = "conditional"; outcome = "conditional"; }
    else { tier = "rejected"; outcome = "rejected"; }

    onSubmit({ outcome, tier, score: totalScore, answers });
  };

  const categories = [
    { label: "Category 1 — Experience With Investor Deals", ids: ["wholesale_count","creative_types","investor_pct"] },
    { label: "Category 2 — Broker Approval & Compliance", ids: ["broker_assignments","broker_creative","broker_confirm","broker_conflicts"] },
    { label: "Category 3 — Investor Competency", ids: ["metrics_known","comps_speed","low_offers","distressed_sellers"] },
    { label: "Category 4 — Alignment & Platform Risk", ids: ["no_bypass","margin_visibility","close_timeline","investor_reference"] },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-[#E3C567] mb-3">Agent Vetting Questionnaire</h1>
      <p className="text-[#808080] mb-8">Answer honestly. Your responses determine your eligibility and platform tier.</p>

      <div className="space-y-8">
        {categories.map((cat, ci) => (
          <div key={ci}>
            <h2 className="text-sm font-semibold text-[#E3C567] uppercase tracking-wider mb-4 border-b border-[#1F1F1F] pb-2">{cat.label}</h2>
            <div className="space-y-6">
              {QUESTIONS.filter(q => cat.ids.includes(q.id)).map(q => (
                <div key={q.id} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-5">
                  <p className="text-sm font-medium text-[#FAFAFA] mb-3">{q.label}</p>
                  {q.type === "radio" && (
                    <div className="space-y-2">
                      {q.options.map(opt => (
                        <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.value}
                            checked={answers[q.id] === opt.value}
                            onChange={() => setRadio(q.id, opt.value)}
                            className="accent-[#E3C567]"
                          />
                          <span className="text-sm text-[#FAFAFA]">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "checkbox" && (
                    <div className="space-y-2">
                      {q.options.map(opt => (
                        <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(answers[q.id] || []).includes(opt.value)}
                            onChange={() => toggleCheck(q.id, opt.value)}
                            className="accent-[#E3C567]"
                          />
                          <span className="text-sm text-[#FAFAFA]">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !allAnswered}
          className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold h-12 disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Submit Questionnaire"}
        </Button>
        {!allAnswered && (
          <p className="text-center text-sm text-[#808080] mt-2">Please answer all required questions above</p>
        )}
      </div>
    </div>
  );
}

function OutcomeScreen({ result, onContinue }) {
  const { outcome, tier, autoReject } = result;

  if (outcome === "approved") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
        </div>
        <h1 className="text-3xl font-bold text-[#FAFAFA] mb-3">Congratulations — You're Approved!</h1>
        <p className="text-[#808080] mb-8">You've met the requirements to join Investor Konnect as an agent. Let's build your profile.</p>
        <Button onClick={onContinue} className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold px-8 h-12">
          Continue to Profile Setup <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  if (outcome === "conditional") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-[#F59E0B]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-[#F59E0B]" />
        </div>
        <h1 className="text-3xl font-bold text-[#FAFAFA] mb-3">Your Application Is Under Review</h1>
        <p className="text-[#808080] mb-8">Based on your answers, our team needs to review your profile before you can proceed. We'll notify you once a decision has been made.</p>
        <Button onClick={() => base44.auth.logout(createPageUrl("Home"))} variant="outline" className="bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#1F1F1F] rounded-full font-semibold px-8 h-12">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <XCircle className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-3xl font-bold text-[#FAFAFA] mb-3">Unfortunately, you're not eligible at this time.</h1>
      <p className="text-[#808080] mb-8">
        {autoReject
          ? "Your broker does not currently allow assignment of contract transactions, which is required for this platform."
          : "Based on your responses, this platform may not be the right fit. Our deals require specific broker permissions and investor experience."}
      </p>
      <div className="flex flex-col items-center gap-3 mt-6">
        <Button onClick={() => base44.auth.logout(createPageUrl("Home"))} variant="outline" className="bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#1F1F1F] rounded-full font-semibold px-8 h-12">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
        <a href="https://investorkonnect.com" className="text-[#E3C567] underline text-sm">Learn More</a>
      </div>
    </div>
  );
}

export default function AgentQualification() {
  const navigate = useNavigate();
  const { profile, loading } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // If already qualified, redirect based on tier
  useEffect(() => {
    if (loading || !profile) return;
    if (profile.qualification_status === 'completed') {
      const tier = profile.qualification_tier;
      if (tier === 'conditional') {
        navigate(createPageUrl("ConditionalReview"), { replace: true });
      } else if (tier === 'rejected') {
        // Show rejected outcome directly
        setResult({ outcome: "rejected", tier: "rejected", autoReject: !!profile.metadata?.qualification_answers?.broker_assignments && profile.metadata.qualification_answers.broker_assignments === "no" });
        setStep(3);
      } else {
        // approved / elite — skip questionnaire, go to onboarding (or beyond if already done)
        if (profile.onboarding_completed_at) {
          navigate(createPageUrl("IdentityVerification"), { replace: true });
        } else {
          navigate(createPageUrl("AgentOnboarding"), { replace: true });
        }
      }
    }
  }, [loading, profile]);

  const handleQuestionnaire = async ({ outcome, tier, score, autoReject, answers }) => {
    setSubmitting(true);
    try {
      // Ensure we have a profile ID — refetch if needed
      let pid = profile?.id;
      if (!pid) {
        const user = await base44.auth.me();
        if (user?.email) {
          const profs = await base44.entities.Profile.filter({ email: user.email.toLowerCase().trim() });
          if (profs?.[0]?.id) pid = profs[0].id;
        }
      }

      if (!pid) {
        toast.error("Could not find your profile. Please try again.");
        setSubmitting(false);
        return;
      }

      await base44.entities.Profile.update(pid, {
        qualification_status: "completed",
        qualification_tier: tier,
        metadata: {
          ...(profile?.metadata || {}),
          qualification_answers: answers || {},
          qualification_score: score || 0,
        },
      });

      // If conditional (50-69), notify admins via backend
      if (tier === "conditional") {
        try {
          const notifyRes = await base44.functions.invoke('notifyAdminConditionalAgent', {
            agentProfileId: pid,
            agentName: profile?.full_name || profile?.email || 'Unknown Agent',
            score: score || 0,
          });
          console.log('[AgentQualification] Admin notify result:', notifyRes?.data);
        } catch (err) {
          console.error('[AgentQualification] Admin notify failed:', err);
        }
      }

      setResult({ outcome, tier, autoReject });
      setStep(3);
    } catch (e) {
      console.error('[AgentQualification] Save failed:', e);
      toast.error("Failed to save results. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOutcomeContinue = () => {
    // Bust profile cache
    try { sessionStorage.removeItem('__ik_profile_cache'); } catch (_) {}
    if (result?.outcome === "approved") {
      navigate(createPageUrl("AgentOnboarding"), { replace: true });
    } else if (result?.outcome === "conditional") {
      navigate(createPageUrl("ConditionalReview"), { replace: true });
    } else {
      navigate(createPageUrl("Home"), { replace: true });
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {step === 1 && <Step1 onContinue={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setStep(2); }} />}
      {step === 2 && <Step2 onSubmit={handleQuestionnaire} submitting={submitting} />}
      {step === 3 && result && <OutcomeScreen result={result} onContinue={handleOutcomeContinue} />}
    </div>
  );
}
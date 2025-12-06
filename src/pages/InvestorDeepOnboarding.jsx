import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

const INVESTMENT_STRATEGIES = [
  { value: "buy_hold", label: "Buy & Hold" },
  { value: "brrrr", label: "BRRRR" },
  { value: "fix_flip", label: "Fix & Flip" },
  { value: "wholesaling", label: "Wholesaling" },
  { value: "str", label: "Short-Term Rentals" },
  { value: "mtr", label: "Mid-Term Rentals" },
  { value: "commercial", label: "Commercial" },
  { value: "development", label: "Development" },
];

const PROPERTY_TYPES = [
  { value: "sfh", label: "Single Family" },
  { value: "multi_2_4", label: "Multi-Family (2-4)" },
  { value: "multi_5_plus", label: "Multi-Family (5+)" },
  { value: "commercial", label: "Commercial" },
  { value: "land", label: "Land" },
  { value: "vacation", label: "Vacation Rental" },
];

const FINANCING_METHODS = [
  { value: "all_cash", label: "All Cash" },
  { value: "conventional", label: "Conventional Loan" },
  { value: "hard_money", label: "Hard Money" },
  { value: "dscr", label: "DSCR Loan" },
  { value: "partnerships", label: "Partnerships/Syndication" },
  { value: "seller_financing", label: "Seller Financing" },
];

const COMMUNICATION_PREFS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text/SMS" },
  { value: "video", label: "Video Call" },
];

/**
 * INVESTOR DEEP ONBOARDING - 8-step comprehensive onboarding
 */
export default function InvestorDeepOnboarding() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    // Step 1: Basic Profile
    full_name: '',
    phone: '',
    company: '',
    
    // Step 2: Experience & Accreditation
    investor_description: '',
    deals_closed_24mo: '',
    typical_deal_size: '',
    accredited_investor: '',
    investment_holding_structures: [],
    
    // Step 3: Capital & Financing
    capital_available_12mo: '',
    financing_methods: [],
    financing_lined_up: '',
    pof_verification_intent: '',
    
    // Step 4: Strategy & Deals
    investment_strategies: [],
    primary_strategy: '',
    property_types: [],
    property_condition: '',
    
    // Step 5: Target Markets
    primary_state: '',
    specific_cities_counties: '',
    market_area_importance: '',
    state_price_min: '',
    state_price_max: '',
    
    // Step 6: Deal Structure
    deal_types_open_to: [],
    preferred_deal_structure: [],
    most_important_now: '',
    target_hold_period: '',
    
    // Step 7: Risk & Speed
    decision_speed_on_deal: '',
    typical_earnest_money_pct: '',
    comfortable_non_refundable_em: '',
    most_recent_deal: '',
    
    // Step 8: Agent Working Style
    what_from_agent: [],
    communication_preferences: [],
    preferred_agent_response_time: '',
    agent_deal_breakers: '',
    anything_else_for_agent: '',
  });

  const TOTAL_STEPS = 8;

  useEffect(() => {
    if (profile) {
      const metadata = profile.metadata || {};
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        company: profile.company || '',
        primary_state: profile.target_state || metadata.targetMarkets?.primary_state || '',
        // Load all metadata sections
        ...(metadata.basicProfile || {}),
        ...(metadata.capitalFinancing || {}),
        ...(metadata.strategyDeals || {}),
        ...(metadata.targetMarkets || {}),
        ...(metadata.dealStructure || {}),
        ...(metadata.riskSpeed || {}),
        ...(metadata.agentWorking || {}),
        ...(metadata.experienceAccreditation || {}),
      }));
      setLoading(false);
    }
  }, [profile]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field]?.includes(value)
        ? prev[field].filter(v => v !== value)
        : [...(prev[field] || []), value]
    }));
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const metadata = {
        basicProfile: {
          investor_description: formData.investor_description,
          deals_closed_24mo: formData.deals_closed_24mo,
          typical_deal_size: formData.typical_deal_size,
        },
        capitalFinancing: {
          capital_available_12mo: formData.capital_available_12mo,
          financing_methods: formData.financing_methods,
          financing_lined_up: formData.financing_lined_up,
          pof_verification_intent: formData.pof_verification_intent,
        },
        strategyDeals: {
          investment_strategies: formData.investment_strategies,
          primary_strategy: formData.primary_strategy,
          property_types: formData.property_types,
          property_condition: formData.property_condition,
        },
        targetMarkets: {
          primary_state: formData.primary_state,
          specific_cities_counties: formData.specific_cities_counties,
          market_area_importance: formData.market_area_importance,
          state_price_min: formData.state_price_min,
          state_price_max: formData.state_price_max,
        },
        dealStructure: {
          deal_types_open_to: formData.deal_types_open_to,
          preferred_deal_structure: formData.preferred_deal_structure,
          most_important_now: formData.most_important_now,
          target_hold_period: formData.target_hold_period,
        },
        riskSpeed: {
          decision_speed_on_deal: formData.decision_speed_on_deal,
          typical_earnest_money_pct: formData.typical_earnest_money_pct,
          comfortable_non_refundable_em: formData.comfortable_non_refundable_em,
          most_recent_deal: formData.most_recent_deal,
        },
        agentWorking: {
          what_from_agent: formData.what_from_agent,
          communication_preferences: formData.communication_preferences,
          preferred_agent_response_time: formData.preferred_agent_response_time,
          agent_deal_breakers: formData.agent_deal_breakers,
        },
        experienceAccreditation: {
          accredited_investor: formData.accredited_investor,
          investment_holding_structures: formData.investment_holding_structures,
          anything_else_for_agent: formData.anything_else_for_agent,
        },
      };

      // CRITICAL: Set onboarding_completed_at to mark onboarding as complete
      const updatePayload = {
        full_name: formData.full_name,
        phone: formData.phone,
        company: formData.company,
        target_state: formData.primary_state,
        markets: formData.primary_state ? [formData.primary_state] : [],
        metadata,
        onboarding_step: 'deep_complete',
        onboarding_version: 'v2',
        onboarding_completed_at: new Date().toISOString(),
      };
      
      console.log('[InvestorDeepOnboarding] Saving profile with:', updatePayload);
      
      await base44.entities.Profile.update(profile.id, updatePayload);

      // Refresh profile to get updated state
      await refresh();
      
      toast.success("Profile completed successfully!");
      
      // Navigate back to Dashboard so user can proceed through checklist
      navigate(createPageUrl("Dashboard"), { replace: true });
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  const renderStep1 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Basic Profile</h3>
      <p className="text-[16px] text-[#808080] mb-8">Let's start with the basics</p>
      
      <div className="space-y-5">
        <div>
          <Label className="text-[#FAFAFA]">Full Name *</Label>
          <Input value={formData.full_name} onChange={(e) => updateField('full_name', e.target.value)} className="h-12 mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Phone *</Label>
          <Input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className="h-12 mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Company (optional)</Label>
          <Input value={formData.company} onChange={(e) => updateField('company', e.target.value)} className="h-12 mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Experience & Accreditation</h3>
      <p className="text-[16px] text-[#808080] mb-8">Tell us about your investing background</p>
      
      <div className="space-y-5">
        <div>
          <Label className="text-[#FAFAFA]">How would you describe yourself?</Label>
          <RadioGroup value={formData.investor_description} onValueChange={(v) => updateField('investor_description', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="new" id="new" /><Label htmlFor="new" className="font-normal text-[#FAFAFA]">New investor (0 deals)</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="few_deals" id="few" /><Label htmlFor="few" className="font-normal text-[#FAFAFA]">Have done a few deals</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="experienced" id="exp" /><Label htmlFor="exp" className="font-normal text-[#FAFAFA]">Experienced (10+ deals)</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="professional" id="pro" /><Label htmlFor="pro" className="font-normal text-[#FAFAFA]">Professional/Institutional</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Deals closed in last 24 months</Label>
          <RadioGroup value={formData.deals_closed_24mo} onValueChange={(v) => updateField('deals_closed_24mo', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="0" id="d0" /><Label htmlFor="d0" className="font-normal text-[#FAFAFA]">0</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="1_2" id="d12" /><Label htmlFor="d12" className="font-normal text-[#FAFAFA]">1-2</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="3_5" id="d35" /><Label htmlFor="d35" className="font-normal text-[#FAFAFA]">3-5</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="6_plus" id="d6" /><Label htmlFor="d6" className="font-normal text-[#FAFAFA]">6+</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Are you an accredited investor?</Label>
          <RadioGroup value={formData.accredited_investor} onValueChange={(v) => updateField('accredited_investor', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="ay" /><Label htmlFor="ay" className="font-normal text-[#FAFAFA]">Yes</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="no" id="an" /><Label htmlFor="an" className="font-normal text-[#FAFAFA]">No</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="not_sure" id="ans" /><Label htmlFor="ans" className="font-normal text-[#FAFAFA]">Not sure</Label></div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Capital & Financing</h3>
      <p className="text-[16px] text-[#808080] mb-8">Your budget and financing preferences</p>
      
      <div className="space-y-5">
        <div>
          <Label className="text-[#FAFAFA]">Capital available in next 12 months</Label>
          <RadioGroup value={formData.capital_available_12mo} onValueChange={(v) => updateField('capital_available_12mo', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="under_50k" id="c1" /><Label htmlFor="c1" className="font-normal text-[#FAFAFA]">Under $50K</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="50k_150k" id="c2" /><Label htmlFor="c2" className="font-normal text-[#FAFAFA]">$50K - $150K</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="150k_300k" id="c3" /><Label htmlFor="c3" className="font-normal text-[#FAFAFA]">$150K - $300K</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="300k_600k" id="c4" /><Label htmlFor="c4" className="font-normal text-[#FAFAFA]">$300K - $600K</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="600k_plus" id="c5" /><Label htmlFor="c5" className="font-normal text-[#FAFAFA]">$600K+</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Financing methods you use (select all)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {FINANCING_METHODS.map(m => (
              <div key={m.value} className="flex items-center gap-2">
                <Checkbox checked={formData.financing_methods?.includes(m.value)} onCheckedChange={() => toggleArrayField('financing_methods', m.value)} />
                <Label className="font-normal text-[#FAFAFA]">{m.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Do you have financing lined up?</Label>
          <RadioGroup value={formData.financing_lined_up} onValueChange={(v) => updateField('financing_lined_up', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="fl1" /><Label htmlFor="fl1" className="font-normal text-[#FAFAFA]">Yes</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="in_progress" id="fl2" /><Label htmlFor="fl2" className="font-normal text-[#FAFAFA]">In progress</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="no" id="fl3" /><Label htmlFor="fl3" className="font-normal text-[#FAFAFA]">No</Label></div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Strategy & Deals</h3>
      <p className="text-[16px] text-[#808080] mb-8">What kind of deals are you looking for?</p>
      
      <div className="space-y-5">
        <div>
          <Label className="text-[#FAFAFA]">Investment strategies (select all)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {INVESTMENT_STRATEGIES.map(s => (
              <div key={s.value} className="flex items-center gap-2">
                <Checkbox checked={formData.investment_strategies?.includes(s.value)} onCheckedChange={() => toggleArrayField('investment_strategies', s.value)} />
                <Label className="font-normal text-[#FAFAFA]">{s.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Property types (select all)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {PROPERTY_TYPES.map(p => (
              <div key={p.value} className="flex items-center gap-2">
                <Checkbox checked={formData.property_types?.includes(p.value)} onCheckedChange={() => toggleArrayField('property_types', p.value)} />
                <Label className="font-normal text-[#FAFAFA]">{p.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Property condition preference</Label>
          <RadioGroup value={formData.property_condition} onValueChange={(v) => updateField('property_condition', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="turnkey" id="pc1" /><Label htmlFor="pc1" className="font-normal text-[#FAFAFA]">Turnkey</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="light_cosmetic" id="pc2" /><Label htmlFor="pc2" className="font-normal text-[#FAFAFA]">Light cosmetic</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="heavy_rehab" id="pc3" /><Label htmlFor="pc3" className="font-normal text-[#FAFAFA]">Heavy rehab</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="any" id="pc4" /><Label htmlFor="pc4" className="font-normal text-[#FAFAFA]">Any condition</Label></div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Target Markets</h3>
      <p className="text-[16px] text-[#808080] mb-8">Where do you want to invest?</p>
      
      <div className="space-y-5">
        <div>
          <Label className="text-[#FAFAFA]">Primary state *</Label>
          <select value={formData.primary_state} onChange={(e) => updateField('primary_state', e.target.value)} className="h-12 w-full rounded-lg border border-[#1F1F1F] px-4 mt-1 bg-[#141414] text-[#FAFAFA]">
            <option value="">Select state</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Specific cities or counties (optional)</Label>
          <Input value={formData.specific_cities_counties} onChange={(e) => updateField('specific_cities_counties', e.target.value)} placeholder="e.g., Austin, Dallas County" className="h-12 mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Price range (min)</Label>
          <Input type="number" value={formData.state_price_min} onChange={(e) => updateField('state_price_min', e.target.value)} placeholder="e.g., 100000" className="h-12 mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Price range (max)</Label>
          <Input type="number" value={formData.state_price_max} onChange={(e) => updateField('state_price_max', e.target.value)} placeholder="e.g., 500000" className="h-12 mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Deal Structure</h3>
      <p className="text-[16px] text-[#808080] mb-8">How you like to structure deals</p>
      
      <div className="space-y-5">
        <div>
          <Label className="text-[#FAFAFA]">Deal types open to (select all)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[
              { value: 'on_market', label: 'On-market (MLS)' },
              { value: 'off_market', label: 'Off-market' },
              { value: 'foreclosure', label: 'Foreclosures/REO' },
              { value: 'wholesale', label: 'Wholesale deals' },
            ].map(d => (
              <div key={d.value} className="flex items-center gap-2">
                <Checkbox checked={formData.deal_types_open_to?.includes(d.value)} onCheckedChange={() => toggleArrayField('deal_types_open_to', d.value)} />
                <Label className="font-normal text-[#FAFAFA]">{d.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">What's most important to you right now?</Label>
          <RadioGroup value={formData.most_important_now} onValueChange={(v) => updateField('most_important_now', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="cash_flow" id="mi1" /><Label htmlFor="mi1" className="font-normal text-[#FAFAFA]">Cash flow</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="appreciation" id="mi2" /><Label htmlFor="mi2" className="font-normal text-[#FAFAFA]">Appreciation</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="quick_flip" id="mi3" /><Label htmlFor="mi3" className="font-normal text-[#FAFAFA]">Quick flip profit</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="tax_benefits" id="mi4" /><Label htmlFor="mi4" className="font-normal text-[#FAFAFA]">Tax benefits</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Target hold period</Label>
          <RadioGroup value={formData.target_hold_period} onValueChange={(v) => updateField('target_hold_period', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="under_1y" id="hp1" /><Label htmlFor="hp1" className="font-normal text-[#FAFAFA]">Under 1 year</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="1_3y" id="hp2" /><Label htmlFor="hp2" className="font-normal text-[#FAFAFA]">1-3 years</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="3_7y" id="hp3" /><Label htmlFor="hp3" className="font-normal text-[#FAFAFA]">3-7 years</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="7_plus" id="hp4" /><Label htmlFor="hp4" className="font-normal text-[#FAFAFA]">7+ years</Label></div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Risk & Speed</h3>
      <p className="text-[16px] text-[#808080] mb-8">How fast can you move on deals?</p>
      
      <div className="space-y-5">
        <div>
          <Label className="text-[#FAFAFA]">Decision speed on a deal</Label>
          <RadioGroup value={formData.decision_speed_on_deal} onValueChange={(v) => updateField('decision_speed_on_deal', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="same_day" id="ds1" /><Label htmlFor="ds1" className="font-normal text-[#FAFAFA]">Same day</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="2_3_days" id="ds2" /><Label htmlFor="ds2" className="font-normal text-[#FAFAFA]">2-3 days</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="1_week" id="ds3" /><Label htmlFor="ds3" className="font-normal text-[#FAFAFA]">1 week</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="2_weeks_plus" id="ds4" /><Label htmlFor="ds4" className="font-normal text-[#FAFAFA]">2+ weeks</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Typical earnest money %</Label>
          <Input value={formData.typical_earnest_money_pct} onChange={(e) => updateField('typical_earnest_money_pct', e.target.value)} placeholder="e.g., 1-3%" className="h-12 mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Comfortable with non-refundable earnest money?</Label>
          <RadioGroup value={formData.comfortable_non_refundable_em} onValueChange={(v) => updateField('comfortable_non_refundable_em', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="em1" /><Label htmlFor="em1" className="font-normal text-[#FAFAFA]">Yes</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="no" id="em2" /><Label htmlFor="em2" className="font-normal text-[#FAFAFA]">No</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="depends" id="em3" /><Label htmlFor="em3" className="font-normal text-[#FAFAFA]">Depends on the deal</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Tell us about your most recent deal (optional)</Label>
          <Textarea value={formData.most_recent_deal} onChange={(e) => updateField('most_recent_deal', e.target.value)} placeholder="Brief description..." rows={3} className="mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Working with Agents</h3>
      <p className="text-[16px] text-[#808080] mb-8">Help us match you with the right agent</p>
      
      <div className="space-y-5">
        <div>
          <Label className="text-[#FAFAFA]">What do you want from an agent? (select all)</Label>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {[
              { value: 'find_deals', label: 'Find deals for me' },
              { value: 'market_expertise', label: 'Market expertise' },
              { value: 'negotiations', label: 'Strong negotiations' },
              { value: 'contractor_network', label: 'Contractor network' },
              { value: 'property_management', label: 'Property management referrals' },
            ].map(w => (
              <div key={w.value} className="flex items-center gap-2">
                <Checkbox checked={formData.what_from_agent?.includes(w.value)} onCheckedChange={() => toggleArrayField('what_from_agent', w.value)} />
                <Label className="font-normal text-[#FAFAFA]">{w.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Preferred communication (select all)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {COMMUNICATION_PREFS.map(c => (
              <div key={c.value} className="flex items-center gap-2">
                <Checkbox checked={formData.communication_preferences?.includes(c.value)} onCheckedChange={() => toggleArrayField('communication_preferences', c.value)} />
                <Label className="font-normal text-[#FAFAFA]">{c.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Preferred agent response time</Label>
          <RadioGroup value={formData.preferred_agent_response_time} onValueChange={(v) => updateField('preferred_agent_response_time', v)} className="mt-2 space-y-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="asap" id="rt1" /><Label htmlFor="rt1" className="font-normal text-[#FAFAFA]">ASAP (within hours)</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="24_hours" id="rt2" /><Label htmlFor="rt2" className="font-normal text-[#FAFAFA]">Within 24 hours</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="48_hours" id="rt3" /><Label htmlFor="rt3" className="font-normal text-[#FAFAFA]">Within 48 hours</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Agent deal breakers (optional)</Label>
          <Textarea value={formData.agent_deal_breakers} onChange={(e) => updateField('agent_deal_breakers', e.target.value)} placeholder="What would make you NOT work with an agent?" rows={2} className="mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA]">Anything else agents should know?</Label>
          <Textarea value={formData.anything_else_for_agent} onChange={(e) => updateField('anything_else_for_agent', e.target.value)} placeholder="Optional notes..." rows={2} className="mt-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666]" />
        </div>

        <div className="bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl p-5 mt-6">
          <h4 className="font-semibold text-[#E3C567] mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-[#E3C567]">
            After completing this, our AI will use your detailed preferences to find better agent matches for you.
          </p>
        </div>
      </div>
    </div>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8];

  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}>
      <header className="h-20 flex items-center justify-between px-6 border-b border-[#1F1F1F]">
        <button onClick={() => navigate(createPageUrl("Dashboard"))} className="flex items-center gap-2 text-[#808080] hover:text-[#E3C567]">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#E3C567] rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-black" />
          </div>
          <span className="text-xl font-bold text-[#E3C567]">INVESTOR KONNECT</span>
        </div>
        <div className="w-24" />
      </header>

      <div className="py-6 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all ${
                idx + 1 === step 
                  ? 'w-4 h-4 bg-[#E3C567] animate-pulse' 
                  : idx + 1 < step 
                    ? 'w-3 h-3 bg-[#E3C567]' 
                    : 'w-3 h-3 border-2 border-[#1F1F1F] bg-transparent'
              }`}
            />
          ))}
        </div>
        <p className="text-[14px] text-[#808080]">Step {step} of {TOTAL_STEPS}</p>
      </div>

      <div className="max-w-[500px] mx-auto px-4 pb-12">
        <div className="bg-[#0D0D0D] rounded-2xl p-8 border border-[#1F1F1F]" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
          {stepRenderers[step - 1]()}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1F1F1F]">
            {step > 1 ? (
              <button onClick={handleBack} disabled={saving} className="text-[#808080] hover:text-[#E3C567] font-medium transition-colors">
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={handleNext}
              disabled={saving || (step === 1 && !formData.full_name) || (step === 5 && !formData.primary_state)}
              className="h-12 px-8 rounded-lg bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold transition-all duration-200 disabled:bg-[#1F1F1F] disabled:text-[#666666]"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Saving...</>
              ) : step === TOTAL_STEPS ? (
                'Complete Profile →'
              ) : (
                'Continue →'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
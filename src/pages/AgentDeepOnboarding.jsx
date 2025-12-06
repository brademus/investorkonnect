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

const DEAL_SOURCING = [
  { value: "mls", label: "MLS" },
  { value: "direct_mail", label: "Direct mail" },
  { value: "cold_calling", label: "Cold calling" },
  { value: "networking", label: "Networking/referrals" },
  { value: "auctions", label: "Auctions" },
  { value: "wholesalers", label: "Wholesalers" },
];

const PRO_NETWORK = [
  { value: "lenders", label: "Lenders" },
  { value: "contractors", label: "Contractors" },
  { value: "property_managers", label: "Property managers" },
  { value: "title_companies", label: "Title companies" },
  { value: "attorneys", label: "Attorneys" },
  { value: "inspectors", label: "Inspectors" },
];

const COMMUNICATION_PREFS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text/SMS" },
  { value: "video", label: "Video Call" },
];

/**
 * AGENT DEEP ONBOARDING - 8-step comprehensive onboarding
 */
export default function AgentDeepOnboarding() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    // Step 1: Basic Profile
    full_name: '',
    phone: '',
    brokerage: '',
    
    // Step 2: License & Experience
    license_number: '',
    license_state: '',
    experience_years: '',
    is_full_time_agent: '',
    
    // Step 3: Markets & Specialties
    markets: [],
    specialties: [],
    primary_neighborhoods_notes: '',
    
    // Step 4: Investor Experience
    investor_experience_years: '',
    investor_clients_count: '',
    investment_deals_last_12m: '',
    personally_invests: '',
    personal_investing_notes: '',
    
    // Step 5: Investment Strategies
    investment_strategies: [],
    investor_types_served: [],
    typical_deal_price_range: '',
    metrics_used: [],
    
    // Step 6: Deal Sourcing
    sources_off_market: '',
    off_market_methods_notes: '',
    deal_sourcing_methods: [],
    
    // Step 7: Professional Network
    pro_network_types: [],
    can_refer_professionals: '',
    can_provide_investor_references: '',
    case_study_best_deal: '',
    
    // Step 8: Communication & Style
    preferred_communication_channels: [],
    typical_response_time: '',
    update_frequency: '',
    languages_spoken: [],
    bio: '',
    what_sets_you_apart: '',
  });

  const TOTAL_STEPS = 8;

  useEffect(() => {
    if (profile) {
      const agent = profile.agent || {};
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        brokerage: agent.brokerage || '',
        license_number: agent.license_number || profile.license_number || '',
        license_state: agent.license_state || profile.license_state || '',
        experience_years: agent.experience_years || '',
        is_full_time_agent: agent.is_full_time_agent ? 'yes' : agent.is_full_time_agent === false ? 'no' : '',
        markets: agent.markets || profile.markets || [],
        specialties: agent.specialties || [],
        primary_neighborhoods_notes: agent.primary_neighborhoods_notes || '',
        investor_experience_years: agent.investor_experience_years || '',
        investor_clients_count: agent.investor_clients_count || '',
        investment_deals_last_12m: agent.investment_deals_last_12m || '',
        personally_invests: agent.personally_invests ? 'yes' : agent.personally_invests === false ? 'no' : '',
        personal_investing_notes: agent.personal_investing_notes || '',
        investment_strategies: agent.investment_strategies || [],
        investor_types_served: agent.investor_types_served || [],
        typical_deal_price_range: agent.typical_deal_price_range || '',
        metrics_used: agent.metrics_used || [],
        sources_off_market: agent.sources_off_market ? 'yes' : agent.sources_off_market === false ? 'no' : '',
        off_market_methods_notes: agent.off_market_methods_notes || '',
        deal_sourcing_methods: agent.deal_sourcing_methods || [],
        pro_network_types: agent.pro_network_types || [],
        can_refer_professionals: agent.can_refer_professionals ? 'yes' : agent.can_refer_professionals === false ? 'no' : '',
        can_provide_investor_references: agent.can_provide_investor_references ? 'yes' : agent.can_provide_investor_references === false ? 'no' : '',
        case_study_best_deal: agent.case_study_best_deal || '',
        preferred_communication_channels: agent.preferred_communication_channels || [],
        typical_response_time: agent.typical_response_time || '',
        update_frequency: agent.update_frequency || '',
        languages_spoken: agent.languages_spoken || [],
        bio: agent.bio || '',
        what_sets_you_apart: agent.what_sets_you_apart || '',
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
      const agentData = {
        brokerage: formData.brokerage,
        license_number: formData.license_number,
        license_state: formData.license_state,
        experience_years: parseFloat(formData.experience_years) || 0,
        is_full_time_agent: formData.is_full_time_agent === 'yes',
        markets: formData.markets,
        specialties: formData.specialties,
        primary_neighborhoods_notes: formData.primary_neighborhoods_notes,
        investor_experience_years: parseFloat(formData.investor_experience_years) || 0,
        investor_clients_count: parseFloat(formData.investor_clients_count) || 0,
        investment_deals_last_12m: parseFloat(formData.investment_deals_last_12m) || 0,
        personally_invests: formData.personally_invests === 'yes',
        personal_investing_notes: formData.personal_investing_notes,
        investment_strategies: formData.investment_strategies,
        investor_types_served: formData.investor_types_served,
        typical_deal_price_range: formData.typical_deal_price_range,
        metrics_used: formData.metrics_used,
        sources_off_market: formData.sources_off_market === 'yes',
        off_market_methods_notes: formData.off_market_methods_notes,
        deal_sourcing_methods: formData.deal_sourcing_methods,
        pro_network_types: formData.pro_network_types,
        can_refer_professionals: formData.can_refer_professionals === 'yes',
        can_provide_investor_references: formData.can_provide_investor_references === 'yes',
        case_study_best_deal: formData.case_study_best_deal,
        preferred_communication_channels: formData.preferred_communication_channels,
        typical_response_time: formData.typical_response_time,
        update_frequency: formData.update_frequency,
        languages_spoken: formData.languages_spoken,
        bio: formData.bio,
        what_sets_you_apart: formData.what_sets_you_apart,
      };

      // CRITICAL: Set onboarding_completed_at to mark onboarding as complete
      await base44.entities.Profile.update(profile.id, {
        full_name: formData.full_name,
        phone: formData.phone,
        license_number: formData.license_number,
        license_state: formData.license_state,
        markets: formData.markets,
        onboarding_step: 'deep_complete',
        onboarding_version: 'agent-v2-deep',
        onboarding_completed_at: new Date().toISOString(),
        agent: {
          ...profile.agent,
          ...agentData,
        },
      });

      await refresh();
      toast.success("Profile completed successfully!");
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
      
      <div className="space-y-6">
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Full Name *</Label>
          <Input value={formData.full_name} onChange={(e) => updateField('full_name', e.target.value)} className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Phone *</Label>
          <Input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Brokerage</Label>
          <Input value={formData.brokerage} onChange={(e) => updateField('brokerage', e.target.value)} placeholder="Your brokerage name" className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">License & Experience</h3>
      <p className="text-[16px] text-[#808080] mb-8">Your credentials</p>
      
      <div className="space-y-6">
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">License Number *</Label>
          <Input value={formData.license_number} onChange={(e) => updateField('license_number', e.target.value)} className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">License State *</Label>
          <select value={formData.license_state} onChange={(e) => updateField('license_state', e.target.value)} className="h-14 w-full rounded-lg border border-[#1F1F1F] px-4 mt-2 bg-[#141414] text-[#FAFAFA] text-[18px] focus:border-[#E3C567] focus:ring-[#E3C567]">
            <option value="">Select state</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Years of Experience</Label>
          <Input type="number" min="0" value={formData.experience_years} onChange={(e) => updateField('experience_years', e.target.value)} className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Are you a full-time agent?</Label>
          <RadioGroup value={formData.is_full_time_agent} onValueChange={(v) => updateField('is_full_time_agent', v)} className="mt-3 space-y-3">
            <div className="flex items-center gap-3"><RadioGroupItem value="yes" id="ft1" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="ft1" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Yes, full-time</Label></div>
            <div className="flex items-center gap-3"><RadioGroupItem value="no" id="ft2" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="ft2" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Part-time</Label></div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Markets & Specialties</h3>
      <p className="text-[16px] text-[#808080] mb-8">Where and what you work on</p>
      
      <div className="space-y-6">
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Markets you serve (select all) *</Label>
          <div className="grid grid-cols-4 gap-2 mt-3 max-h-48 overflow-y-auto p-3 border border-[#1F1F1F] rounded-lg">
            {US_STATES.map(state => (
              <div key={state} className="flex items-center gap-2">
                <Checkbox checked={formData.markets?.includes(state)} onCheckedChange={() => toggleArrayField('markets', state)} className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]" />
                <Label className="font-normal text-[15px] text-[#FAFAFA] cursor-pointer">{state}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Property specialties (select all)</Label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {PROPERTY_TYPES.map(p => (
              <div key={p.value} className="flex items-center gap-3">
                <Checkbox checked={formData.specialties?.includes(p.value)} onCheckedChange={() => toggleArrayField('specialties', p.value)} className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]" />
                <Label className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">{p.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Key neighborhoods/areas (optional)</Label>
          <Textarea value={formData.primary_neighborhoods_notes} onChange={(e) => updateField('primary_neighborhoods_notes', e.target.value)} placeholder="e.g., Downtown Austin, East Dallas..." rows={3} className="mt-2 text-[18px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Investor Experience</h3>
      <p className="text-[16px] text-[#808080] mb-8">Your experience with investor clients</p>
      
      <div className="space-y-6">
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Years working with investors</Label>
          <Input type="number" min="0" value={formData.investor_experience_years} onChange={(e) => updateField('investor_experience_years', e.target.value)} className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Investor clients served (total)</Label>
          <Input type="number" min="0" value={formData.investor_clients_count} onChange={(e) => updateField('investor_clients_count', e.target.value)} className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Investment deals closed (last 12 months)</Label>
          <Input type="number" min="0" value={formData.investment_deals_last_12m} onChange={(e) => updateField('investment_deals_last_12m', e.target.value)} className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Do you personally invest in real estate?</Label>
          <RadioGroup value={formData.personally_invests} onValueChange={(v) => updateField('personally_invests', v)} className="mt-3 space-y-3">
            <div className="flex items-center gap-3"><RadioGroupItem value="yes" id="pi1" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="pi1" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Yes</Label></div>
            <div className="flex items-center gap-3"><RadioGroupItem value="no" id="pi2" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="pi2" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">No</Label></div>
          </RadioGroup>
        </div>
        {formData.personally_invests === 'yes' && (
          <div>
            <Label className="text-[#FAFAFA] text-[17px]">Tell us about your investing (optional)</Label>
            <Textarea value={formData.personal_investing_notes} onChange={(e) => updateField('personal_investing_notes', e.target.value)} rows={3} className="mt-2 text-[18px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Investment Strategies</h3>
      <p className="text-[16px] text-[#808080] mb-8">What strategies you support</p>
      
      <div className="space-y-6">
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Investment strategies you support (select all)</Label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {INVESTMENT_STRATEGIES.map(s => (
              <div key={s.value} className="flex items-center gap-3">
                <Checkbox checked={formData.investment_strategies?.includes(s.value)} onCheckedChange={() => toggleArrayField('investment_strategies', s.value)} className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]" />
                <Label className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">{s.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Investor types you've worked with (select all)</Label>
          <div className="grid grid-cols-1 gap-3 mt-3">
            {[
              { value: 'first_time', label: 'First-time investors' },
              { value: 'experienced', label: 'Experienced investors' },
              { value: 'institutional', label: 'Institutional/funds' },
              { value: 'out_of_state', label: 'Out-of-state investors' },
            ].map(i => (
              <div key={i.value} className="flex items-center gap-3">
                <Checkbox checked={formData.investor_types_served?.includes(i.value)} onCheckedChange={() => toggleArrayField('investor_types_served', i.value)} className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]" />
                <Label className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">{i.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Typical deal price range</Label>
          <Input value={formData.typical_deal_price_range} onChange={(e) => updateField('typical_deal_price_range', e.target.value)} placeholder="e.g., $150K - $500K" className="h-14 text-[18px] mt-2 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Deal Sourcing</h3>
      <p className="text-[16px] text-[#808080] mb-8">How you find deals</p>
      
      <div className="space-y-6">
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Do you source off-market deals?</Label>
          <RadioGroup value={formData.sources_off_market} onValueChange={(v) => updateField('sources_off_market', v)} className="mt-3 space-y-3">
            <div className="flex items-center gap-3"><RadioGroupItem value="yes" id="om1" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="om1" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Yes</Label></div>
            <div className="flex items-center gap-3"><RadioGroupItem value="no" id="om2" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="om2" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">No</Label></div>
          </RadioGroup>
        </div>
        {formData.sources_off_market === 'yes' && (
          <div>
            <Label className="text-[#FAFAFA] text-[17px]">How do you find off-market deals?</Label>
            <Textarea value={formData.off_market_methods_notes} onChange={(e) => updateField('off_market_methods_notes', e.target.value)} rows={3} className="mt-2 text-[18px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
          </div>
        )}
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Deal sourcing methods (select all)</Label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {DEAL_SOURCING.map(d => (
              <div key={d.value} className="flex items-center gap-3">
                <Checkbox checked={formData.deal_sourcing_methods?.includes(d.value)} onCheckedChange={() => toggleArrayField('deal_sourcing_methods', d.value)} className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]" />
                <Label className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">{d.label}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Professional Network</h3>
      <p className="text-[16px] text-[#808080] mb-8">Your connections</p>
      
      <div className="space-y-6">
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Professionals in your network (select all)</Label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {PRO_NETWORK.map(p => (
              <div key={p.value} className="flex items-center gap-3">
                <Checkbox checked={formData.pro_network_types?.includes(p.value)} onCheckedChange={() => toggleArrayField('pro_network_types', p.value)} className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]" />
                <Label className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">{p.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Can you refer clients to these professionals?</Label>
          <RadioGroup value={formData.can_refer_professionals} onValueChange={(v) => updateField('can_refer_professionals', v)} className="mt-3 space-y-3">
            <div className="flex items-center gap-3"><RadioGroupItem value="yes" id="rp1" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="rp1" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Yes</Label></div>
            <div className="flex items-center gap-3"><RadioGroupItem value="no" id="rp2" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="rp2" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">No</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Can you provide investor client references?</Label>
          <RadioGroup value={formData.can_provide_investor_references} onValueChange={(v) => updateField('can_provide_investor_references', v)} className="mt-3 space-y-3">
            <div className="flex items-center gap-3"><RadioGroupItem value="yes" id="ir1" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="ir1" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Yes</Label></div>
            <div className="flex items-center gap-3"><RadioGroupItem value="no" id="ir2" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="ir2" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">No</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Tell us about your best investment deal (optional)</Label>
          <Textarea value={formData.case_study_best_deal} onChange={(e) => updateField('case_study_best_deal', e.target.value)} placeholder="Brief case study..." rows={3} className="mt-2 text-[18px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div>
      <h3 className="text-[28px] font-bold text-[#E3C567] mb-2">Communication & Style</h3>
      <p className="text-[16px] text-[#808080] mb-8">How you work with clients</p>
      
      <div className="space-y-6">
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Preferred communication (select all)</Label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {COMMUNICATION_PREFS.map(c => (
              <div key={c.value} className="flex items-center gap-3">
                <Checkbox checked={formData.preferred_communication_channels?.includes(c.value)} onCheckedChange={() => toggleArrayField('preferred_communication_channels', c.value)} className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]" />
                <Label className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">{c.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Typical response time</Label>
          <RadioGroup value={formData.typical_response_time} onValueChange={(v) => updateField('typical_response_time', v)} className="mt-3 space-y-3">
            <div className="flex items-center gap-3"><RadioGroupItem value="1" id="tr1" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="tr1" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Within 1 hour</Label></div>
            <div className="flex items-center gap-3"><RadioGroupItem value="2" id="tr2" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="tr2" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Same day</Label></div>
            <div className="flex items-center gap-3"><RadioGroupItem value="3" id="tr3" className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] data-[state=checked]:text-black" /><Label htmlFor="tr3" className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">Within 24 hours</Label></div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Languages spoken</Label>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {['English', 'Spanish', 'Chinese', 'Vietnamese', 'Korean', 'Other'].map(lang => (
              <div key={lang} className="flex items-center gap-3">
                <Checkbox checked={formData.languages_spoken?.includes(lang)} onCheckedChange={() => toggleArrayField('languages_spoken', lang)} className="data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]" />
                <Label className="font-normal text-[#FAFAFA] text-[16px] cursor-pointer">{lang}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">Professional bio</Label>
          <Textarea value={formData.bio} onChange={(e) => updateField('bio', e.target.value)} placeholder="Tell investors about yourself..." rows={4} className="mt-2 text-[18px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>
        <div>
          <Label className="text-[#FAFAFA] text-[17px]">What sets you apart for investor clients?</Label>
          <Textarea value={formData.what_sets_you_apart} onChange={(e) => updateField('what_sets_you_apart', e.target.value)} rows={3} className="mt-2 text-[18px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-[#E3C567]" />
        </div>

        <div className="bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl p-5 mt-6">
          <h4 className="font-semibold text-[#E3C567] mb-2">🎉 You're almost done!</h4>
          <p className="text-sm text-[#E3C567]">
            After completing this, our AI will use your detailed profile to match you with the right investors.
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

      <div className="max-w-[600px] mx-auto px-4 pb-12">
        <div className="bg-[#0D0D0D] rounded-2xl p-10 border border-[#1F1F1F]" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
          {stepRenderers[step - 1]()}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1F1F1F]">
            {step > 1 ? (
              <button onClick={handleBack} disabled={saving} className="text-[#808080] hover:text-[#E3C567] font-medium transition-colors">
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={handleNext}
              disabled={saving || (step === 1 && !formData.full_name) || (step === 2 && (!formData.license_number || !formData.license_state)) || (step === 3 && formData.markets?.length === 0)}
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
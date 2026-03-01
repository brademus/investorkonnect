import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { CheckCircle, Upload, Trash2 } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { getCountyCentroid } from "@/components/utils/agentScoring";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import useOnboardingAccess from "@/components/onboarding/useOnboardingAccess";
import PhoneInput from "@/components/onboarding/PhoneInput";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const TOTAL_STEPS = 4;

const DEAL_TYPE_OPTIONS = [
  { label: 'Wholesale', value: 'Wholesale' },
  { label: 'Novation', value: 'Novation' },
  { label: 'Whole-tail', value: 'Whole-tail' },
  { label: 'Fix & Flip', value: 'Fix & Flip' },
  { label: 'Buy & Hold', value: 'Buy & Hold' },
  { label: 'Sub-2', value: 'Sub-2', tooltip: "Taking over seller's existing mortgage" },
];

const PROPERTY_TYPE_OPTIONS = ['Single-Family', 'Multi-Family', 'Condo', 'Townhouse', 'Manufactured', 'Land'];

export default function AgentOnboarding() {
  const navigate = useNavigate();
  const { profile, kycVerified } = useCurrentProfile();
  const { checking } = useOnboardingAccess();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [countyValid, setCountyValid] = useState(null);
  const [countyChecking, setCountyChecking] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', phone: '',
    state_licenses: {}, brokerage: '', main_county: '',
    markets: [], experience_years: '', deals_closed: '',
    investment_strategies: [], specialties: [],
    bio: '', headshotUrl: ''
  });

  // Block accidental navigation
  useEffect(() => {
    const handler = (e) => { if (!saving && step < TOTAL_STEPS) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [step, saving]);

  // Redirect if already onboarded
  useEffect(() => {
    if (checking || !profile) return;
    const done = !!(profile.onboarding_completed_at || profile.onboarding_step === 'basic_complete' || profile.onboarding_version);
    if (done) {
      navigate(createPageUrl(kycVerified ? "Pipeline" : "IdentityVerification"), { replace: true });
    }
  }, [checking, profile, kycVerified, navigate]);

  // Load existing data
  useEffect(() => {
    document.title = "Complete Your Profile - Investor Konnect";
    if (!profile) return;
    const agent = profile.agent || {};
    const nameParts = (profile.full_name || '').split(' ');
    const existingMarkets = agent.markets || profile.markets || [];
    const existingStateLicenses = agent.state_licenses || {};
    if (Object.keys(existingStateLicenses).length === 0) {
      const primary = agent.license_number || profile.license_number || '';
      const primaryState = agent.license_state || profile.license_state || '';
      if (primaryState && primary) existingStateLicenses[primaryState] = primary;
    }
    setFormData(prev => ({
      ...prev,
      first_name: profile.onboarding_first_name || nameParts[0] || '',
      last_name: profile.onboarding_last_name || nameParts.slice(1).join(' ') || '',
      phone: profile.phone || '',
      state_licenses: existingStateLicenses,
      brokerage: agent.brokerage || profile.broker || '',
      main_county: agent.main_county || '',
      markets: existingMarkets,
      experience_years: agent.experience_years || '',
      deals_closed: agent.investment_deals_last_12m || '',
      investment_strategies: agent.investment_strategies || [],
      specialties: agent.specialties || [],
      bio: agent.bio || '',
      headshotUrl: profile.headshotUrl || ''
    }));
  }, [profile]);

  // Enforce role consistency
  useEffect(() => {
    if (!profile) return;
    const r = profile.user_role;
    if (!r || r === 'member') {
      base44.entities.Profile.update(profile.id, { user_role: 'agent', user_type: 'agent' }).catch(() => {});
    } else if (r === 'investor') {
      navigate(createPageUrl("InvestorOnboarding"), { replace: true });
    }
  }, [profile, navigate]);

  // County validation
  const marketsKey = useMemo(() => JSON.stringify(formData.markets), [formData.markets]);
  useEffect(() => {
    const county = formData.main_county.trim();
    const primaryState = formData.markets[0] || '';
    if (!county || !primaryState) { setCountyValid(null); setCountyChecking(false); return; }
    setCountyChecking(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const coords = await getCountyCentroid(county, primaryState);
      if (!cancelled) { setCountyValid(coords !== null); setCountyChecking(false); }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.main_county, marketsKey]);

  const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const toggleArrayItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item) ? prev[field].filter(i => i !== item) : [...prev[field], item]
    }));
  };
  const toggleMarket = (state) => {
    setFormData(prev => {
      const isSelected = prev.markets.includes(state);
      const newMarkets = isSelected ? prev.markets.filter(s => s !== state) : [...prev.markets, state];
      const newLicenses = { ...prev.state_licenses };
      if (isSelected) delete newLicenses[state];
      return { ...prev, markets: newMarkets, state_licenses: newLicenses };
    });
  };
  const updateStateLicense = (state, value) => {
    setFormData(prev => ({ ...prev, state_licenses: { ...prev.state_licenses, [state]: value } }));
  };

  const step2HasAllLicenses = formData.markets.length > 0 && formData.markets.every(st => (formData.state_licenses[st] || '').trim().length > 0);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const authUser = await base44.auth.me();
      if (!authUser) throw new Error('Not authenticated');
      const emailLower = authUser.email.toLowerCase().trim();
      let profiles = await base44.entities.Profile.filter({ email: emailLower });
      if (!profiles?.length) profiles = await base44.entities.Profile.filter({ user_id: authUser.id });
      let profileToUpdate = profiles[0];
      if (!profileToUpdate) {
        profileToUpdate = await base44.entities.Profile.create({
          user_id: authUser.id, email: emailLower,
          full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim(),
          user_role: 'agent', user_type: 'agent'
        });
      }

      const licensedStates = formData.markets;
      const firstState = licensedStates[0] || '';
      const firstLicense = formData.state_licenses[firstState] || '';
      const combinedName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();

      const agentData = {
        ...(profileToUpdate.agent || {}),
        license_number: firstLicense,
        state_licenses: formData.state_licenses,
        license_state: firstState,
        licensed_states: licensedStates,
        main_county: formData.main_county,
        markets: licensedStates,
        experience_years: parseInt(formData.experience_years) || 0,
        investment_deals_last_12m: parseInt(formData.deals_closed) || 0,
        investment_strategies: formData.investment_strategies,
        specialties: formData.specialties,
        bio: formData.bio,
        investor_friendly: true,
        brokerage: formData.brokerage
      };

      await base44.entities.Profile.update(profileToUpdate.id, {
        full_name: combinedName,
        onboarding_first_name: formData.first_name.trim(),
        onboarding_last_name: formData.last_name.trim(),
        phone: formData.phone, user_role: 'agent', user_type: 'agent',
        broker: formData.brokerage, license_number: firstLicense,
        license_state: firstState, markets: licensedStates,
        target_state: firstState,
        onboarding_step: 'basic_complete',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 'agent-v1',
        headshotUrl: formData.headshotUrl || '',
        agent: agentData
      });

      // Geocode county in background
      if (formData.main_county && firstState) {
        getCountyCentroid(formData.main_county, firstState).then(coords => {
          if (coords) {
            base44.entities.Profile.update(profileToUpdate.id, {
              agent: { ...agentData, lat: coords.lat, lng: coords.lng }
            }).catch(() => {});
          }
        });
      }

      toast.success("Profile saved! Let's verify your identity.");
      try { sessionStorage.removeItem('__ik_profile_cache'); } catch (_) {}
      await new Promise(r => setTimeout(r, 400));
      navigate(createPageUrl("IdentityVerification"), { replace: true });
    } catch (error) {
      toast.error("Failed to save: " + (error.message || "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === TOTAL_STEPS) await handleSubmit();
    else setStep(step + 1);
  };

  const handleHeadshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateField('headshotUrl', file_url);
    setUploadingPhoto(false);
    toast.success('Photo uploaded!');
  };

  if (checking) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><LoadingAnimation className="w-64 h-64" /></div>;
  }

  const isStep1Valid = formData.first_name.trim() && formData.last_name.trim() && (formData.phone || '').replace(/\D/g, '').length >= 10;
  const isStep2Valid = formData.markets.length > 0 && step2HasAllLicenses && formData.brokerage.trim() && formData.main_county.trim() && countyValid === true;

  const nextDisabled = (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid);
  const nextLabel = step === TOTAL_STEPS ? 'Continue to Verification →' : 'Continue →';

  return (
    <OnboardingShell step={step} totalSteps={TOTAL_STEPS} saving={saving} onBack={() => setStep(step - 1)} onNext={handleNext} nextDisabled={nextDisabled} nextLabel={nextLabel}>
      {step === 1 && (
        <div>
          <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Let's get started</h3>
          <p className="text-[18px] text-[#808080] mb-10">Tell us a bit about yourself</p>
          <div className="space-y-7">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name" className="text-[#FAFAFA] text-[19px] font-medium">First Name *</Label>
                <Input id="first_name" value={formData.first_name} onChange={(e) => updateField('first_name', e.target.value)} placeholder="First name" className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" />
              </div>
              <div>
                <Label htmlFor="last_name" className="text-[#FAFAFA] text-[19px] font-medium">Last Name *</Label>
                <Input id="last_name" value={formData.last_name} onChange={(e) => updateField('last_name', e.target.value)} placeholder="Last name" className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" />
              </div>
            </div>
            <PhoneInput value={formData.phone} onChange={(v) => updateField('phone', v)} />
            <div>
              <Label htmlFor="experience_years" className="text-[#FAFAFA] text-[19px] font-medium">Years of Experience</Label>
              <Input id="experience_years" type="number" min="0" value={formData.experience_years} onChange={(e) => updateField('experience_years', e.target.value)} placeholder="e.g., 5" className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" />
            </div>
            <div>
              <Label htmlFor="deals_closed" className="text-[#FAFAFA] text-[19px] font-medium">Deals Closed (Last 12 Months)</Label>
              <Input id="deals_closed" type="number" min="0" value={formData.deals_closed} onChange={(e) => updateField('deals_closed', e.target.value)} placeholder="e.g., 12" className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">License & Location</h3>
          <p className="text-[18px] text-[#808080] mb-10">Select your licensed states and enter each license number</p>
          <div className="space-y-7">
            <div>
              <Label className="text-[#FAFAFA] text-[19px] font-medium">States Where You're Licensed *</Label>
              <p className="text-sm text-[#808080] mt-1 mb-3">Select all states where you hold an active real estate license</p>
              <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto p-4 border border-[#1F1F1F] rounded-lg bg-[#0A0A0A]">
                {US_STATES.map((state) => (
                  <div key={state} className="flex items-center gap-3">
                    <Checkbox id={`market-${state}`} checked={formData.markets.includes(state)} onCheckedChange={() => toggleMarket(state)} className="border-[#E3C567] data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] w-5 h-5" />
                    <Label htmlFor={`market-${state}`} className="text-[17px] font-normal cursor-pointer text-[#FAFAFA]">{state}</Label>
                  </div>
                ))}
              </div>
            </div>
            {formData.markets.length > 0 && (
              <div>
                <Label className="text-[#FAFAFA] text-[19px] font-medium">License Numbers *</Label>
                <p className="text-sm text-[#808080] mt-1 mb-3">Enter your license number for each state</p>
                <div className="space-y-3">
                  {formData.markets.map((state) => (
                    <div key={state}>
                      <Label className="text-[#FAFAFA] text-[15px] font-medium mb-1 block">{state} License Number</Label>
                      <Input value={formData.state_licenses[state] || ''} onChange={(e) => updateStateLicense(state, e.target.value)} placeholder={`e.g., ${state}-123456`} className="h-14 text-[17px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="brokerage" className="text-[#FAFAFA] text-[19px] font-medium">Brokerage Name *</Label>
              <Input id="brokerage" value={formData.brokerage} onChange={(e) => updateField('brokerage', e.target.value)} placeholder="e.g., Keller Williams, eXp Realty" className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" />
            </div>
            <div>
              <Label htmlFor="main_county" className="text-[#FAFAFA] text-[19px] font-medium">Main County *</Label>
              <Input id="main_county" value={formData.main_county} onChange={(e) => updateField('main_county', e.target.value)} placeholder="e.g., Maricopa" className={`h-16 text-[19px] mt-3 bg-[#141414] text-[#FAFAFA] placeholder:text-[#666666] focus:ring-2 ${formData.main_county.trim() && !countyChecking ? countyValid ? 'border-green-500 focus:border-green-500 focus:ring-green-500/30' : 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-[#1F1F1F] focus:border-[#E3C567] focus:ring-[#E3C567]/30'}`} />
              <div className="mt-2 min-h-[20px]">
                {countyChecking && formData.main_county.trim() && <p className="text-sm text-[#808080]">Checking county...</p>}
                {!countyChecking && formData.main_county.trim() && countyValid === true && <p className="text-sm text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> County recognized</p>}
                {!countyChecking && formData.main_county.trim() && countyValid === false && <p className="text-sm text-red-400">County not found in {formData.markets[0] || 'your state'}. Try just the county name.</p>}
                {!formData.main_county.trim() && <p className="text-sm text-[#808080]">Enter the county where you primarily operate</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Your Expertise</h3>
          <p className="text-[18px] text-[#808080] mb-10">Tell investors what types of deals and properties you specialize in</p>
          <div className="space-y-7">
            <div>
              <Label className="text-[#FAFAFA] text-[19px] font-medium">Type of Deals</Label>
              <p className="text-sm text-[#808080] mt-1 mb-3">Select all that apply</p>
              <div className="grid grid-cols-2 gap-3">
                {DEAL_TYPE_OPTIONS.map((deal) => (
                  <div key={deal.value} className="flex items-center gap-3">
                    <Checkbox id={`strategy-${deal.value}`} checked={formData.investment_strategies.includes(deal.value)} onCheckedChange={() => toggleArrayItem('investment_strategies', deal.value)} className="border-[#E3C567] data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] w-5 h-5" />
                    <Label htmlFor={`strategy-${deal.value}`} className="text-[16px] font-normal cursor-pointer text-[#FAFAFA] flex items-center gap-1.5">
                      {deal.label}
                      {deal.tooltip && (
                        <span className="relative group">
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#808080] text-[10px] text-[#808080] cursor-help">?</span>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#1F1F1F] text-[#FAFAFA] text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">{deal.tooltip}</span>
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-[#FAFAFA] text-[19px] font-medium">Property Types</Label>
              <p className="text-sm text-[#808080] mt-1 mb-3">Select all that apply</p>
              <div className="grid grid-cols-2 gap-3">
                {PROPERTY_TYPE_OPTIONS.map((specialty) => (
                  <div key={specialty} className="flex items-center gap-3">
                    <Checkbox id={`specialty-${specialty}`} checked={formData.specialties.includes(specialty)} onCheckedChange={() => toggleArrayItem('specialties', specialty)} className="border-[#E3C567] data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567] w-5 h-5" />
                    <Label htmlFor={`specialty-${specialty}`} className="text-[16px] font-normal cursor-pointer text-[#FAFAFA]">{specialty}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Profile Photo & Bio</h3>
          <p className="text-[18px] text-[#808080] mb-10">Add a photo and tell investors about your background</p>
          <div className="space-y-7">
            <div>
              <Label className="text-[#FAFAFA] text-[19px] font-medium">Profile Photo</Label>
              <p className="text-sm text-[#808080] mt-1 mb-3">Optional — a photo helps investors put a face to your name</p>
              <div className="flex items-center gap-5">
                {formData.headshotUrl ? (
                  <div className="relative group">
                    <img src={formData.headshotUrl} alt="Headshot" className="w-24 h-24 rounded-full object-cover border-2 border-[#E3C567]" />
                    <button type="button" onClick={() => updateField('headshotUrl', '')} className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#141414] border-2 border-dashed border-[#1F1F1F] flex items-center justify-center">
                    <Upload className="w-6 h-6 text-[#808080]" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleHeadshotUpload} className="hidden" />
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1F1F1F] bg-[#141414] text-[#FAFAFA] text-sm hover:border-[#E3C567] transition-colors">
                    {uploadingPhoto ? 'Uploading...' : formData.headshotUrl ? 'Change Photo' : 'Upload Photo'}
                  </span>
                </label>
              </div>
            </div>
            <div>
              <Label htmlFor="bio" className="text-[#FAFAFA] text-[19px] font-medium">Professional Bio</Label>
              <Textarea id="bio" value={formData.bio} onChange={(e) => updateField('bio', e.target.value)} placeholder="Introduce yourself and highlight your experience working with investor clients..." rows={5} className="text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 leading-relaxed" />
              <p className="text-[16px] text-[#808080] mt-2">This will appear on your public profile</p>
            </div>
            <div className="bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl p-5">
              <h4 className="font-semibold text-[#E3C567] mb-2">🎉 You're almost done!</h4>
              <p className="text-sm text-[#E3C567]">Next, we'll verify your identity to ensure trust and security on the platform.</p>
            </div>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useWizard } from "@/components/WizardContext";
import { Loader2, CheckCircle, User, X, Camera } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import useOnboardingAccess from "@/components/onboarding/useOnboardingAccess";
import PhoneInput from "@/components/onboarding/PhoneInput";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const DEAL_TYPES = ["Wholesale", "Novation", "Whole-tail", "Fix & Flip", "Buy & Hold", "Sub-2"];
const TOTAL_STEPS = 3;

export default function InvestorOnboarding() {
  const navigate = useNavigate();
  const { profile, user, isPaidSubscriber } = useCurrentProfile();
  const { selectedState } = useWizard();
  const { checking } = useOnboardingAccess();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', phone: '', company: '', headshotUrl: '',
    primary_state: selectedState || '', primary_states: selectedState ? [selectedState] : [],
    nationwide: false, investment_experience: '', deal_types: [], goals: '',
    next_steps_template_type: 'default', custom_next_steps_template: ''
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
      navigate(createPageUrl(isPaidSubscriber ? "IdentityVerification" : "Pricing"), { replace: true });
    }
  }, [checking, profile, isPaidSubscriber, navigate]);

  // Load existing data
  useEffect(() => {
    document.title = "Complete Your Profile - Investor Konnect";
    if (!profile) return;
    const nameParts = (profile.full_name || '').split(' ');
    const existingMarkets = profile.markets || [];
    const existingPrimaryState = selectedState || profile.target_state || existingMarkets[0] || '';
    const isNationwide = existingPrimaryState === 'Nationwide' || existingMarkets.includes('Nationwide');
    setFormData(prev => ({
      ...prev,
      first_name: profile.onboarding_first_name || nameParts[0] || '',
      last_name: profile.onboarding_last_name || nameParts.slice(1).join(' ') || '',
      phone: profile.phone || '', company: profile.company || '',
      headshotUrl: profile.headshotUrl || '',
      primary_state: existingPrimaryState,
      primary_states: isNationwide ? [] : (existingMarkets.length > 0 ? existingMarkets : (existingPrimaryState ? [existingPrimaryState] : [])),
      nationwide: isNationwide,
      investment_experience: profile.metadata?.basicProfile?.investment_experience || '',
      goals: profile.goals || ''
    }));
  }, [profile, selectedState]);

  // Enforce role consistency
  useEffect(() => {
    if (!profile) return;
    const r = profile.user_role;
    if (!r || r === 'member') {
      base44.entities.Profile.update(profile.id, { user_role: 'investor', user_type: 'investor' }).catch(() => {});
    } else if (r === 'agent') {
      navigate(createPageUrl("AgentOnboarding"), { replace: true });
    }
  }, [profile, navigate]);

  const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const toggleState = (state) => {
    setFormData(prev => {
      const updated = (prev.primary_states || []).includes(state)
        ? prev.primary_states.filter(s => s !== state)
        : [...(prev.primary_states || []), state];
      return { ...prev, primary_states: updated, primary_state: updated[0] || '' };
    });
  };

  const toggleNationwide = (checked) => {
    setFormData(prev => ({
      ...prev, nationwide: checked,
      primary_states: checked ? [] : prev.primary_states,
      primary_state: checked ? 'Nationwide' : (prev.primary_states[0] || '')
    }));
  };

  const toggleDealType = (type) => {
    setFormData(prev => {
      const current = prev.deal_types || [];
      return { ...prev, deal_types: current.includes(type) ? current.filter(t => t !== type) : [...current, type] };
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let currentProfile = profile;
      if (!currentProfile) {
        const profiles = await base44.entities.Profile.filter({ user_id: user?.id });
        currentProfile = profiles[0];
      }
      if (!currentProfile?.id) throw new Error('Unable to load profile. Please refresh the page.');

      const combinedName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
      await base44.entities.Profile.update(currentProfile.id, {
        full_name: combinedName,
        onboarding_first_name: formData.first_name.trim(),
        onboarding_last_name: formData.last_name.trim(),
        phone: formData.phone, company: formData.company,
        headshotUrl: formData.headshotUrl, goals: formData.goals,
        user_role: 'investor', user_type: 'investor',
        target_state: formData.nationwide ? 'Nationwide' : (formData.primary_states[0] || formData.primary_state),
        markets: formData.nationwide ? ['Nationwide'] : (formData.primary_states.length > 0 ? formData.primary_states : [formData.primary_state]).filter(Boolean),
        onboarding_step: 'basic_complete',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 'investor-v1',
        next_steps_template_type: formData.next_steps_template_type,
        custom_next_steps_template: formData.next_steps_template_type === 'custom' ? formData.custom_next_steps_template : null,
        metadata: {
          ...(currentProfile.metadata || {}),
          basicProfile: { investment_experience: formData.investment_experience, deal_types: formData.deal_types }
        }
      });

      toast.success("Profile saved! Let's choose your plan.");
      window.location.href = createPageUrl("Pricing");
    } catch (error) {
      toast.error(error?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 3) {
      if (formData.next_steps_template_type === 'custom' && (!formData.custom_next_steps_template || formData.custom_next_steps_template.trim().length < 50)) {
        toast.error('Please write a message for agents (minimum 50 characters)');
        return;
      }
      await handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  const handleHeadshotUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
      if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
      setUploadingPhoto(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        updateField('headshotUrl', file_url);
        toast.success('Photo uploaded');
      } catch { toast.error('Upload failed — please try again'); }
      finally { setUploadingPhoto(false); }
    };
    input.click();
  };

  if (checking) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><LoadingAnimation className="w-64 h-64" /></div>;
  }

  const isStep1Valid = formData.first_name.trim() && formData.last_name.trim() && (formData.phone || '').replace(/\D/g, '').length >= 10;
  const isStep2Valid = (formData.nationwide || (formData.primary_states && formData.primary_states.length > 0)) && (formData.deal_types || []).length > 0;
  const nextDisabled = (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid);
  const nextLabel = step === TOTAL_STEPS ? 'Continue to Pricing →' : 'Continue →';

  const allDealTypesSelected = formData.deal_types.length === DEAL_TYPES.length;

  return (
    <OnboardingShell step={step} totalSteps={TOTAL_STEPS} saving={saving} onBack={() => setStep(step - 1)} onNext={handleNext} nextDisabled={nextDisabled} nextLabel={nextLabel}>
      {step === 1 && (
        <div>
          <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Let's get started</h3>
          <p className="text-[18px] text-[#808080] mb-10">Tell us a bit about yourself</p>
          <div className="space-y-7">
            {/* Headshot */}
            <div className="flex flex-col items-center mb-2">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-[#141414] border-2 border-[#1F1F1F] flex items-center justify-center">
                  {formData.headshotUrl ? <img src={formData.headshotUrl} alt="Headshot" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-[#444]" />}
                </div>
                {formData.headshotUrl && (
                  <button type="button" onClick={() => updateField('headshotUrl', '')} className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
              <button type="button" onClick={handleHeadshotUpload} disabled={uploadingPhoto} className="mt-3 text-sm text-[#E3C567] hover:text-[#EDD89F] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50">
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {uploadingPhoto ? 'Uploading...' : formData.headshotUrl ? 'Change Photo' : 'Upload a Headshot'}
              </button>
            </div>
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
              <Label htmlFor="company" className="text-[#FAFAFA] text-[19px] font-medium">Company (optional)</Label>
              <Input id="company" value={formData.company} onChange={(e) => updateField('company', e.target.value)} placeholder="Your company name" className="h-16 text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Your investment focus</h3>
          <p className="text-[18px] text-[#808080] mb-10">What are your primary states?</p>
          <div className="space-y-7">
            <div>
              <Label className="text-[#FAFAFA] text-[19px] font-medium mb-4 block">Primary States *</Label>
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all mb-4"
                style={{ borderColor: formData.nationwide ? '#E3C567' : '#1F1F1F', backgroundColor: formData.nationwide ? 'rgba(227,197,103,0.1)' : '#141414' }}>
                <input type="checkbox" checked={formData.nationwide} onChange={(e) => toggleNationwide(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${formData.nationwide ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
                  {formData.nationwide && <CheckCircle className="w-3.5 h-3.5 text-black" />}
                </div>
                <span className="text-[#FAFAFA] text-[17px] font-semibold">Nationwide</span>
              </label>
              {!formData.nationwide && (
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 max-h-[280px] overflow-y-auto p-1">
                  {US_STATES.map(state => (
                    <button key={state} type="button" onClick={() => toggleState(state)}
                      className={`p-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${(formData.primary_states || []).includes(state) ? 'border-[#E3C567] bg-[#E3C567]/15 text-[#E3C567]' : 'border-[#1F1F1F] bg-[#141414] text-[#808080] hover:border-[#E3C567]/40 hover:text-[#FAFAFA]'}`}>
                      {state}
                    </button>
                  ))}
                </div>
              )}
              {!formData.nationwide && (formData.primary_states || []).length > 0 && (
                <p className="text-sm text-[#E3C567] mt-2">{formData.primary_states.length} state{formData.primary_states.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>
            <div>
              <Label className="text-[#FAFAFA] text-[19px] font-medium mb-4 block">Type of Deals *</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                  style={{ borderColor: allDealTypesSelected ? '#E3C567' : '#1F1F1F', backgroundColor: allDealTypesSelected ? 'rgba(227,197,103,0.1)' : '#141414' }}>
                  <input type="checkbox" checked={allDealTypesSelected} onChange={(e) => updateField('deal_types', e.target.checked ? [...DEAL_TYPES] : [])} className="sr-only" />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${allDealTypesSelected ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
                    {allDealTypesSelected && <CheckCircle className="w-3.5 h-3.5 text-black" />}
                  </div>
                  <span className="text-[#FAFAFA] text-[17px] font-semibold">All</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DEAL_TYPES.map(type => {
                    const selected = (formData.deal_types || []).includes(type);
                    return (
                      <label key={type} className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                        style={{ borderColor: selected ? '#E3C567' : '#1F1F1F', backgroundColor: selected ? 'rgba(227,197,103,0.1)' : '#141414' }}>
                        <input type="checkbox" checked={selected} onChange={() => toggleDealType(type)} className="sr-only" />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
                          {selected && <CheckCircle className="w-3.5 h-3.5 text-black" />}
                        </div>
                        <span className="text-[#FAFAFA] text-[15px]">{type}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="investment_experience" className="text-[#FAFAFA] text-[19px] font-medium">How many deals have you done?</Label>
              <input id="investment_experience" type="text" inputMode="numeric" placeholder="e.g. 5" value={formData.investment_experience} onChange={(e) => updateField('investment_experience', e.target.value)} className="h-16 w-full rounded-lg border border-[#1F1F1F] px-5 text-[19px] mt-3 bg-[#141414] text-[#FAFAFA] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30" />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className="text-[32px] font-bold text-[#E3C567] mb-3">Tell us about yourself</h3>
          <p className="text-[18px] text-[#808080] mb-10">Let agents know a little bit about you</p>
          <div className="space-y-7">
            <div>
              <Label htmlFor="goals" className="text-[#FAFAFA] text-[19px] font-medium">Your Bio</Label>
              <Textarea id="goals" value={formData.goals} onChange={(e) => updateField('goals', e.target.value)} placeholder="e.g., Looking for buy-and-hold rentals in growing markets, interested in multifamily properties..." rows={6} className="text-[19px] mt-3 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 leading-relaxed" />
            </div>
            <div className="border-t border-[#1F1F1F] pt-7 mt-7">
              <h4 className="text-[22px] font-bold text-[#E3C567] mb-2">Your Next Steps Message</h4>
              <p className="text-[14px] text-[#808080] mb-6">This message will be sent to agents after you sign an agreement.</p>
              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all"
                  style={{ borderColor: formData.next_steps_template_type === 'default' ? '#E3C567' : '#1F1F1F', backgroundColor: formData.next_steps_template_type === 'default' ? 'rgba(227,197,103,0.1)' : '#141414' }}>
                  <input type="radio" name="template_type" checked={formData.next_steps_template_type === 'default'} onChange={() => updateField('next_steps_template_type', 'default')} className="sr-only" />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all mt-0.5 ${formData.next_steps_template_type === 'default' ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
                    {formData.next_steps_template_type === 'default' && <div className="w-2 h-2 rounded-full bg-black" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-[#FAFAFA] text-[16px] font-semibold mb-2">Use Investor Konnect Template (Recommended)</div>
                    <div className="space-y-1 mb-3">
                      {['Automatically includes property details', 'Professional and comprehensive', 'Adapts based on walkthrough schedule'].map(t => (
                        <div key={t} className="flex items-center gap-2 text-sm text-[#E3C567]"><CheckCircle className="w-4 h-4" /><span>{t}</span></div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setShowTemplatePreview(true)} className="text-sm text-[#E3C567] hover:text-[#EDD89F] font-medium underline transition-colors">Preview Template →</button>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all"
                  style={{ borderColor: formData.next_steps_template_type === 'custom' ? '#E3C567' : '#1F1F1F', backgroundColor: formData.next_steps_template_type === 'custom' ? 'rgba(227,197,103,0.1)' : '#141414' }}>
                  <input type="radio" name="template_type" checked={formData.next_steps_template_type === 'custom'} onChange={() => updateField('next_steps_template_type', 'custom')} className="sr-only" />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all mt-0.5 ${formData.next_steps_template_type === 'custom' ? 'bg-[#E3C567] border-[#E3C567]' : 'border-[#444] bg-transparent'}`}>
                    {formData.next_steps_template_type === 'custom' && <div className="w-2 h-2 rounded-full bg-black" />}
                  </div>
                  <div className="text-[#FAFAFA] text-[16px] font-semibold">Write My Own Custom Message</div>
                </label>
                {formData.next_steps_template_type === 'custom' && (
                  <div className="pl-8">
                    <Textarea value={formData.custom_next_steps_template} onChange={(e) => updateField('custom_next_steps_template', e.target.value)} placeholder="Write your message to agents here (minimum 50 characters)..." rows={6} className="text-[15px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#666666] focus:border-[#E3C567] focus:ring-2 focus:ring-[#E3C567]/30 leading-relaxed" />
                  </div>
                )}
              </div>
            </div>
            <div className="bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-xl p-5 mt-6">
              <h4 className="font-semibold text-[#E3C567] mb-2">🎉 You're almost done!</h4>
              <p className="text-sm text-[#E3C567]">Next, you'll choose a subscription plan to unlock agent matching and deal rooms.</p>
            </div>
          </div>
          <Dialog open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
            <DialogContent className="max-w-2xl bg-[#0D0D0D] border-[#1F1F1F]">
              <DialogHeader>
                <DialogTitle className="text-[#E3C567]">Next Steps Message Template Preview</DialogTitle>
              </DialogHeader>
              <div className="max-h-[500px] overflow-y-auto bg-[#141414] rounded-lg p-5 text-[#FAFAFA] text-sm whitespace-pre-wrap leading-relaxed border border-[#1F1F1F]">
                {`Hi John,

Thank you for signing the agreement on the 123 Main St, Tampa, FL 33602 deal. We're excited to move forward together.

Here's what happens next:

Walkthrough scheduled for Monday, March 10th at 2:00 PM on-site. Please arrive 15 minutes early.

Once the walkthrough is complete, we'll send you the inspection report and any additional details needed for closing.

Please feel free to reach out if you have any questions:
• Email: sarah@example.com
• Phone: (555) 123-4567

Best regards,
Sarah Johnson`}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </OnboardingShell>
  );
}
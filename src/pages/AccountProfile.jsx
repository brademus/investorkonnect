import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { User, CheckCircle, ArrowLeft, Camera, Loader2, CreditCard, X, Bell, AlertCircle } from "lucide-react";
import { getCountyCentroid } from "@/components/utils/agentScoring";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
import NextStepsTemplateEditor from "@/components/NextStepsTemplateEditor";
import LoadingAnimation from "@/components/LoadingAnimation";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";

/**
 * ACCOUNT PROFILE EDITOR
 * 
 * Mini profile form for basic info (name, phone, company).
 * NOT the full onboarding - after save, if investor not onboarded,
 * they must be sent to NEW InvestorOnboarding.
 */
function AccountProfileContent() {
  const navigate = useNavigate();
  const { loading: profileLoading, user, profile, role, onboarded } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [headshotUrl, setHeadshotUrl] = useState("");
  const [businessCardUrl, setBusinessCardUrl] = useState("");
  const [countyValid, setCountyValid] = useState(null);
  const [countyChecking, setCountyChecking] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    role: "",
    company: "",
    company_address: "",
    markets: "",
    phone: "",
    accreditation: "",
    goals: "",
    brokerage: "",
    license_number: "",
    main_county: "",
    next_steps_template: "",
    next_steps_template_type: "default",
    custom_next_steps_template: "",
    // Agent: state licenses
    state_licenses: {},
    licensed_states: [],
  });
  const [notifPrefs, setNotifPrefs] = useState({ app: true, email: true, text: false });

  // County validation — same as onboarding
  useEffect(() => {
    if (formData.role !== 'agent') return;
    const county = formData.main_county.trim();
    const primaryState = profile?.agent?.license_state || profile?.license_state || profile?.target_state || '';
    if (!county || !primaryState) { setCountyValid(null); setCountyChecking(false); return; }
    setCountyChecking(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const coords = await getCountyCentroid(county, primaryState);
      if (!cancelled) { setCountyValid(coords !== null); setCountyChecking(false); }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.main_county, formData.role, profile]);

  useEffect(() => {
    document.title = "Edit Profile - Investor Konnect";
    
    if (!profileLoading && profile) {
      setHeadshotUrl(profile.headshotUrl || "");
      setBusinessCardUrl(profile.businessCardUrl || "");
      setNotifPrefs({
        app: profile.notification_preferences?.app !== false,
        email: profile.notification_preferences?.email !== false,
        text: profile.notification_preferences?.text === true,
      });
      // Build state_licenses from profile
      const existingStateLicenses = profile.agent?.state_licenses || {};
      // Backfill from legacy fields if empty
      if (Object.keys(existingStateLicenses).length === 0) {
        const primaryState = profile.agent?.license_state || profile.license_state || '';
        const primaryLicense = profile.agent?.license_number || profile.license_number || '';
        if (primaryState && primaryLicense) existingStateLicenses[primaryState] = primaryLicense;
      }
      const existingLicensedStates = profile.agent?.licensed_states || Object.keys(existingStateLicenses);

      setFormData({
        full_name: profile.full_name || "",
        role: profile.user_role || profile.user_type || "",
        company: profile.company || "",
        company_address: profile.company_address || "",
        markets: Array.isArray(profile.markets) ? profile.markets.join(", ") : "",
        phone: profile.phone || "",
        accreditation: profile.accreditation || "",
        goals: profile.goals || "",
        brokerage: profile.agent?.brokerage || profile.broker || "",
        license_number: profile.agent?.license_number || profile.license_number || "",
        main_county: profile.agent?.main_county || "",
        next_steps_template: profile.next_steps_template || "",
        next_steps_template_type: profile.next_steps_template_type || "default",
        custom_next_steps_template: profile.custom_next_steps_template || "",
        state_licenses: existingStateLicenses,
        licensed_states: existingLicensedStates,
      });
      setLoading(false);
    }
  }, [profileLoading, profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('[AccountProfile] 🚀 Saving profile changes...');

    // Validation
    if (!formData.full_name || !formData.full_name.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    if (formData.role === 'agent' && formData.main_county.trim() && countyValid === false) {
      toast.error("Please enter a valid county that exists in our system");
      return;
    }

    if (formData.role === 'agent') {
      if (formData.licensed_states.length === 0) {
        toast.error("Please select at least one licensed state");
        return;
      }
      const missingLicense = formData.licensed_states.find(st => !(formData.state_licenses[st] || '').trim());
      if (missingLicense) {
        toast.error(`Please enter a license number for ${missingLicense}`);
        return;
      }
    }

    setSaving(true);

    try {
      const updateData = {
        full_name: formData.full_name.trim(),
        headshotUrl: headshotUrl || null,
        businessCardUrl: businessCardUrl || null,
        company: formData.company.trim(),
        company_address: formData.company_address.trim(),
        markets: formData.markets.split(",").map(s => s.trim()).filter(Boolean),
        phone: formData.phone.trim(),
        accreditation: formData.accreditation.trim(),
        goals: formData.goals.trim(),
        next_steps_template: formData.next_steps_template || null,
        next_steps_template_type: formData.next_steps_template_type || "default",
        custom_next_steps_template: formData.next_steps_template_type === 'custom' ? formData.custom_next_steps_template : null,
        notification_preferences: notifPrefs
      };
      
      // Add agent-specific fields if user is an agent
      if (formData.role === 'agent') {
        const licensedStates = formData.licensed_states;
        const firstState = licensedStates[0] || '';
        const firstLicense = formData.state_licenses[firstState] || '';

        const agentUpdate = {
          ...(profile.agent || {}),
          brokerage: formData.brokerage.trim(),
          license_number: firstLicense,
          license_state: firstState,
          state_licenses: formData.state_licenses,
          licensed_states: licensedStates,
          markets: licensedStates,
          main_county: formData.main_county.trim()
        };

        // Also update top-level markets for matching
        updateData.markets = licensedStates;
        updateData.license_number = firstLicense;
        updateData.license_state = firstState;
        updateData.target_state = firstState;

        // Geocode main county for matching if it changed
        const oldCounty = (profile.agent?.main_county || '').trim().toLowerCase();
        const newCounty = formData.main_county.trim().toLowerCase();
        if (newCounty && newCounty !== oldCounty) {
          if (firstState) {
            const coords = await getCountyCentroid(formData.main_county.trim(), firstState);
            if (coords) {
              agentUpdate.lat = coords.lat;
              agentUpdate.lng = coords.lng;
              console.log('[AccountProfile] Geocoded county:', formData.main_county, firstState, coords);
            }
          }
        }

        updateData.agent = agentUpdate;
      }

      console.log('[AccountProfile] 📤 Updating profile:', updateData);

      // Directly update the Profile entity (role cannot change)
      await base44.entities.Profile.update(profile.id, updateData);

      console.log('[AccountProfile] ✅ Profile updated successfully!');
      toast.success("Profile updated successfully!");

      // Go back to Pipeline
      setTimeout(() => {
        navigate(createPageUrl("Pipeline"));
      }, 500);

    } catch (error) {
      console.error("[AccountProfile] ❌ Save error:", error);
      toast.error(error.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
          <p className="text-[#808080]">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl("Pipeline")} className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-4">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <User className="w-8 h-8 text-[#E3C567]" />
            <h1 className="text-3xl font-bold text-[#FAFAFA]">Edit Profile</h1>
          </div>
          <p className="text-[#808080]">Update your account information</p>
        </div>

        {/* Profile Form */}
        <div className="ik-card p-8" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture & Business Card - side by side */}
            <div>
              <Label className="text-[#FAFAFA] mb-3 block">Profile Picture & Business Card</Label>
              <div className="flex items-start gap-6">
                {/* Profile Picture */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#1F1F1F] bg-[#141414] flex items-center justify-center">
                      {headshotUrl ? (
                        <img src={headshotUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-[#808080]" />
                      )}
                    </div>
                    <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {uploadingPhoto ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={saving || uploadingPhoto}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
                          setUploadingPhoto(true);
                          try {
                            const { file_url } = await base44.integrations.Core.UploadFile({ file });
                            setHeadshotUrl(file_url);
                            await base44.entities.Profile.update(profile.id, { headshotUrl: file_url });
                            toast.success("Photo uploaded!");
                          } catch (err) { toast.error("Failed to upload photo"); }
                          finally { setUploadingPhoto(false); }
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-[#808080] text-center">Profile Photo</p>
                </div>

                {/* Divider */}
                <div className="w-px self-stretch bg-[#1F1F1F]" />

                {/* Business Card */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative group">
                    <div className="w-40 h-24 rounded-xl overflow-hidden border-2 border-dashed border-[#1F1F1F] bg-[#141414] flex items-center justify-center">
                      {businessCardUrl ? (
                        <img src={businessCardUrl} alt="Business Card" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-[#808080]">
                          <CreditCard className="w-7 h-7" />
                          <span className="text-[10px]">Upload Card</span>
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {uploadingCard ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={saving || uploadingCard}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
                          setUploadingCard(true);
                          try {
                            const { file_url } = await base44.integrations.Core.UploadFile({ file });
                            setBusinessCardUrl(file_url);
                            await base44.entities.Profile.update(profile.id, { businessCardUrl: file_url });
                            toast.success("Business card uploaded!");
                          } catch (err) { toast.error("Failed to upload business card"); }
                          finally { setUploadingCard(false); }
                        }}
                      />
                    </label>
                    {businessCardUrl && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setBusinessCardUrl("");
                          await base44.entities.Profile.update(profile.id, { businessCardUrl: null });
                          toast.success("Business card removed");
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[#808080] text-center">Business Card</p>
                </div>
              </div>
            </div>

            {/* Full Name (read-only) */}
            <div>
              <Label htmlFor="full_name" className="text-[#FAFAFA]">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                disabled
                className="bg-[#141414] text-[#808080] border-[#333] opacity-50"
              />
              <p className="text-xs text-[#808080] mt-1">Name cannot be changed</p>
            </div>

            {/* Email (read-only) */}
            <div>
              <Label htmlFor="email" className="text-[#FAFAFA]">Email</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-[#141414] text-[#808080] border-[#333] opacity-50"
              />
              <p className="text-xs text-[#808080] mt-1">Email cannot be changed</p>
            </div>

            {/* Account Type (read-only) */}
            <div>
              <Label htmlFor="account_type" className="text-[#FAFAFA]">Account Type</Label>
              <Input
                id="account_type"
                value={formData.role === 'investor' ? 'Investor' : formData.role === 'agent' ? 'Agent' : 'Member'}
                disabled
                className="bg-[#141414] text-[#808080] border-[#333] opacity-50"
              />
              <p className="text-xs text-[#808080] mt-1">Account type cannot be changed</p>
            </div>

            {/* Company */}
            <div>
              <Label htmlFor="company" className="text-[#FAFAFA]">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                placeholder="Your Company"
                disabled={saving}
                className="bg-[#141414] border-[#333] text-[#FAFAFA]"
              />
            </div>

            {/* Company Address */}
            <div>
              <Label htmlFor="company_address" className="text-[#FAFAFA]">Company Address</Label>
              <Input
                id="company_address"
                value={formData.company_address}
                onChange={(e) => setFormData({...formData, company_address: e.target.value})}
                placeholder="123 Main St, Suite 100, City, State ZIP"
                disabled={saving}
                className="bg-[#141414] border-[#333] text-[#FAFAFA]"
              />
              <p className="text-xs text-[#808080] mt-1">Visible to your counterparty after agreement is signed</p>
            </div>

            {/* Markets */}
            <div>
              <Label htmlFor="markets" className="text-[#FAFAFA]">Target Markets</Label>
              <Input
                id="markets"
                value={formData.markets}
                onChange={(e) => setFormData({...formData, markets: e.target.value})}
                placeholder="Miami, Phoenix, Dallas"
                disabled={saving}
                className="bg-[#141414] border-[#333] text-[#FAFAFA]"
              />
              <p className="text-xs text-[#808080] mt-1">Cities or metro areas (comma-separated)</p>
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone" className="text-[#FAFAFA]">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  let formatted = '';
                  if (digits.length > 0) formatted = '(' + digits.slice(0, 3);
                  if (digits.length >= 3) formatted += ') ' + digits.slice(3, 6);
                  if (digits.length >= 6) formatted += '-' + digits.slice(6, 10);
                  setFormData({...formData, phone: formatted});
                }}
                placeholder="(555) 123-4567"
                disabled={saving}
                className="bg-[#141414] border-[#333] text-[#FAFAFA]"
              />
            </div>

            {/* Accreditation */}
            <div>
              <Label htmlFor="accreditation" className="text-[#FAFAFA]">Accreditation</Label>
              <Input
                id="accreditation"
                value={formData.accreditation}
                onChange={(e) => setFormData({...formData, accreditation: e.target.value})}
                placeholder="e.g., Accredited Investor, Licensed Agent"
                disabled={saving}
                className="bg-[#141414] border-[#333] text-[#FAFAFA]"
              />
            </div>

            {/* Goals */}
            <div>
              <Label htmlFor="goals" className="text-[#FAFAFA]">Goals</Label>
              <Textarea
                id="goals"
                value={formData.goals}
                onChange={(e) => setFormData({...formData, goals: e.target.value})}
                placeholder="What are you looking to accomplish on Investor Konnect?"
                rows={4}
                disabled={saving}
                className="bg-[#141414] border-[#333] text-[#FAFAFA]"
              />
            </div>

            {/* Next Steps Template - Investors only */}
            {formData.role === 'investor' && (
              <div className="pt-4 border-t border-[#1F1F1F]">
                <NextStepsTemplateEditor
                  value={formData.custom_next_steps_template}
                  templateType={formData.next_steps_template_type}
                  onTypeChange={(type) => setFormData({...formData, next_steps_template_type: type})}
                  onChange={(val) => setFormData({...formData, custom_next_steps_template: val})}
                  disabled={saving}
                />
              </div>
            )}

            {/* Agent-specific fields */}
            {formData.role === 'agent' && (
              <>
                <div className="pt-4 border-t border-[#1F1F1F]">
                  <h3 className="text-lg font-semibold text-[#FAFAFA] mb-4">Agent Information</h3>
                </div>

                <div>
                  <Label htmlFor="brokerage" className="text-[#FAFAFA]">Brokerage Name *</Label>
                  <Input
                    id="brokerage"
                    value={formData.brokerage}
                    onChange={(e) => setFormData({...formData, brokerage: e.target.value})}
                    placeholder="RE/MAX, Keller Williams, etc."
                    disabled={saving}
                    className="bg-[#141414] border-[#333] text-[#FAFAFA]"
                  />
                  <p className="text-xs text-[#808080] mt-1">Required for generating agreements</p>
                </div>

                {/* Licensed States — select states, then enter license per state */}
                <div>
                  <Label className="text-[#FAFAFA]">Licensed States *</Label>
                  <p className="text-xs text-[#808080] mt-1 mb-3">Select all states where you hold an active real estate license</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-3 border border-[#1F1F1F] rounded-lg bg-[#0A0A0A]">
                    {US_STATES.map((state) => (
                      <div key={state} className="flex items-center gap-2">
                        <Checkbox
                          id={`acct-state-${state}`}
                          checked={formData.licensed_states.includes(state)}
                          disabled={saving}
                          onCheckedChange={() => {
                            setFormData(prev => {
                              const isSelected = prev.licensed_states.includes(state);
                              const newStates = isSelected
                                ? prev.licensed_states.filter(s => s !== state)
                                : [...prev.licensed_states, state];
                              const newLicenses = { ...prev.state_licenses };
                              if (isSelected) delete newLicenses[state];
                              return { ...prev, licensed_states: newStates, state_licenses: newLicenses };
                            });
                          }}
                          className="border-[#E3C567] data-[state=checked]:bg-[#E3C567] data-[state=checked]:border-[#E3C567]"
                        />
                        <Label htmlFor={`acct-state-${state}`} className="text-sm font-normal cursor-pointer text-[#FAFAFA]">{state}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-state license numbers */}
                {formData.licensed_states.length > 0 && (
                  <div>
                    <Label className="text-[#FAFAFA]">License Numbers *</Label>
                    <p className="text-xs text-[#808080] mt-1 mb-3">Enter your license number for each state</p>
                    <div className="space-y-3">
                      {formData.licensed_states.map((state) => (
                        <div key={state}>
                          <Label className="text-[#FAFAFA] text-sm font-medium mb-1 block">{state} License Number</Label>
                          <Input
                            value={formData.state_licenses[state] || ''}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              state_licenses: { ...prev.state_licenses, [state]: e.target.value }
                            }))}
                            placeholder={`e.g., ${state}-123456`}
                            disabled={saving}
                            className="bg-[#141414] border-[#333] text-[#FAFAFA]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="main_county" className="text-[#FAFAFA]">Main County *</Label>
                  <Input
                    id="main_county"
                    value={formData.main_county}
                    onChange={(e) => setFormData({...formData, main_county: e.target.value})}
                    placeholder="e.g., Maricopa"
                    disabled={saving}
                    className={`bg-[#141414] text-[#FAFAFA] ${
                      formData.main_county.trim() && !countyChecking
                        ? countyValid
                          ? 'border-green-500 focus:border-green-500'
                          : 'border-red-500 focus:border-red-500'
                        : 'border-[#333]'
                    }`}
                  />
                  <div className="mt-1.5 min-h-[18px]">
                    {countyChecking && formData.main_county.trim() && (
                      <p className="text-xs text-[#808080]">Checking county...</p>
                    )}
                    {!countyChecking && formData.main_county.trim() && countyValid === true && (
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> County recognized — location updated for matching
                      </p>
                    )}
                    {!countyChecking && formData.main_county.trim() && countyValid === false && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> County not found in {profile?.agent?.license_state || profile?.target_state || 'your state'}. Try just the county name without "County".
                      </p>
                    )}
                    {!formData.main_county.trim() && (
                      <p className="text-xs text-[#808080]">Your primary county of operation — used for agent matching</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Notification Settings */}
            <div className="pt-4 border-t border-[#1F1F1F]">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-[#E3C567]" />
                <h3 className="text-lg font-semibold text-[#FAFAFA]">Notification Settings</h3>
              </div>
              <div className="space-y-4">
                {[
                  { key: "app", label: "In-App Notifications", desc: "Receive notifications within the platform" },
                  { key: "email", label: "Email Notifications", desc: "Receive updates via email" },
                  { key: "text", label: "Text Notifications", desc: "Receive SMS alerts for important updates" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#FAFAFA]">{label}</p>
                      <p className="text-xs text-[#808080]">{desc}</p>
                    </div>
                    <Switch
                      checked={notifPrefs[key]}
                      onCheckedChange={async (val) => {
                        const updated = { app: notifPrefs.app ?? true, email: notifPrefs.email ?? true, text: notifPrefs.text ?? false, [key]: val };
                        setNotifPrefs(updated);
                        try {
                          await base44.entities.Profile.update(profile.id, { notification_preferences: updated });
                          toast.success("Saved");
                        } catch (e) {
                          toast.error("Failed to save");
                          setNotifPrefs(notifPrefs);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={saving || (formData.role === 'agent' && countyChecking)}
                className="flex-1 bg-[#E3C567] text-black hover:bg-[#EDD89F]"
              >
                {saving ? (
                  <>
                    <LoadingAnimation className="w-4 h-4 mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Link to={createPageUrl("Pipeline")}>
                <Button
                  type="button"
                  disabled={saving}
                  className="bg-[#0D0D0D] border border-[#1F1F1F] text-[#808080] hover:bg-[#141414] hover:border-[#333] hover:text-[#E3C567]"
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AccountProfile() {
  return (
    <AuthGuard requireAuth={true}>
      <AccountProfileContent />
    </AuthGuard>
  );
}
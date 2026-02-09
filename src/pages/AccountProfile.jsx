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
import { User, CheckCircle, ArrowLeft, Camera, Loader2 } from "lucide-react";
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
  const [headshotUrl, setHeadshotUrl] = useState("");
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
    license_number: ""
  });

  useEffect(() => {
    document.title = "Edit Profile - Investor Konnect";
    
    if (!profileLoading && profile) {
      setHeadshotUrl(profile.headshotUrl || "");
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
        license_number: profile.agent?.license_number || profile.license_number || ""
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

    setSaving(true);

    try {
      const updateData = {
        full_name: formData.full_name.trim(),
        headshotUrl: headshotUrl || null,
        company: formData.company.trim(),
        company_address: formData.company_address.trim(),
        markets: formData.markets.split(",").map(s => s.trim()).filter(Boolean),
        phone: formData.phone.trim(),
        accreditation: formData.accreditation.trim(),
        goals: formData.goals.trim()
      };
      
      // Add agent-specific fields if user is an agent
      if (formData.role === 'agent') {
        updateData.agent = {
          ...(profile.agent || {}),
          brokerage: formData.brokerage.trim(),
          license_number: formData.license_number.trim()
        };
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
        <div className="ik-card p-8 bg-[#0D0D0D] border border-[#1F1F1F]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div>
              <Label className="text-[#FAFAFA] mb-3 block">Profile Picture</Label>
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#1F1F1F] bg-[#141414] flex items-center justify-center">
                    {headshotUrl ? (
                      <img src={headshotUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-[#808080]" />
                    )}
                  </div>
                  <label
                    className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
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
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error("Image must be under 5MB");
                          return;
                        }
                        setUploadingPhoto(true);
                        try {
                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                          setHeadshotUrl(file_url);
                          // Save immediately to profile so it persists
                          await base44.entities.Profile.update(profile.id, { headshotUrl: file_url });
                          toast.success("Photo uploaded!");
                        } catch (err) {
                          console.error("Upload error:", err);
                          toast.error("Failed to upload photo");
                        } finally {
                          setUploadingPhoto(false);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="text-sm text-[#808080]">
                  <p>Click to upload a photo</p>
                  <p className="text-xs mt-1">JPG, PNG, or WebP · Max 5MB</p>
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <Label htmlFor="full_name" className="text-[#FAFAFA]">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="John Doe"
                required
                disabled={saving}
                className="bg-[#141414] border-[#333] text-[#FAFAFA]"
              />
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
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
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

                <div>
                  <Label htmlFor="license_number" className="text-[#FAFAFA]">License Number *</Label>
                  <Input
                    id="license_number"
                    value={formData.license_number}
                    onChange={(e) => setFormData({...formData, license_number: e.target.value})}
                    placeholder="Your real estate license number"
                    disabled={saving}
                    className="bg-[#141414] border-[#333] text-[#FAFAFA]"
                  />
                  <p className="text-xs text-[#808080] mt-1">Required for generating agreements</p>
                </div>
              </>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={saving}
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
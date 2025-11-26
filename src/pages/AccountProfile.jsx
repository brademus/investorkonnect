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
import { User, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
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
  const [formData, setFormData] = useState({
    full_name: "",
    role: "",
    company: "",
    markets: "",
    phone: "",
    accreditation: "",
    goals: ""
  });

  useEffect(() => {
    document.title = "Edit Profile - Investor Konnect";
    
    if (!profileLoading && profile) {
      setFormData({
        full_name: profile.full_name || "",
        role: profile.user_role || profile.user_type || "",
        company: profile.company || "",
        markets: Array.isArray(profile.markets) ? profile.markets.join(", ") : "",
        phone: profile.phone || "",
        accreditation: profile.accreditation || "",
        goals: profile.goals || ""
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

    if (!formData.role) {
      toast.error("Please select your account type");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        full_name: formData.full_name.trim(),
        role: formData.role,
        company: formData.company.trim(),
        markets: formData.markets.split(",").map(s => s.trim()).filter(Boolean),
        phone: formData.phone.trim(),
        accreditation: formData.accreditation.trim(),
        goals: formData.goals.trim(),
        complete: false // Don't reset onboarding status
      };

      console.log('[AccountProfile] 📤 Payload:', payload);

      // Call onboardingComplete to update profile
      const response = await fetch('/functions/onboardingComplete', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Invalid server response');
      }

      if (!response.ok || (!result.ok && !result.success)) {
        throw new Error(result.message || result.error || 'Save failed');
      }

      console.log('[AccountProfile] ✅ Profile updated successfully!');
      toast.success("Profile updated successfully!");

      // CRITICAL: After save, if investor not onboarded, send to NEW onboarding
      if (role === 'investor' && !onboarded) {
        console.log('[AccountProfile] Investor not onboarded, redirecting to InvestorOnboarding');
        toast.info('Please complete your full investor profile');
        setTimeout(() => {
          navigate(createPageUrl("InvestorOnboarding"));
        }, 1000);
      } else if (role === 'agent' && !onboarded) {
        console.log('[AccountProfile] Agent not onboarded, redirecting to AgentOnboarding');
        toast.info('Please complete your agent profile');
        setTimeout(() => {
          navigate(createPageUrl("AgentOnboarding"));
        }, 1000);
      } else {
        // Already onboarded, go to profile view
        setTimeout(() => {
          navigate(createPageUrl("Profile"));
        }, 500);
      }

    } catch (error) {
      console.error("[AccountProfile] ❌ Save error:", error);
      toast.error(error.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl("Profile")} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <User className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Edit Profile</h1>
          </div>
          <p className="text-slate-600">Update your account information</p>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="John Doe"
                required
                disabled={saving}
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-slate-50 text-slate-500"
              />
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>

            {/* User Type */}
            <div>
              <Label className="mb-3 block">Account Type *</Label>
              <RadioGroup
                value={formData.role}
                onValueChange={(value) => setFormData({...formData, role: value})}
                disabled={saving}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.role === "investor" 
                      ? "border-blue-600 bg-blue-50" 
                      : "border-slate-200 hover:border-slate-300"
                  } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="investor" id="investor" />
                      <Label htmlFor="investor" className="cursor-pointer font-semibold">
                        Investor
                      </Label>
                    </div>
                  </div>
                  <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.role === "agent" 
                      ? "border-emerald-600 bg-emerald-50" 
                      : "border-slate-200 hover:border-slate-300"
                  } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="agent" id="agent" />
                      <Label htmlFor="agent" className="cursor-pointer font-semibold">
                        Agent
                      </Label>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Company */}
            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                placeholder="Your Company"
                disabled={saving}
              />
            </div>

            {/* Markets */}
            <div>
              <Label htmlFor="markets">Target Markets</Label>
              <Input
                id="markets"
                value={formData.markets}
                onChange={(e) => setFormData({...formData, markets: e.target.value})}
                placeholder="Miami, Phoenix, Dallas"
                disabled={saving}
              />
              <p className="text-xs text-slate-500 mt-1">Cities or metro areas (comma-separated)</p>
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="(555) 123-4567"
                disabled={saving}
              />
            </div>

            {/* Accreditation */}
            <div>
              <Label htmlFor="accreditation">Accreditation</Label>
              <Input
                id="accreditation"
                value={formData.accreditation}
                onChange={(e) => setFormData({...formData, accreditation: e.target.value})}
                placeholder="e.g., Accredited Investor, Licensed Agent"
                disabled={saving}
              />
            </div>

            {/* Goals */}
            <div>
              <Label htmlFor="goals">Goals</Label>
              <Textarea
                id="goals"
                value={formData.goals}
                onChange={(e) => setFormData({...formData, goals: e.target.value})}
                placeholder="What are you looking to accomplish on Investor Konnect?"
                rows={4}
                disabled={saving}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Link to={createPageUrl("Profile")}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
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
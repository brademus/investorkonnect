
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { User, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function AccountProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
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
    document.title = "Profile & Preferences - AgentVault";
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Check authentication via /functions/me
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        toast.info("Please sign in to access your profile");
        navigate(createPageUrl("SignIn") + "?next=" + encodeURIComponent(window.location.pathname));
        return;
      }

      const state = await response.json();

      if (!state.authenticated) {
        toast.info("Please sign in to access your profile");
        navigate(createPageUrl("SignIn") + "?next=" + encodeURIComponent(window.location.pathname));
        return;
      }

      if (!state.onboarding?.completed) {
        toast.info("Please complete onboarding first");
        navigate(createPageUrl("Onboarding") + "?next=" + encodeURIComponent(window.location.pathname));
        return;
      }

      setUser({
        email: state.email,
        id: state.profile?.user_id
      });

      // Load profile data
      setFormData({
        full_name: state.profile?.full_name || "",
        role: state.profile?.user_type || "",
        company: state.profile?.company || "",
        markets: (state.profile?.markets || []).join(", ") || "",
        phone: state.profile?.phone || "",
        accreditation: state.profile?.accreditation || "",
        goals: state.profile?.goals || ""
      });

      setLoading(false);

    } catch (error) {
      console.error('Profile load error:', error);
      toast.error("Failed to load profile");
      navigate(createPageUrl("Dashboard"));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        full_name: formData.full_name,
        role: formData.role,
        company: formData.company,
        markets: formData.markets.split(",").map(s => s.trim()).filter(Boolean),
        phone: formData.phone,
        accreditation: formData.accreditation,
        goals: formData.goals,
        complete: false // Don't reset onboarding status
      };

      await base44.functions.invoke('profileUpsert', payload);
      toast.success("Profile updated successfully!");

    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          <div className="flex items-center gap-3 mb-2">
            <User className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Profile & Preferences</h1>
          </div>
          <p className="text-slate-600">View and update your account information</p>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="John Doe"
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
              <Label className="mb-3 block">Account Type</Label>
              <RadioGroup
                value={formData.role}
                onValueChange={(value) => setFormData({...formData, role: value})}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.role === "investor" 
                      ? "border-blue-600 bg-blue-50" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}>
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
                  }`}>
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
              />
            </div>

            {/* Markets */}
            <div>
              <Label htmlFor="markets">Target Markets</Label>
              <Input
                id="markets"
                value={formData.markets}
                onChange={(e) => setFormData({...formData, markets: e.target.value})}
                placeholder="Miami, Phoenix, Dallas (comma-separated)"
              />
              <p className="text-xs text-slate-500 mt-1">Cities or metro areas you're focused on</p>
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
              />
            </div>

            {/* Goals */}
            <div>
              <Label htmlFor="goals">Goals</Label>
              <Textarea
                id="goals"
                value={formData.goals}
                onChange={(e) => setFormData({...formData, goals: e.target.value})}
                placeholder="What are you looking to accomplish?"
                rows={4}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(createPageUrl("Dashboard"))}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

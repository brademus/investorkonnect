import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Vetting() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    licenseNumber: '',
    licenseState: '',
    broker: '',
    proofLinks: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) {
        navigate(createPageUrl("SignIn"));
        return;
      }

      const profiles = await base44.entities.Profile.filter({ email: user.email });
      if (profiles.length === 0) {
        navigate(createPageUrl("Onboarding"));
        return;
      }

      const prof = profiles[0];
      setProfile(prof);
      setFormData({
        licenseNumber: prof.licenseNumber || '',
        licenseState: prof.licenseState || '',
        broker: prof.broker || '',
        proofLinks: (prof.proofLinks || []).join('\n')
      });
      setLoading(false);
    } catch (error) {
      toast.error("Failed to load profile");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const proofLinksArray = formData.proofLinks
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      await base44.entities.Profile.update(profile.id, {
        licenseNumber: formData.licenseNumber,
        licenseState: formData.licenseState,
        broker: formData.broker,
        proofLinks: proofLinksArray,
        status: 'pending'
      });

      toast.success("Vetting application submitted!");
      loadProfile();
    } catch (error) {
      toast.error("Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      title: 'Vetting In Progress',
      description: 'Your application is being reviewed by our team. This typically takes 3-5 business days.'
    },
    approved: {
      icon: CheckCircle,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      title: 'Approved!',
      description: 'You are now a vetted agent. You can accept connection requests from investors.'
    },
    rejected: {
      icon: AlertCircle,
      color: 'bg-red-100 text-red-800 border-red-200',
      title: 'Application Not Approved',
      description: 'Unfortunately, we cannot approve your application at this time. Please contact support for more details.'
    }
  };

  const currentStatus = profile?.vetted ? 'approved' : (profile?.status || 'pending');
  const status = statusConfig[currentStatus] || statusConfig.pending;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Agent Vetting</h1>
          <p className="text-slate-600">Submit your credentials for verification</p>
        </div>

        {/* Status Card */}
        <div className={`rounded-xl p-6 mb-8 border-2 ${status.color}`}>
          <div className="flex items-start gap-4">
            <status.icon className="w-8 h-8 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">{status.title}</h3>
              <p className="text-sm">{status.description}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        {!profile?.vetted && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Verification Information</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="licenseNumber">Real Estate License Number *</Label>
                <Input
                  id="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})}
                  placeholder="e.g., CA-123456"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <Label htmlFor="licenseState">State *</Label>
                <Input
                  id="licenseState"
                  value={formData.licenseState}
                  onChange={(e) => setFormData({...formData, licenseState: e.target.value})}
                  placeholder="e.g., California"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <Label htmlFor="broker">Broker Affiliation *</Label>
                <Input
                  id="broker"
                  value={formData.broker}
                  onChange={(e) => setFormData({...formData, broker: e.target.value})}
                  placeholder="e.g., Keller Williams"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <Label htmlFor="proofLinks">Verification Links</Label>
                <Textarea
                  id="proofLinks"
                  value={formData.proofLinks}
                  onChange={(e) => setFormData({...formData, proofLinks: e.target.value})}
                  placeholder="Links to license verification, LinkedIn, company website (one per line)"
                  rows={4}
                  disabled={submitting}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Add any links that help verify your credentials (state license lookup, LinkedIn, broker page, etc.)
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Submit for Vetting
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Next Steps */}
        {profile?.vetted && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What's Next?</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">Check your inbox for connection requests from investors</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">Build your reputation by providing excellent service</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">Earn verified reviews from completed transactions</p>
              </div>
            </div>
            <div className="mt-6">
              <Button 
                onClick={() => navigate(createPageUrl("Inbox"))}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Go to Inbox
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
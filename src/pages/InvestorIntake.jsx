import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, Target } from "lucide-react";
import { toast } from "sonner";

const PROPERTY_TYPES = [
  "Single Family",
  "Multi-Family",
  "Commercial",
  "Industrial",
  "Land",
  "Mixed-Use"
];

const TIMELINES = [
  "Immediate (0-3 months)",
  "Medium (3-12 months)",
  "Long-term (1+ years)"
];

function InvestorIntakeContent() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    budget_min: '',
    budget_max: '',
    property_types: [],
    target_cities: '',
    criteria: '',
    timeline: ''
  });

  const TOTAL_STEPS = 5;

  useEffect(() => {
    document.title = "Investment Criteria - Investor Konnect";

    // Load existing intake data
    if (profile?.investor?.buy_box) {
      const buyBox = profile.investor.buy_box;
      setFormData({
        budget_min: buyBox.min_budget || '',
        budget_max: buyBox.max_budget || '',
        property_types: buyBox.asset_types || [],
        target_cities: buyBox.target_locations || '',
        criteria: buyBox.criteria || '',
        timeline: buyBox.timeline || ''
      });
    }
  }, [profile]);

  const togglePropertyType = (type) => {
    setFormData(prev => ({
      ...prev,
      property_types: prev.property_types.includes(type)
        ? prev.property_types.filter(t => t !== type)
        : [...prev.property_types, type]
    }));
  };

  const handleNext = async () => {
    // Validation
    if (step === 1 && !formData.budget_min) {
      toast.error("Please enter a minimum budget");
      return;
    }
    if (step === 2 && formData.property_types.length === 0) {
      toast.error("Please select at least one property type");
      return;
    }

    if (step === TOTAL_STEPS) {
      await handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      // Get selected state from sessionStorage
      const selectedState = sessionStorage.getItem('selectedState');

      // Update profile with intake data
      const profiles = await base44.entities.Profile.filter({ user_id: profile.user_id });
      
      if (profiles.length > 0) {
        await base44.entities.Profile.update(profiles[0].id, {
          investor: {
            ...profiles[0].investor,
            buy_box: {
              min_budget: parseInt(formData.budget_min) || 0,
              max_budget: parseInt(formData.budget_max) || 0,
              asset_types: formData.property_types,
              target_locations: formData.target_cities,
              criteria: formData.criteria,
              timeline: formData.timeline,
              markets: selectedState ? [selectedState] : []
            }
          }
        });
      }

      toast.success("Investment criteria saved!");
      
      // Navigate to matches
      navigate(createPageUrl("Matches"));

    } catch (error) {
      console.error('Intake save error:', error);
      toast.error("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-sm font-medium text-blue-600">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          
          {/* Step 1: Budget */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">Investment Budget</h2>
                    <p className="text-slate-600">What's your target investment range?</p>
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget_min">Minimum Budget *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      id="budget_min"
                      type="number"
                      value={formData.budget_min}
                      onChange={(e) => setFormData({...formData, budget_min: e.target.value})}
                      placeholder="100000"
                      className="text-lg py-6 pl-7"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_max">Maximum Budget</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      id="budget_max"
                      type="number"
                      value={formData.budget_max}
                      onChange={(e) => setFormData({...formData, budget_max: e.target.value})}
                      placeholder="500000"
                      className="text-lg py-6 pl-7"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Property Types */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Property Types</h2>
                <p className="text-slate-600">What types of properties interest you?</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-3">
                {PROPERTY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => togglePropertyType(type)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.property_types.includes(type)
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                        : 'border-slate-200 hover:border-blue-300 text-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Target Locations */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Target Locations</h2>
                <p className="text-slate-600">Which cities or areas are you targeting?</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="target_cities">Cities or Neighborhoods</Label>
                <Input
                  id="target_cities"
                  type="text"
                  value={formData.target_cities}
                  onChange={(e) => setFormData({...formData, target_cities: e.target.value})}
                  placeholder="e.g., Phoenix, Scottsdale, Tempe"
                  className="text-lg py-6"
                  autoFocus
                />
                <p className="text-sm text-slate-500">Separate multiple locations with commas</p>
              </div>
            </div>
          )}

          {/* Step 4: Special Criteria */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Special Requirements</h2>
                <p className="text-slate-600">Any specific constraints or preferences? (Optional)</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="criteria">Investment Criteria</Label>
                <textarea
                  id="criteria"
                  value={formData.criteria}
                  onChange={(e) => setFormData({...formData, criteria: e.target.value})}
                  placeholder="e.g., Must be cash-flowing, prefer turnkey properties, looking for value-add opportunities..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none min-h-32"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 5: Timeline */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Investment Timeline</h2>
                <p className="text-slate-600">When are you looking to invest?</p>
              </div>
              
              <div className="space-y-3">
                {TIMELINES.map(timeline => (
                  <button
                    key={timeline}
                    type="button"
                    onClick={() => setFormData({...formData, timeline})}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      formData.timeline === timeline
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                        : 'border-slate-200 hover:border-blue-300 text-slate-700'
                    }`}
                  >
                    {timeline}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={() => setStep(step - 1)}
                disabled={saving}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : <div />}
            
            <Button
              onClick={handleNext}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : step === TOTAL_STEPS ? (
                <>
                  Find Matches
                  <CheckCircle className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvestorIntake() {
  return (
    <AuthGuard 
      requireAuth={true}
      requireOnboarding={true}
      requireRole="investor"
    >
      <InvestorIntakeContent />
    </AuthGuard>
  );
}
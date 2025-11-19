import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { upsertBuyBox } from "@/components/functions";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Target, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const ASSET_TYPES = [
  "Single Family",
  "Multi-Family (2-4 units)",
  "Multi-Family (5+ units)",
  "Commercial",
  "Vacation Rental",
  "Land",
  "Development"
];

const DEAL_PROFILES = [
  { id: 'turnkey', label: 'Turnkey / stabilized' },
  { id: 'light_value_add', label: 'Light value-add' },
  { id: 'heavy_value_add', label: 'Heavy value-add / distressed' },
  { id: 'development', label: 'Development / ground-up' }
];

function InvestorBuyBoxContent() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    // Existing fields
    asset_types: [],
    markets: "",
    min_budget: "",
    max_budget: "",
    cap_rate_min: "",
    coc_min: "",
    
    // NEW fields (property-level, not in onboarding)
    deal_profile: [],           // Turnkey, light value-add, etc.
    deal_stage: "",             // On-market, off-market, both
    min_units: "",              // For multifamily
    max_units: "",              // For multifamily
    min_year_built: "",         // Property vintage
    max_year_built: "",         // Property vintage
    deployment_timeline: ""     // When ready to deploy capital
  });

  useEffect(() => {
    // Load existing buy box if present
    if (profile?.investor?.buy_box) {
      const bb = profile.investor.buy_box;
      setFormData({
        asset_types: bb.asset_types || [],
        markets: Array.isArray(bb.markets) ? bb.markets.join(", ") : "",
        min_budget: bb.min_budget || "",
        max_budget: bb.max_budget || "",
        cap_rate_min: bb.cap_rate_min || "",
        coc_min: bb.coc_min || "",
        deal_profile: bb.deal_profile || [],
        deal_stage: bb.deal_stage || "",
        min_units: bb.min_units || "",
        max_units: bb.max_units || "",
        min_year_built: bb.min_year_built || "",
        max_year_built: bb.max_year_built || "",
        deployment_timeline: bb.deployment_timeline || ""
      });
    }
  }, [profile]);

  const handleAssetTypeToggle = (type) => {
    setFormData(prev => ({
      ...prev,
      asset_types: prev.asset_types.includes(type)
        ? prev.asset_types.filter(t => t !== type)
        : [...prev.asset_types, type]
    }));
  };

  const handleDealProfileToggle = (id) => {
    setFormData(prev => ({
      ...prev,
      deal_profile: prev.deal_profile.includes(id)
        ? prev.deal_profile.filter(d => d !== id)
        : [...prev.deal_profile, id]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (formData.asset_types.length === 0) {
      toast.error("Please select at least one asset type");
      return;
    }
    
    if (!formData.markets.trim()) {
      toast.error("Please enter target markets");
      return;
    }

    setSaving(true);

    try {
      // Build buy_box object
      const buyBox = {
        asset_types: formData.asset_types,
        markets: formData.markets.split(",").map(s => s.trim()).filter(Boolean),
        min_budget: formData.min_budget ? parseFloat(formData.min_budget) : null,
        max_budget: formData.max_budget ? parseFloat(formData.max_budget) : null,
        cap_rate_min: formData.cap_rate_min ? parseFloat(formData.cap_rate_min) : null,
        coc_min: formData.coc_min ? parseFloat(formData.coc_min) : null,
        // NEW fields
        deal_profile: formData.deal_profile,
        deal_stage: formData.deal_stage || null,
        min_units: formData.min_units ? parseInt(formData.min_units) : null,
        max_units: formData.max_units ? parseInt(formData.max_units) : null,
        min_year_built: formData.min_year_built ? parseInt(formData.min_year_built) : null,
        max_year_built: formData.max_year_built ? parseInt(formData.max_year_built) : null,
        deployment_timeline: formData.deployment_timeline || null
      };

      console.log('[InvestorBuyBox] Saving buy box:', buyBox);

      // Call backend function to save
      const response = await upsertBuyBox({
        buy_box: buyBox
      });

      console.log('[InvestorBuyBox] Response:', response.data);

      if (response.data?.ok) {
        toast.success("Buy box saved successfully!");
        await refresh();
        
        setTimeout(() => {
          navigate(createPageUrl("InvestorHome"));
        }, 500);
      } else {
        throw new Error(response.data?.message || 'Failed to save buy box');
      }

    } catch (error) {
      console.error('[InvestorBuyBox] Save error:', error);
      toast.error(error.message || "Failed to save buy box");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to={createPageUrl("InvestorHome")} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-3 mb-2">
          <Target className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900">Buy Box</h1>
        </div>
        <p className="text-slate-600 mb-8">Define your deal-level filters for property matching</p>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Asset Types */}
            <div>
              <Label className="mb-3 block text-base font-semibold">Asset Types *</Label>
              <div className="grid md:grid-cols-2 gap-3">
                {ASSET_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`asset-${type}`}
                      checked={formData.asset_types.includes(type)}
                      onCheckedChange={() => handleAssetTypeToggle(type)}
                      disabled={saving}
                    />
                    <Label htmlFor={`asset-${type}`} className="cursor-pointer font-normal">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Markets */}
            <div>
              <Label htmlFor="markets" className="text-base font-semibold">Target Markets *</Label>
              <Input
                id="markets"
                value={formData.markets}
                onChange={(e) => setFormData({...formData, markets: e.target.value})}
                placeholder="Miami, Phoenix, Dallas"
                disabled={saving}
              />
              <p className="text-xs text-slate-500 mt-1">Cities or metro areas (comma-separated)</p>
            </div>

            {/* Budget Range */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min_budget">Min Budget</Label>
                <Input
                  id="min_budget"
                  type="number"
                  value={formData.min_budget}
                  onChange={(e) => setFormData({...formData, min_budget: e.target.value})}
                  placeholder="100000"
                  disabled={saving}
                />
              </div>
              <div>
                <Label htmlFor="max_budget">Max Budget</Label>
                <Input
                  id="max_budget"
                  type="number"
                  value={formData.max_budget}
                  onChange={(e) => setFormData({...formData, max_budget: e.target.value})}
                  placeholder="500000"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Return Targets */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cap_rate_min">Min Cap Rate (%)</Label>
                <Input
                  id="cap_rate_min"
                  type="number"
                  step="0.1"
                  value={formData.cap_rate_min}
                  onChange={(e) => setFormData({...formData, cap_rate_min: e.target.value})}
                  placeholder="8.0"
                  disabled={saving}
                />
              </div>
              <div>
                <Label htmlFor="coc_min">Min Cash-on-Cash (%)</Label>
                <Input
                  id="coc_min"
                  type="number"
                  step="0.1"
                  value={formData.coc_min}
                  onChange={(e) => setFormData({...formData, coc_min: e.target.value})}
                  placeholder="12.0"
                  disabled={saving}
                />
              </div>
            </div>

            {/* DIVIDER */}
            <div className="border-t border-slate-200 pt-6 mt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Additional Property Filters</h3>
            </div>

            {/* NEW: Deal Profile */}
            <div>
              <Label className="mb-2 block text-base font-semibold">Deal Profile</Label>
              <p className="text-sm text-slate-500 mb-3">What kind of deal profiles are you interested in?</p>
              <div className="grid md:grid-cols-2 gap-3">
                {DEAL_PROFILES.map((profile) => (
                  <div key={profile.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`profile-${profile.id}`}
                      checked={formData.deal_profile.includes(profile.id)}
                      onCheckedChange={() => handleDealProfileToggle(profile.id)}
                      disabled={saving}
                    />
                    <Label htmlFor={`profile-${profile.id}`} className="cursor-pointer font-normal">
                      {profile.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* NEW: Deal Stage */}
            <div>
              <Label className="mb-2 block text-base font-semibold">Deal Stage</Label>
              <p className="text-sm text-slate-500 mb-3">Are you open to listed deals, or off-market only?</p>
              <RadioGroup
                value={formData.deal_stage}
                onValueChange={(value) => setFormData({...formData, deal_stage: value})}
                disabled={saving}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="on_market" id="on_market" />
                  <Label htmlFor="on_market" className="cursor-pointer font-normal">On-market</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="off_market" id="off_market" />
                  <Label htmlFor="off_market" className="cursor-pointer font-normal">Off-market only</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="both" id="both" />
                  <Label htmlFor="both" className="cursor-pointer font-normal">Open to both</Label>
                </div>
              </RadioGroup>
            </div>

            {/* NEW: Size / Scale (Units) */}
            <div>
              <Label className="mb-2 block text-base font-semibold">Size / Scale (Units)</Label>
              <p className="text-sm text-slate-500 mb-3">If applicable, what's your preferred range for number of units?</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_units">Min Units</Label>
                  <Input
                    id="min_units"
                    type="number"
                    value={formData.min_units}
                    onChange={(e) => setFormData({...formData, min_units: e.target.value})}
                    placeholder="e.g. 4"
                    disabled={saving}
                  />
                </div>
                <div>
                  <Label htmlFor="max_units">Max Units</Label>
                  <Input
                    id="max_units"
                    type="number"
                    value={formData.max_units}
                    onChange={(e) => setFormData({...formData, max_units: e.target.value})}
                    placeholder="e.g. 50"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* NEW: Vintage / Year Built */}
            <div>
              <Label className="mb-2 block text-base font-semibold">Vintage / Year Built</Label>
              <p className="text-sm text-slate-500 mb-3">Any preferences for property vintage?</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_year_built">Min Year Built</Label>
                  <Input
                    id="min_year_built"
                    type="number"
                    value={formData.min_year_built}
                    onChange={(e) => setFormData({...formData, min_year_built: e.target.value})}
                    placeholder="e.g. 1980"
                    disabled={saving}
                  />
                </div>
                <div>
                  <Label htmlFor="max_year_built">Max Year Built</Label>
                  <Input
                    id="max_year_built"
                    type="number"
                    value={formData.max_year_built}
                    onChange={(e) => setFormData({...formData, max_year_built: e.target.value})}
                    placeholder="e.g. 2020"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* NEW: Deployment Timeline */}
            <div>
              <Label htmlFor="deployment_timeline" className="text-base font-semibold">Deployment Timeline</Label>
              <p className="text-sm text-slate-500 mb-3">When are you looking to deploy capital for deals in this buy box?</p>
              <Select
                value={formData.deployment_timeline}
                onValueChange={(value) => setFormData({...formData, deployment_timeline: value})}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediately</SelectItem>
                  <SelectItem value="3mo">Next 3 months</SelectItem>
                  <SelectItem value="3_12mo">3–12 months</SelectItem>
                  <SelectItem value="12plus">12+ months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <Button
                type="submit"
                disabled={saving || formData.asset_types.length === 0 || !formData.markets}
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
                    Save Buy Box
                  </>
                )}
              </Button>
              <Link to={createPageUrl("InvestorHome")}>
                <Button type="button" variant="outline" disabled={saving}>
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

export default function InvestorBuyBox() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorBuyBoxContent />
    </AuthGuard>
  );
}
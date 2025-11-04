import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

function InvestorBuyBoxContent() {
  const navigate = useNavigate();
  const { profile, refresh } = useCurrentProfile();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    asset_types: [],
    markets: "",
    min_budget: "",
    max_budget: "",
    cap_rate_min: "",
    coc_min: ""
  });

  useEffect(() => {
    if (profile?.investor?.buy_box) {
      const bb = profile.investor.buy_box;
      setFormData({
        asset_types: bb.asset_types || [],
        markets: Array.isArray(bb.markets) ? bb.markets.join(", ") : "",
        min_budget: bb.min_budget || "",
        max_budget: bb.max_budget || "",
        cap_rate_min: bb.cap_rate_min || "",
        coc_min: bb.coc_min || ""
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Build buy_box object
      const buyBox = {
        asset_types: formData.asset_types,
        markets: formData.markets.split(",").map(s => s.trim()).filter(Boolean),
        min_budget: formData.min_budget ? parseFloat(formData.min_budget) : null,
        max_budget: formData.max_budget ? parseFloat(formData.max_budget) : null,
        cap_rate_min: formData.cap_rate_min ? parseFloat(formData.cap_rate_min) : null,
        coc_min: formData.coc_min ? parseFloat(formData.coc_min) : null
      };

      // Update profile with new buy_box
      const updatedInvestor = {
        ...(profile.investor || {}),
        buy_box: buyBox
      };

      // Call backend to update (reuse profileUpsert or create new endpoint)
      const payload = {
        investor: updatedInvestor
      };

      const response = await fetch('/functions/profileUpsert', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to save buy box');
      }

      toast.success("Buy box saved successfully!");
      refresh();
      
      setTimeout(() => {
        navigate(createPageUrl("InvestorHome"));
      }, 500);

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
        
        <div className="flex items-center gap-3 mb-8">
          <Target className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900">Buy Box</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Asset Types */}
            <div>
              <Label className="mb-3 block">Asset Types *</Label>
              <div className="grid md:grid-cols-2 gap-3">
                {ASSET_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`asset-${type}`}
                      checked={formData.asset_types.includes(type)}
                      onCheckedChange={() => handleAssetTypeToggle(type)}
                      disabled={saving}
                    />
                    <Label htmlFor={`asset-${type}`} className="cursor-pointer">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Markets */}
            <div>
              <Label htmlFor="markets">Target Markets *</Label>
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

            {/* Submit */}
            <div className="flex gap-3 pt-4">
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
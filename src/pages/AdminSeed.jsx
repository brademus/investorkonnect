import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { demoSeed } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, CheckCircle, Database } from "lucide-react";
import { toast } from "sonner";

export default function AdminSeed() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) {
        navigate(createPageUrl("SignIn"));
        return;
      }

      const profiles = await base44.entities.Profile.filter({ email: user.email });
      if (profiles.length === 0 || profiles[0].role !== 'admin') {
        toast.error("Admin access required");
        navigate(createPageUrl("Dashboard"));
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    } catch (error) {
      console.error('Check admin error:', error);
      navigate(createPageUrl("Dashboard"));
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setResult(null);

    try {
      const response = await demoSeed();
      setResult(response.data);
      toast.success("Demo data seeded successfully!");
    } catch (error) {
      console.error('Seed error:', error);
      toast.error("Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-10 h-10 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin: Demo Data Seeder</h1>
            <p className="text-slate-600">Create demo agents for testing matches</p>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">What This Does</h3>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li>• Creates 8 demo agent profiles with varied markets</li>
            <li>• Includes mix of vetted and unvetted agents</li>
            <li>• Adds reputation scores and bios</li>
            <li>• Headshot placeholder images</li>
            <li>• Markets: Phoenix, Dallas, Miami, Nashville, Vegas, Orlando, Denver, San Diego</li>
          </ul>
        </div>

        {/* Seed Button */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 mb-6">
          <Button
            onClick={handleSeed}
            disabled={seeding}
            className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg"
          >
            {seeding ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Seeding Demo Data...
              </>
            ) : (
              <>
                <Database className="w-5 h-5 mr-2" />
                Seed Demo Data
              </>
            )}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-emerald-900 mb-3">✅ {result.summary.message}</h3>
                <div className="space-y-2 text-emerald-800">
                  <div className="flex items-center justify-between">
                    <span>Agents Created:</span>
                    <Badge className="bg-emerald-600">{result.summary.agentsCreated}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Demo Agents:</span>
                    <Badge variant="outline">{result.summary.totalAgents}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mt-6">
          <h3 className="font-semibold text-slate-900 mb-4">Next Steps:</h3>
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">1.</span>
              <span>Go to your profile and set your user_type to "investor" and add markets</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">2.</span>
              <span>Click "Get Matched" on homepage to generate matches</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">3.</span>
              <span>View matches at /matches and test connection flow</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">4.</span>
              <span>Switch to agent account to test inbox and room features</span>
            </li>
          </ol>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            Dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Matches"))}
          >
            View Matches
          </Button>
        </div>
      </div>
    </div>
  );
}
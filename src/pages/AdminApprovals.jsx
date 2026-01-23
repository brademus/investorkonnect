import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, UserCheck, X, CheckCircle, 
  Star, Flag, TrendingUp, Loader2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

export default function AdminApprovals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState(null);
  const [healthCheckResults, setHealthCheckResults] = useState(null);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);
  const [runningDedup, setRunningDedup] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = await base44.auth.me();
      
      // Canonical profile lookup: try email first, fallback to user_id
      let profiles = await base44.entities.Profile.filter({ 
        email: user.email.toLowerCase().trim()
      });
      
      if (profiles.length === 0) {
        profiles = await base44.entities.Profile.filter({ user_id: user.id });
      }
      
      if (profiles.length > 0 && profiles[0].role === "admin") {
        setProfile(profiles[0]);
      } else {
        navigate(createPageUrl("Dashboard"));
      }
    } catch (error) {
      navigate(createPageUrl("SignIn"));
    }
  };

  const { data: pendingAgents } = useQuery({
    queryKey: ['pending-agents'],
    queryFn: () => base44.entities.Profile.filter({ role: "agent", status: "pending" }),
    enabled: !!profile,
    initialData: []
  });

  const { data: flaggedReviews } = useQuery({
    queryKey: ['flagged-reviews'],
    queryFn: () => base44.entities.Review.filter({ flagged: true }),
    enabled: !!profile,
    initialData: []
  });

  const approveMutation = useMutation({
    mutationFn: async (profileId) => {
      await base44.entities.Profile.update(profileId, { status: "approved" });
      await base44.entities.AuditLog.create({
        actor_id: profile.id,
        actor_name: profile.name,
        entity_type: "Profile",
        entity_id: profileId,
        action: "approve",
        details: "Agent application approved"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-agents'] });
      toast.success("Agent approved successfully");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (profileId) => {
      await base44.entities.Profile.update(profileId, { status: "rejected" });
      await base44.entities.AuditLog.create({
        actor_id: profile.id,
        actor_name: profile.name,
        entity_type: "Profile",
        entity_id: profileId,
        action: "reject",
        details: "Agent application rejected"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-agents'] });
      toast.success("Agent rejected");
    }
  });

  const moderateReviewMutation = useMutation({
    mutationFn: async ({ reviewId, action }) => {
      await base44.entities.Review.update(reviewId, {
        flagged: false,
        moderation_status: action
      });
      await base44.entities.AuditLog.create({
        actor_id: profile.id,
        actor_name: profile.name,
        entity_type: "Review",
        entity_id: reviewId,
        action: `moderate_${action}`,
        details: `Review ${action}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flagged-reviews'] });
      toast.success("Review moderated");
    }
  });

  const handleRunHealthCheck = async () => {
    setRunningHealthCheck(true);
    try {
      const response = await base44.functions.invoke('profileHealthCheck');
      setHealthCheckResults(response.data);
      setShowHealthCheck(true);
      toast.success('Health check complete!');
    } catch (error) {
      console.error('Health check error:', error);
      toast.error('Failed to run health check');
    } finally {
      setRunningHealthCheck(false);
    }
  };

  const handleRunDedup = async () => {
    if (!confirm('This will deduplicate all profiles. Continue?')) return;
    
    setRunningDedup(true);
    try {
      const response = await base44.functions.invoke('profileDedup');
      const results = response.data;
      
      toast.success(`Dedup complete! Removed ${results.summary.duplicates_removed} duplicates, fixed ${results.summary.orphans_fixed} orphans`);
      
      // Show results
      setHealthCheckResults(results);
      setShowHealthCheck(true);
    } catch (error) {
      console.error('Dedup error:', error);
      toast.error('Failed to run deduplication');
    } finally {
      setRunningDedup(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
              </div>
              <p className="text-slate-600">Manage approvals, reviews, and platform operations</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRunHealthCheck}
                disabled={runningHealthCheck}
                className="gap-2"
              >
                {runningHealthCheck ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Profile Health Check
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleRunDedup}
                disabled={runningDedup}
                className="gap-2"
              >
                {runningDedup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  'Fix Duplicates'
                )}
              </Button>
            </div>
          </div>

          {/* Health Check Results */}
          {showHealthCheck && healthCheckResults && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Health Check Results</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHealthCheck(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {healthCheckResults.summary?.total_users || 0}
                  </div>
                  <div className="text-sm text-slate-600">Total Users</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {healthCheckResults.summary?.total_profiles || 0}
                  </div>
                  <div className="text-sm text-slate-600">Total Profiles</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600">
                    {healthCheckResults.summary?.duplicates_found || 0}
                  </div>
                  <div className="text-sm text-slate-600">Duplicates</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {healthCheckResults.issues?.length || 0}
                  </div>
                  <div className="text-sm text-slate-600">Issues Found</div>
                </div>
              </div>

              {/* Issues */}
              {healthCheckResults.issues && healthCheckResults.issues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-900 mb-2">Issues:</h4>
                  {healthCheckResults.issues.map((issue, idx) => (
                    <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="font-semibold text-red-900">{issue.type}</span>
                        <Badge variant="outline" className="ml-auto">
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-red-800">{issue.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* All checks passed */}
              {(!healthCheckResults.issues || healthCheckResults.issues.length === 0) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-emerald-900">All Checks Passed!</div>
                    <div className="text-sm text-emerald-700">Profile integrity is healthy</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Tabs defaultValue="approvals" className="space-y-6">
          <TabsList>
            <TabsTrigger value="approvals" className="gap-2">
              <UserCheck className="w-4 h-4" />
              Agent Approvals
              {pendingAgents.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingAgents.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-2">
              <Flag className="w-4 h-4" />
              Review Moderation
              {flaggedReviews.length > 0 && (
                <Badge variant="destructive" className="ml-2">{flaggedReviews.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approvals">
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-900">Pending Agent Applications</h2>
              </div>
              {pendingAgents.length === 0 ? (
                <div className="p-12 text-center">
                  <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No pending applications</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {pendingAgents.map((agent) => (
                    <div key={agent.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{agent.name}</h3>
                          <p className="text-sm text-slate-600">{agent.location}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            License: {agent.license_id || "Not provided"}
                          </p>
                        </div>
                        <Badge variant="secondary">Pending Review</Badge>
                      </div>
                      {agent.bio && (
                        <p className="text-slate-700 mb-4">{agent.bio}</p>
                      )}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => approveMutation.mutate(agent.id)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => rejectMutation.mutate(agent.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reviews">
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-900">Flagged Reviews</h2>
              </div>
              {flaggedReviews.length === 0 ? (
                <div className="p-12 text-center">
                  <Flag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No flagged reviews</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {flaggedReviews.map((review) => (
                    <div key={review.id} className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`}
                            />
                          ))}
                        </div>
                        <Badge variant="destructive">Flagged</Badge>
                      </div>
                      <p className="text-slate-700 mb-2">{review.body}</p>
                      <p className="text-sm text-slate-500 mb-4">
                        Reason: {review.flag_reason || "Not specified"}
                      </p>
                      <div className="flex gap-3">
                        <Button
                          size="sm"
                          onClick={() => moderateReviewMutation.mutate({ reviewId: review.id, action: "approved" })}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moderateReviewMutation.mutate({ reviewId: review.id, action: "rejected" })}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <TrendingUp className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="text-2xl font-bold text-slate-900 mb-1">
                  {pendingAgents.length + flaggedReviews.length}
                </h3>
                <p className="text-slate-600">Pending Actions</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <UserCheck className="w-8 h-8 text-emerald-600 mb-3" />
                <h3 className="text-2xl font-bold text-slate-900 mb-1">-</h3>
                <p className="text-slate-600">Total Agents</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <Star className="w-8 h-8 text-yellow-600 mb-3" />
                <h3 className="text-2xl font-bold text-slate-900 mb-1">-</h3>
                <p className="text-slate-600">Total Reviews</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
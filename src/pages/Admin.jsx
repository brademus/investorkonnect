import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";
import {
  adminNdaSet,
  adminSetup,
  profileDedup,
  profileHealthCheck,
  refreshAllEmbeddings,
  resetProfiles,
} from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, AlertTriangle, CheckCircle, Trash2, Users, Database, Settings, RefreshCw, ListOrdered, FileText } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";

function AdminContent() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [ndaUpdating, setNdaUpdating] = useState({});

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      console.log('[Admin] Current user:', {
        id: user?.id,
        email: user?.email,
        role: user?.role
      });

      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });

      if (response.ok) {
        const state = await response.json();
        
        console.log('[Admin] Profile state:', {
          email: state.email,
          profileRole: state.profile?.role,
          userRole: user?.role
        });
        
        const adminRole = state.profile?.role === 'admin' || user?.role === 'admin';
        
        setIsAdmin(adminRole);
        
        if (adminRole) {
          await loadData();
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('[Admin] Check error:', error);
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const allProfiles = await base44.entities.Profile.filter({});
      setProfiles(allProfiles);

      const allUsers = await base44.entities.User.filter({});
      setUsers(allUsers);

      console.log('[Admin] Data loaded:', {
        profiles: allProfiles.length,
        users: allUsers.length
      });
    } catch (error) {
      console.error('[Admin] Load data error:', error);
      toast.error("Failed to load data");
    }
  };

  const runHealthCheck = async () => {
    setProcessing(true);
    try {
      const response = await profileHealthCheck();
      setHealthData(response.data);
      toast.success("Health check completed!");
    } catch (error) {
      console.error('[Admin] Health check error:', error);
      toast.error("Health check failed: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const runDeduplication = async () => {
    if (!confirm("This will find and remove duplicate profiles. Are you sure?")) {
      return;
    }

    setProcessing(true);
    try {
      const response = await profileDedup();
      const data = response.data;
      
      console.log('[Admin] Dedup result:', data);
      
      toast.success(`Deduplication complete! Removed ${data.summary.duplicates_removed} duplicates, fixed ${data.summary.orphans_fixed} orphans`);
      
      await loadData();
      
      alert(JSON.stringify(data.summary, null, 2));
    } catch (error) {
      console.error('[Admin] Dedup error:', error);
      toast.error("Deduplication failed: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const runAdminSetup = async () => {
    if (!adminEmail) {
      toast.error("Please enter an admin email address");
      return;
    }

    if (!confirm(`This will DELETE ALL profiles and recreate them from the Users table. Set ${adminEmail} as admin. Continue?`)) {
      return;
    }

    setProcessing(true);
    try {
      const response = await adminSetup({ adminEmail });
      const data = response.data;
      
      console.log('[Admin] Setup result:', data);
      
      if (data.success) {
        toast.success(`Setup complete! Deleted ${data.results.step1_deleted}, created ${data.results.step2_created} profiles`);
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error("Setup failed: " + data.error);
      }
    } catch (error) {
      console.error('[Admin] Setup error:', error);
      toast.error("Setup failed: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const resetAllNonAdminProfiles = async () => {
    const confirmText = `⚠️ DANGER: This will DELETE all investor and agent profiles for non-admin users.

This is irreversible and should only be used for test environments.

Type "RESET" to confirm:`;

    const userInput = prompt(confirmText);
    
    if (userInput !== "RESET") {
      toast.info("Reset cancelled");
      return;
    }

    setResetting(true);
    
    try {
      console.log('[Admin] Calling resetProfiles...');
      const response = await resetProfiles();
      const data = response.data;
      
      console.log('[Admin] Reset result:', data);
      
      if (data.ok) {
        let message = `Reset complete!\n\n`;
        message += `✅ Deleted ${data.deletedProfiles} profiles for ${data.deletedUsers} users\n\n`;
        message += `Related data deleted:\n`;
        message += `- Matches: ${data.deletedRelated?.matches || 0}\n`;
        message += `- Intro requests: ${data.deletedRelated?.introRequests || 0}\n`;
        message += `- Rooms: ${data.deletedRelated?.rooms || 0}\n`;
        message += `- Messages: ${data.deletedRelated?.roomMessages || 0}\n`;
        message += `- Deals: ${data.deletedRelated?.deals || 0}\n`;
        message += `- Reviews: ${data.deletedRelated?.reviews || 0}\n`;
        
        if (data.errors && data.errors.length > 0) {
          message += `\n⚠️ ${data.errors.length} errors occurred (check console)`;
          console.warn('[Admin] Reset errors:', data.errors);
        }
        
        alert(message);
        toast.success(`Deleted ${data.deletedProfiles} non-admin profiles`);
        
        setTimeout(async () => {
          await loadData();
        }, 1000);
      } else {
        toast.error("Reset failed: " + (data.message || 'Unknown error'));
        console.error('[Admin] Reset failed:', data);
      }
    } catch (error) {
      console.error('[Admin] Reset error:', error);
      toast.error("Reset failed: " + error.message);
    } finally {
      setResetting(false);
    }
  };

  const handleNdaToggle = async (userId, currentStatus) => {
    setNdaUpdating(prev => ({ ...prev, [userId]: true }));
    
    try {
      const response = await adminNdaSet({
        user_id: userId,
        accepted: !currentStatus
      });
      
      if (response.data.ok) {
        toast.success(`NDA status updated`);
        await loadData();
      } else {
        toast.error(`Failed to update: ${response.data.error}`);
      }
    } catch (error) {
      console.error('[Admin] NDA toggle error:', error);
      toast.error("Failed to update NDA status");
    } finally {
      setNdaUpdating(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-600" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This page is only accessible to administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p className="text-slate-600">Your current status:</p>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p><strong>Email:</strong> {currentUser?.email || 'Not signed in'}</p>
                <p><strong>User Role:</strong> {currentUser?.role || 'None'}</p>
              </div>
              <p className="text-slate-600 mt-4">
                If you should have admin access, contact support or run the admin setup tool.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userIdCounts = {};
  profiles.forEach(p => {
    if (p.user_id) {
      userIdCounts[p.user_id] = (userIdCounts[p.user_id] || 0) + 1;
    }
  });
  
  const duplicateUserIds = Object.entries(userIdCounts)
    .filter(([_, count]) => count > 1)
    .map(([user_id, count]) => ({ user_id, count }));

  const orphanedProfiles = profiles.filter(p => !p.user_id || !users.find(u => u.id === p.user_id));
  const nonAdminProfiles = profiles.filter(p => p.role !== 'admin');

  // AI Embedding functions
  const refreshAgentVectors = async () => {
    setProcessing(true);
    try {
      const response = await refreshAllEmbeddings({ 
        role: 'agent' 
      });
      const data = response.data;
      toast.success(`Agent vectors updated: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped`);
      alert(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[Admin] Refresh agent vectors error:', error);
      toast.error("Failed to refresh agent vectors: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const refreshInvestorVectors = async () => {
    setProcessing(true);
    try {
      const response = await refreshAllEmbeddings({ 
        role: 'investor' 
      });
      const data = response.data;
      toast.success(`Investor vectors updated: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped`);
      alert(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[Admin] Refresh investor vectors error:', error);
      toast.error("Failed to refresh investor vectors: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Admin Panel
          </h1>
          <p className="text-slate-600">System management and diagnostics</p>
        </div>

        {/* DANGER ZONE */}
        <Card className="mb-8 border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <Trash2 className="w-5 h-5" />
              ⚠️ DANGER ZONE: Reset All Non-Admin Profiles
            </CardTitle>
            <CardDescription className="text-red-700">
              Use this to start fresh with test data. This will DELETE all investor and agent profiles for non-admin users, 
              plus all related data (matches, rooms, deals, etc.). Admin accounts will NOT be affected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-100 border border-red-300 rounded-lg p-4">
              <p className="text-sm text-red-900 font-semibold mb-2">
                ⚠️ This action will DELETE:
              </p>
              <ul className="text-sm text-red-800 space-y-1 list-disc pl-5">
                <li><strong>Profiles:</strong> All investor/agent profile records</li>
                <li><strong>Matches:</strong> All AI-generated investor-agent matches</li>
                <li><strong>Intro Requests:</strong> All introduction requests</li>
                <li><strong>Rooms & Messages:</strong> All deal rooms and chat history</li>
                <li><strong>Deals:</strong> All deal records</li>
                <li><strong>Reviews:</strong> All review records (if any)</li>
                <li className="mt-2 font-semibold">❌ Cannot be undone</li>
                <li className="text-emerald-700 font-semibold">✅ Admin accounts are safe</li>
              </ul>
              <p className="text-sm text-red-900 font-bold mt-3">
                📊 {nonAdminProfiles.length} non-admin profiles will be deleted
              </p>
            </div>
            
            <Button 
              onClick={resetAllNonAdminProfiles}
              disabled={resetting}
              className="bg-red-600 hover:bg-red-700"
            >
              {resetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset All Non-Admin Profiles
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Admin Setup */}
        <Card className="mb-8 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <Settings className="w-5 h-5" />
              Quick Admin Setup
            </CardTitle>
            <CardDescription className="text-orange-700">
              Having trouble accessing admin? Use this to reset all profiles and set admin role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="adminEmail">Admin Email Address</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={processing}
              />
              <p className="text-xs text-orange-600 mt-1">
                This will DELETE all existing profiles and recreate them with the correct roles.
              </p>
            </div>
            <Button 
              onClick={runAdminSetup}
              disabled={processing || !adminEmail}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  Run Admin Setup
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{profiles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Duplicates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{duplicateUserIds.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Orphaned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{orphanedProfiles.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Issues Alert */}
        {(duplicateUserIds.length > 0 || orphanedProfiles.length > 0) && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-900">
                <AlertTriangle className="w-5 h-5" />
                Data Integrity Issues Detected
              </CardTitle>
              <CardDescription className="text-red-700">
                {duplicateUserIds.length > 0 && `${duplicateUserIds.length} users have multiple profiles. `}
                {orphanedProfiles.length > 0 && `${orphanedProfiles.length} profiles are orphaned. `}
                Run deduplication or admin setup to fix.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={runDeduplication}
                disabled={processing}
                className="bg-red-600 hover:bg-red-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Run Deduplication
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Admin Actions - NOW WITH 5 CARDS INCLUDING AI MATCHING */}
        <div className="grid md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Profile Management
              </CardTitle>
              <CardDescription>
                Tools to manage and clean up profile data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={runDeduplication}
                disabled={processing}
                variant="outline"
                className="w-full justify-start"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Duplicate Profiles
              </Button>
              <Button 
                onClick={() => loadData()}
                disabled={processing}
                variant="outline"
                className="w-full justify-start"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                System Diagnostics
              </CardTitle>
              <CardDescription>
                Run health checks and view system status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={runHealthCheck}
                disabled={processing}
                variant="outline"
                className="w-full justify-start"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Run Health Check
              </Button>
              {healthData && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm font-medium mb-2">Health Status:</div>
                  <Badge className={healthData.summary.health_status === 'healthy' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}>
                    {healthData.summary.health_status}
                  </Badge>
                  <div className="text-xs text-slate-600 mt-2">
                    {healthData.summary.checks_passed}/{healthData.summary.checks_total} checks passed
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Payments & Safety
              </CardTitle>
              <CardDescription>
                View risky milestones and manage disputes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => window.location.assign(createPageUrl("AdminPayments"))}
                variant="outline"
                className="w-full justify-start"
              >
                <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                Payments & Safety Panel
              </Button>
              <Button
                onClick={() => window.location.assign(createPageUrl("AdminAudit"))}
                variant="outline"
                className="w-full justify-start"
              >
                <ListOrdered className="w-4 h-4 mr-2 text-blue-500" />
                Audit Log
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-700" />
                Milestone 1 Summary
              </CardTitle>
              <CardDescription>
                Client-facing one-pager
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => window.location.assign(createPageUrl("MilestoneOneSummary"))}
                variant="outline"
                className="w-full justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                View Summary
              </Button>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-900">
                <Database className="w-5 h-5 text-purple-600" />
                AI Matching
              </CardTitle>
              <CardDescription className="text-purple-700">
                Rebuild embedding vectors for matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={refreshAgentVectors}
                disabled={processing}
                variant="outline"
                className="w-full justify-start border-purple-300 text-purple-700 hover:bg-purple-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Rebuild Agent Vectors
              </Button>
              <Button
                onClick={refreshInvestorVectors}
                disabled={processing}
                variant="outline"
                className="w-full justify-start border-purple-300 text-purple-700 hover:bg-purple-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Rebuild Investor Vectors
              </Button>
              <div className="text-xs text-purple-700 mt-2">
                Run after major profile updates
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users & NDA Management */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Users & NDA Management
            </CardTitle>
            <CardDescription>
              Manage user profiles and NDA status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-left">
                    <th className="pb-3 font-medium text-slate-600">Email</th>
                    <th className="pb-3 font-medium text-slate-600">Role</th>
                    <th className="pb-3 font-medium text-slate-600">Type</th>
                    <th className="pb-3 font-medium text-slate-600">Onboarded</th>
                    <th className="pb-3 font-medium text-slate-600">Subscription</th>
                    <th className="pb-3 font-medium text-slate-600">NDA Signed</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.slice(0, 20).map((profile) => (
                    <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3">
                        <div className="font-medium text-slate-900">{profile.email}</div>
                        <div className="text-xs text-slate-500">{profile.full_name || 'No name'}</div>
                      </td>
                      <td className="py-3">
                        <Badge className={profile.role === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-800'}>
                          {profile.role || 'member'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary" className="capitalize">
                          {profile.user_type || profile.user_role || 'N/A'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {profile.onboarding_completed_at ? (
                          <Badge className="bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">
                            No
                          </Badge>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary" className="capitalize">
                          {profile.subscription_tier || 'none'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleNdaToggle(profile.user_id, profile.nda_accepted)}
                          disabled={ndaUpdating[profile.user_id]}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            profile.nda_accepted ? 'bg-emerald-600' : 'bg-slate-200'
                          } ${ndaUpdating[profile.user_id] ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              profile.nda_accepted ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        {profile.nda_accepted && profile.nda_accepted_at && (
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(profile.nda_accepted_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {profiles.length > 20 && (
                <p className="text-sm text-slate-500 mt-4 text-center">
                  Showing first 20 of {profiles.length} profiles
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Duplicate Profiles List */}
        {duplicateUserIds.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Duplicate Profiles ({duplicateUserIds.length})</CardTitle>
              <CardDescription>
                Users with multiple profile records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {duplicateUserIds.map(({ user_id, count }) => {
                  const user = users.find(u => u.id === user_id);
                  const userProfiles = profiles.filter(p => p.user_id === user_id);
                  
                  return (
                    <div key={user_id} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">
                            {user?.email || user_id}
                          </div>
                          <div className="text-sm text-slate-600">
                            {count} profiles found
                          </div>
                        </div>
                        <Badge className="bg-red-100 text-red-800">
                          Duplicate
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        Profile IDs: {userProfiles.map(p => p.id.substring(0, 8)).join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Health Check Results */}
        {healthData && (
          <Card>
            <CardHeader>
              <CardTitle>Latest Health Check Results</CardTitle>
              <CardDescription>
                {new Date(healthData.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-slate-50 p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(healthData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <AuthGuard requireAuth={true}>
      <AdminContent />
    </AuthGuard>
  );
}
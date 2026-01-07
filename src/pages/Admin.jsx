import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";
import {
  adminNdaSet,
  adminSetup,
  grantAdmin,
  profileDedup,
  profileHealthCheck,
  refreshAllEmbeddings,
  resetProfiles,
} from "@/components/functions";
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
  const [wipingData, setWipingData] = useState(false);
  const [docusignConnection, setDocusignConnection] = useState(null);
  const [checkingDocusign, setCheckingDocusign] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInvestors: 0,
    totalAgents: 0,
    totalDeals: 0,
    activeDeals: 0,
    completedDeals: 0,
    verifiedUsers: 0,
    pendingVerification: 0,
    ndaSigned: 0,
    recentActivity: []
  });

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
      // Check DocuSign connection
      setCheckingDocusign(true);
      try {
        const connections = await base44.entities.DocuSignConnection.filter({});
        if (connections.length > 0) {
          setDocusignConnection(connections[0]);
        }
      } catch (e) {
        console.log('[Admin] No DocuSign connections found');
      }
      setCheckingDocusign(false);

      const allProfiles = await base44.entities.Profile.filter({});
      setProfiles(allProfiles);

      const allUsers = await base44.entities.User.filter({});
      setUsers(allUsers);

      // Calculate stats
      const totalUsers = allUsers.length;
      const totalInvestors = allProfiles.filter(p => p.user_role === 'investor').length;
      const totalAgents = allProfiles.filter(p => p.user_role === 'agent').length;
      const verifiedUsers = allProfiles.filter(p => p.kyc_status === 'approved').length;
      const pendingVerification = allProfiles.filter(p => !p.kyc_status || p.kyc_status === 'pending' || p.kyc_status === 'unverified').length;
      const ndaSigned = allProfiles.filter(p => p.nda_accepted).length;

      // Get deals if available
      let totalDeals = 0;
      let activeDeals = 0;
      let completedDeals = 0;
      try {
        const allDeals = await base44.entities.Deal.filter({});
        totalDeals = allDeals.length;
        activeDeals = allDeals.filter(d => d.status === 'active').length;
        completedDeals = allDeals.filter(d => d.status === 'completed' || d.status === 'closed').length;
      } catch (e) {
        // Deal entity might not exist
      }

      setStats({
        totalUsers,
        totalInvestors,
        totalAgents,
        totalDeals,
        activeDeals,
        completedDeals,
        verifiedUsers,
        pendingVerification,
        ndaSigned,
        recentActivity: allUsers.slice(0, 10).reverse() // Last 10 users
      });

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
    const confirmText = `⚠️ DANGER: This will COMPLETELY DELETE all non-admin users and their profiles.

They will be removed from the app entirely and can start fresh.

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
      
      if (data.success || data.ok) {
        // Show detailed success toast
        const profileCount = data.deletedProfiles ?? 0;
        const remainingProfiles = data.details?.remainingProfiles ?? '?';
        
        toast.success(`✅ Wiped ${profileCount} profiles and all related data. ${remainingProfiles} admin profiles remain.`, {
          duration: 5000,
        });
        
        // Show detailed breakdown in console
        console.log('[Admin] Reset complete:', data.details);
        
        // Immediately reload data to show updated counts
        await loadData();
      } else {
        toast.error("Reset failed: " + (data.message || data.error || 'Unknown error'));
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
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border border-[#E5E7EB] shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#DC2626]" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This page is only accessible to administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p className="text-[#6B7280]">Your current status:</p>
              <div className="bg-[#F9FAFB] p-3 rounded-lg">
                <p><strong>Email:</strong> {currentUser?.email || 'Not signed in'}</p>
                <p><strong>User Role:</strong> {currentUser?.role || 'None'}</p>
              </div>
              <p className="text-[#6B7280] mt-4">
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
  
  // Calculate non-admin profiles using BOTH User.role AND Profile.role checks
  // A user is admin if EITHER User.role === 'admin' OR Profile.role === 'admin'
  const adminUserIdSet = new Set();
  users.forEach(u => {
    if (u.role === 'admin') adminUserIdSet.add(u.id);
  });
  profiles.forEach(p => {
    if (p.role === 'admin' && p.user_id) adminUserIdSet.add(p.user_id);
  });
  
  const nonAdminProfiles = profiles.filter(p => !adminUserIdSet.has(p.user_id));
  const nonAdminUsers = users.filter(u => !adminUserIdSet.has(u.id));

  // AI Embedding functions
  const refreshAgentVectors = async () => {
    setProcessing(true);
    try {
      const response = await refreshAllEmbeddings({ 
        role: 'agent' 
      });
      const data = response.data;
      toast.success(`Agent vectors updated: ${data.created || 0} created, ${data.updated || 0} updated, ${data.skipped || 0} skipped`);
      console.log('[Admin] Agent vectors result:', data);
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
      toast.success(`Investor vectors updated: ${data.created || 0} created, ${data.updated || 0} updated, ${data.skipped || 0} skipped`);
      console.log('[Admin] Investor vectors result:', data);
    } catch (error) {
      console.error('[Admin] Refresh investor vectors error:', error);
      toast.error("Failed to refresh investor vectors: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#111827] mb-2 flex items-center gap-2">
            <Shield className="w-8 h-8 text-[#D3A029]" />
            Admin Panel
          </h1>
          <p className="text-[#6B7280]">System management and diagnostics</p>
        </div>

        {/* STATS DASHBOARD */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[#111827] mb-4">Platform Statistics</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Total Users */}
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <Users className="h-6 w-6 text-[#D3A029]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Total Users</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats.totalUsers}</p>
                </div>
              </div>
            </div>

            {/* Total Investors */}
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <Shield className="h-6 w-6 text-[#D3A029]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Investors</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats.totalInvestors}</p>
                </div>
              </div>
            </div>

            {/* Total Agents */}
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <Users className="h-6 w-6 text-[#D3A029]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Agents</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats.totalAgents}</p>
                </div>
              </div>
            </div>

            {/* Total Deals */}
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <FileText className="h-6 w-6 text-[#D3A029]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Total Deals</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats.totalDeals}</p>
                </div>
              </div>
            </div>

            {/* Active Deals */}
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <CheckCircle className="h-6 w-6 text-[#D3A029]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Active Deals</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats.activeDeals}</p>
                </div>
              </div>
            </div>

            {/* Verified Users */}
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <Shield className="h-6 w-6 text-[#D3A029]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Verified Users</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats.verifiedUsers}</p>
                </div>
              </div>
            </div>

            {/* Pending Verification */}
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <AlertTriangle className="h-6 w-6 text-[#D3A029]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Pending Verification</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats.pendingVerification}</p>
                </div>
              </div>
            </div>

            {/* NDA Signed */}
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <FileText className="h-6 w-6 text-[#D3A029]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">NDA Signed</p>
                  <p className="text-2xl font-bold text-[#111827]">{stats.ndaSigned}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DOCUSIGN CONNECTION */}
        <div className="mb-8">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#111827] mb-4">DocuSign Integration</h3>
            <p className="text-sm text-[#6B7280] mb-4">
              Connect your DocuSign account to enable electronic signature functionality for legal agreements.
            </p>

            {checkingDocusign ? (
              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking connection...
              </div>
            ) : docusignConnection ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-900">Connected</span>
                  </div>
                  <div className="text-sm text-emerald-800 space-y-1">
                    <p><strong>Account ID:</strong> {docusignConnection.account_id}</p>
                    <p><strong>Environment:</strong> {docusignConnection.env}</p>
                    <p><strong>User:</strong> {docusignConnection.user_email}</p>
                    <p><strong>Base URI:</strong> {docusignConnection.base_uri}</p>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    if (confirm('Disconnect DocuSign? You will need to reconnect to use signatures.')) {
                      try {
                        await base44.entities.DocuSignConnection.delete(docusignConnection.id);
                        setDocusignConnection(null);
                        toast.success('DocuSign disconnected');
                      } catch (error) {
                        toast.error('Failed to disconnect: ' + error.message);
                      }
                    }
                  }}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Disconnect DocuSign
                </Button>
              </div>
            ) : (
              <Button
              onClick={async () => {
                try {
                  toast.info('Connecting to DocuSign...');
                  const response = await base44.functions.invoke('docusignConnect');

                  console.log('[Admin] DocuSign connect response:', response);

                  if (response.data?.error) {
                    toast.error('DocuSign connection failed: ' + response.data.error);
                    return;
                  }

                  if (response.data?.authUrl) {
                    console.log('[Admin] Redirecting to:', response.data.authUrl);
                    window.location.href = response.data.authUrl;
                  } else {
                    toast.error('No authorization URL received from DocuSign');
                    console.error('[Admin] Response data:', response.data);
                  }
                } catch (error) {
                  console.error('[Admin] DocuSign connect error:', error);
                  toast.error('Failed to connect DocuSign: ' + error.message);
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:-translate-y-0.5"
            >
              <FileText className="w-4 h-4" />
              Connect DocuSign
              </Button>
              )}
              </div>
              </div>

        {/* GRANT ADMIN ACCESS */}
        <div className="mb-8">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#111827] mb-4">Grant Admin Access</h3>
            <p className="text-sm text-[#6B7280] mb-4">
              Make users admins to give them instant access without onboarding, verification, or NDA.
              <strong className="text-emerald-600 ml-1">This does NOT delete any data.</strong>
            </p>
            <div className="flex gap-3">
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="user@example.com"
                className="flex-1 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-base focus:border-[#D3A029] focus:ring-2 focus:ring-[#D3A029]/20 focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!adminEmail) {
                    toast.error('Please enter an email');
                    return;
                  }
                  setProcessing(true);
                  try {
                    // Use grantAdmin function which ONLY updates role, no data deletion
                    const response = await grantAdmin({ email: adminEmail });
                    const data = response.data;
                    
                    if (data.ok) {
                      toast.success(`${adminEmail} is now an admin! Page will reload...`);
                      setAdminEmail('');
                      setTimeout(() => window.location.reload(), 1500);
                    } else {
                      toast.error('Failed to grant admin: ' + (data.error || data.message || 'Unknown error'));
                    }
                  } catch (err) {
                    console.error('[Admin] Make admin error:', err);
                    toast.error('Failed to grant admin access: ' + err.message);
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Make Admin
              </button>
            </div>
          </div>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="mb-8">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden">
            <div className="border-b border-[#F3F4F6] px-6 py-5 sm:px-8">
              <h2 className="text-lg font-semibold text-[#111827]">Recent Activity</h2>
              <p className="text-sm text-[#6B7280] mt-1">Last 10 user signups</p>
            </div>
            <div className="px-6 py-6 sm:px-8">
              <div className="space-y-4">
                {stats.recentActivity.map((user, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-[#F3F4F6] pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="text-base font-medium text-[#111827]">{user.email}</p>
                      <p className="text-sm text-[#6B7280]">
                        {user.role || 'No role'} • {new Date(user.created_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={
                      "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium " +
                      (user.role === 'admin' 
                        ? "bg-[#FFFBEB] text-[#D3A029] border border-[#D3A029]"
                        : "bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]")
                    }>
                      {user.role || 'user'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                📊 {nonAdminUsers.length} non-admin users and {nonAdminProfiles.length} non-admin profiles will be deleted
              </p>
            </div>
            
            <div className="flex gap-3">
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

              <Button 
                onClick={async () => {
                  const confirmText = `🔥 NUCLEAR OPTION: This will COMPLETELY DELETE:
- All Rooms
- All Messages  
- All Deals
- All Matches
- All IntroRequests
- All NDAs
- All ProfileVectors
- All non-admin PROFILES (completely removed from system)

Type "WIPE" to confirm:`;

                  const userInput = prompt(confirmText);
                  if (userInput !== "WIPE") {
                    toast.info("Wipe cancelled");
                    return;
                  }

                  setWipingData(true);
                  try {
                    let deletedCounts = { rooms: 0, messages: 0, deals: 0, matches: 0, intros: 0, ndas: 0, vectors: 0, profiles: 0 };
                    
                    // Delete all rooms
                    const rooms = await base44.entities.Room.filter({});
                    for (const room of rooms) {
                      await base44.entities.Room.delete(room.id);
                    }
                    deletedCounts.rooms = rooms.length;
                    
                    // Delete all messages
                    const messages = await base44.entities.Message.filter({});
                    for (const msg of messages) {
                      await base44.entities.Message.delete(msg.id);
                    }
                    deletedCounts.messages = messages.length;
                    
                    // Delete all deals
                    const deals = await base44.entities.Deal.filter({});
                    for (const deal of deals) {
                      await base44.entities.Deal.delete(deal.id);
                    }
                    deletedCounts.deals = deals.length;

                    // Delete all matches
                    try {
                      const matches = await base44.entities.Match.filter({});
                      for (const match of matches) {
                        await base44.entities.Match.delete(match.id);
                      }
                      deletedCounts.matches = matches.length;
                    } catch (e) { console.log('No matches to delete'); }

                    // Delete all intro requests
                    try {
                      const intros = await base44.entities.IntroRequest.filter({});
                      for (const intro of intros) {
                        await base44.entities.IntroRequest.delete(intro.id);
                      }
                      deletedCounts.intros = intros.length;
                    } catch (e) { console.log('No intros to delete'); }

                    // Delete all NDAs
                    try {
                      const ndas = await base44.entities.NDA.filter({});
                      for (const nda of ndas) {
                        await base44.entities.NDA.delete(nda.id);
                      }
                      deletedCounts.ndas = ndas.length;
                    } catch (e) { console.log('No NDAs to delete'); }

                    // Delete all profile vectors
                    try {
                      const vectors = await base44.entities.ProfileVector.filter({});
                      for (const vec of vectors) {
                        await base44.entities.ProfileVector.delete(vec.id);
                      }
                      deletedCounts.vectors = vectors.length;
                    } catch (e) { console.log('No vectors to delete'); }

                    // COMPLETELY DELETE non-admin profiles
                    for (const profile of nonAdminProfiles) {
                      await base44.entities.Profile.delete(profile.id);
                    }
                    deletedCounts.profiles = nonAdminProfiles.length;

                    toast.success(`🔥 Wiped: ${deletedCounts.profiles} profiles, ${deletedCounts.rooms} rooms, ${deletedCounts.messages} messages, ${deletedCounts.deals} deals, ${deletedCounts.matches} matches`);
                    await loadData();
                  } catch (error) {
                    console.error('[Admin] Wipe error:', error);
                    toast.error("Wipe failed: " + error.message);
                  } finally {
                    setWipingData(false);
                  }
                }}
                disabled={wipingData}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-100"
              >
                {wipingData ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wiping...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Wipe All Data & Delete Profiles
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Admin Setup - Full Reset */}
        <Card className="mb-8 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <Settings className="w-5 h-5" />
              ⚠️ Reset Database & Grant Admin
            </CardTitle>
            <CardDescription className="text-orange-700">
              <strong>WARNING:</strong> This will DELETE ALL profiles and recreate them from scratch. Only use if you need a complete reset.
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
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, Users, FileText, PenTool, Settings, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import AdminStatsBar from "@/components/admin/AdminStatsBar";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminDealsTab from "@/components/admin/AdminDealsTab";
import AdminAgreementsTab from "@/components/admin/AdminAgreementsTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";

function AdminContent() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [docusignConnection, setDocusignConnection] = useState(null);

  useEffect(() => { checkAdminAccess(); }, []);

  // Handle DocuSign callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("docusign") === "connected") {
      toast.success("DocuSign connected successfully!");
      window.history.replaceState({}, "", window.location.pathname);
      loadData();
    } else if (urlParams.get("docusign") === "error") {
      toast.error("DocuSign connection failed: " + (urlParams.get("message") || "Unknown error"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkAdminAccess = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      let adminRole = user?.role === "admin";
      if (!adminRole && user?.email) {
        const profs = await base44.entities.Profile.filter({ email: user.email.toLowerCase().trim() }).catch(() => []);
        if (profs?.[0]?.role === "admin") adminRole = true;
      }

      setIsAdmin(adminRole);
      if (adminRole) await loadData();
      setLoading(false);
    } catch (error) {
      console.error("[Admin] Check error:", error);
      setLoading(false);
    }
  };

  const loadData = async () => {
    const [allProfiles, allUsers, allDeals, allRooms, allAgreements] = await Promise.all([
      base44.entities.Profile.filter({}).catch(() => []),
      base44.entities.User.filter({}).catch(() => []),
      base44.entities.Deal.filter({}).catch(() => []),
      base44.entities.Room.filter({}).catch(() => []),
      base44.entities.LegalAgreement.filter({}).catch(() => []),
    ]);

    setProfiles(allProfiles);
    setUsers(allUsers);
    setDeals(allDeals);
    setRooms(allRooms);
    setAgreements(allAgreements);

    // DocuSign
    const connections = await base44.entities.DocuSignConnection.filter({}).catch(() => []);
    setDocusignConnection(connections?.[0] || null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D3A029] animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 mb-4">Admin privileges required.</p>
          <p className="text-xs text-slate-400">{currentUser?.email || "Not signed in"} — Role: {currentUser?.role || "none"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = createPageUrl("Pipeline")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Pipeline
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-[#D3A029]" />
                Admin Panel
              </h1>
              <p className="text-xs text-slate-500">{profiles.length} users • {deals.length} deals • {agreements.length} agreements</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <AdminStatsBar profiles={profiles} deals={deals} rooms={rooms} agreements={agreements} />

        {/* Tabs */}
        <Tabs defaultValue="users" className="mt-4">
          <TabsList className="bg-white border border-slate-200 mb-4">
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="w-4 h-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-1.5">
              <FileText className="w-4 h-4" /> Deals
            </TabsTrigger>
            <TabsTrigger value="agreements" className="gap-1.5">
              <PenTool className="w-4 h-4" /> Agreements
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="w-4 h-4" /> Settings & Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <AdminUsersTab profiles={profiles} users={users} onReload={loadData} />
          </TabsContent>

          <TabsContent value="deals">
            <AdminDealsTab deals={deals} profiles={profiles} rooms={rooms} onReload={loadData} />
          </TabsContent>

          <TabsContent value="agreements">
            <AdminAgreementsTab agreements={agreements} profiles={profiles} onReload={loadData} />
          </TabsContent>

          <TabsContent value="settings">
            <AdminSettingsTab docusignConnection={docusignConnection} onReload={loadData} />
          </TabsContent>
        </Tabs>
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
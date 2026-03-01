import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, CheckCircle, XCircle, Shield, RotateCcw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import UserActivityPanel from "./UserActivityPanel";

export default function AdminUsersTab({ profiles, users, onReload }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [expandedProfile, setExpandedProfile] = useState(null);
  const [updating, setUpdating] = useState({});

  const filtered = profiles.filter(p => {
    const matchSearch = !search || 
      (p.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.full_name || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || 
      p.user_role === roleFilter || p.user_type === roleFilter;
    const matchStatus = statusFilter === "all" ||
      (statusFilter === "onboarded" && p.onboarding_completed_at) ||
      (statusFilter === "not_onboarded" && !p.onboarding_completed_at) ||
      (statusFilter === "nda_signed" && p.nda_accepted) ||
      (statusFilter === "nda_unsigned" && !p.nda_accepted) ||
      (statusFilter === "admin" && p.role === "admin");
    return matchSearch && matchRole && matchStatus;
  });

  const updateProfile = async (profileId, field, value) => {
    setUpdating(prev => ({ ...prev, [`${profileId}_${field}`]: true }));
    try {
      await base44.entities.Profile.update(profileId, { [field]: value });
      toast.success(`Updated ${field}`);
      onReload();
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${profileId}_${field}`]: false }));
    }
  };

  const toggleNda = async (profile) => {
    const newVal = !profile.nda_accepted;
    setUpdating(prev => ({ ...prev, [`${profile.id}_nda`]: true }));
    try {
      await base44.functions.invoke("adminNdaSet", {
        user_id: profile.user_id,
        accepted: newVal
      });
      toast.success(newVal ? "NDA marked as signed" : "NDA revoked");
      onReload();
    } catch (err) {
      toast.error("NDA toggle failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${profile.id}_nda`]: false }));
    }
  };

  const resetOnboarding = async (profile) => {
    if (!confirm(`Reset onboarding for ${profile.email}? They will need to redo it.`)) return;
    setUpdating(prev => ({ ...prev, [`${profile.id}_onboarding`]: true }));
    try {
      await base44.entities.Profile.update(profile.id, {
        onboarding_completed_at: null,
        onboarding_step: null,
        onboarding_version: null
      });
      toast.success("Onboarding reset");
      onReload();
    } catch (err) {
      toast.error("Reset failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${profile.id}_onboarding`]: false }));
    }
  };

  const toggleAdmin = async (profile) => {
    const newRole = profile.role === "admin" ? "member" : "admin";
    if (newRole === "admin" && !confirm(`Grant admin access to ${profile.email}?`)) return;
    if (newRole === "member" && !confirm(`Remove admin access from ${profile.email}?`)) return;
    setUpdating(prev => ({ ...prev, [`${profile.id}_role`]: true }));
    try {
      await base44.functions.invoke("grantAdmin", { email: profile.email, role: newRole });
      toast.success(`${profile.email} is now ${newRole}`);
      onReload();
    } catch (err) {
      toast.error("Role change failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${profile.id}_role`]: false }));
    }
  };

  const changeUserRole = async (profile, newRole) => {
    setUpdating(prev => ({ ...prev, [`${profile.id}_user_role`]: true }));
    try {
      await base44.entities.Profile.update(profile.id, { user_role: newRole });
      toast.success(`Changed to ${newRole}`);
      onReload();
    } catch (err) {
      toast.error("Role change failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${profile.id}_user_role`]: false }));
    }
  };

  const deleteProfile = async (profile) => {
    if (!confirm(`⚠️ DELETE profile for ${profile.email}? This cannot be undone.`)) return;
    setUpdating(prev => ({ ...prev, [`${profile.id}_delete`]: true }));
    try {
      await base44.entities.Profile.delete(profile.id);
      toast.success("Profile deleted");
      onReload();
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${profile.id}_delete`]: false }));
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="investor">Investors</SelectItem>
            <SelectItem value="agent">Agents</SelectItem>
            <SelectItem value="member">Members</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="onboarded">Onboarded</SelectItem>
            <SelectItem value="not_onboarded">Not Onboarded</SelectItem>
            <SelectItem value="nda_signed">NDA Signed</SelectItem>
            <SelectItem value="nda_unsigned">NDA Not Signed</SelectItem>
            <SelectItem value="admin">Admins Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-slate-500 mb-3">Showing {filtered.length} of {profiles.length} users — click any row for activity, expand for admin actions</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium text-slate-600">User</th>
              <th className="px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 font-medium text-slate-600">Onboarded</th>
              <th className="px-4 py-3 font-medium text-slate-600">NDA</th>
              <th className="px-4 py-3 font-medium text-slate-600">KYC</th>
              <th className="px-4 py-3 font-medium text-slate-600">Subscription</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(profile => (
              <React.Fragment key={profile.id}>
                <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedProfile(profile)} className="text-left">
                      <div className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                        {profile.full_name || "No name"}
                      </div>
                      <div className="text-xs text-slate-500">{profile.email}</div>
                    </button>
                    {profile.role === "admin" && (
                      <Badge className="bg-orange-100 text-orange-800 ml-2 text-[10px]">Admin</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="capitalize text-xs">
                      {profile.user_role || profile.user_type || "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {profile.onboarding_completed_at ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {profile.nda_accepted ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${
                      profile.kyc_status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      profile.kyc_status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {profile.kyc_status || "none"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {profile.subscription_tier || "none"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedProfile(expandedProfile === profile.id ? null : profile.id)}
                    >
                      {expandedProfile === profile.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </td>
                </tr>
                {expandedProfile === profile.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleNda(profile)} disabled={updating[`${profile.id}_nda`]}>
                          {updating[`${profile.id}_nda`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          {profile.nda_accepted ? "Revoke NDA" : "Grant NDA"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resetOnboarding(profile)} disabled={updating[`${profile.id}_onboarding`]}>
                          {updating[`${profile.id}_onboarding`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                          Reset Onboarding
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleAdmin(profile)} disabled={updating[`${profile.id}_role`]}>
                          {updating[`${profile.id}_role`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                          {profile.role === "admin" ? "Remove Admin" : "Make Admin"}
                        </Button>
                        <Select onValueChange={val => changeUserRole(profile, val)} defaultValue={profile.user_role || "member"}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Change type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="investor">Investor</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="destructive" onClick={() => deleteProfile(profile)} disabled={updating[`${profile.id}_delete`]}>
                          {updating[`${profile.id}_delete`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Delete Profile
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        Profile ID: {profile.id} • User ID: {profile.user_id} • Created: {new Date(profile.created_date).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {selectedProfile && (
        <UserActivityPanel profile={selectedProfile} onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  );
}
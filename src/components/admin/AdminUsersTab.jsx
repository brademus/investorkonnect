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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] rounded-lg"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="investor">Investors</SelectItem>
            <SelectItem value="agent">Agents</SelectItem>
            <SelectItem value="member">Members</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="onboarded">Onboarded</SelectItem>
            <SelectItem value="not_onboarded">Not Onboarded</SelectItem>
            <SelectItem value="nda_signed">NDA Signed</SelectItem>
            <SelectItem value="nda_unsigned">NDA Not Signed</SelectItem>
            <SelectItem value="admin">Admins Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-[#808080] mb-3">Showing {filtered.length} of {profiles.length} users — click any row for activity, expand for admin actions</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th className="px-4 py-3 font-medium text-[#808080] text-xs uppercase tracking-wider">User</th>
              <th className="px-4 py-3 font-medium text-[#808080] text-xs uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 font-medium text-[#808080] text-xs uppercase tracking-wider">Onboarded</th>
              <th className="px-4 py-3 font-medium text-[#808080] text-xs uppercase tracking-wider">NDA</th>

              <th className="px-4 py-3 font-medium text-[#808080] text-xs uppercase tracking-wider">Subscription</th>
              <th className="px-4 py-3 font-medium text-[#808080] text-xs uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((profile, idx) => (
              <React.Fragment key={profile.id}>
                <tr className="transition-colors hover:bg-[rgba(255,255,255,0.02)]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td className="px-4 py-3.5">
                    <button onClick={() => setSelectedProfile(profile)} className="text-left">
                      <div className="font-medium text-[#FAFAFA] hover:text-[#E3C567] transition-colors">
                        {profile.full_name || "No name"}
                      </div>
                      <div className="text-xs text-[#808080]">{profile.email}</div>
                    </button>
                    {profile.role === "admin" && (
                      <Badge className="bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30 ml-2 text-[10px]">Admin</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge className="capitalize text-xs bg-[rgba(255,255,255,0.06)] text-[#FAFAFA] border border-[rgba(255,255,255,0.08)]">
                      {profile.user_role || profile.user_type || "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    {profile.onboarding_completed_at ? (
                      <CheckCircle className="w-4 h-4 text-[#34D399]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#808080]/40" />
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {profile.nda_accepted ? (
                      <CheckCircle className="w-4 h-4 text-[#34D399]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#808080]/40" />
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <Badge className="capitalize text-[10px] bg-[rgba(255,255,255,0.04)] text-[#808080] border border-[rgba(255,255,255,0.06)] rounded-full">
                      {profile.subscription_tier || "none"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#808080] hover:text-[#FAFAFA] hover:bg-transparent"
                      onClick={() => setExpandedProfile(expandedProfile === profile.id ? null : profile.id)}
                    >
                      {expandedProfile === profile.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </td>
                </tr>
                {expandedProfile === profile.id && (
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <td colSpan={7} className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="bg-transparent border border-[#1F1F1F] text-[#FAFAFA] hover:border-[#E3C567] hover:bg-transparent rounded-lg" onClick={() => toggleNda(profile)} disabled={updating[`${profile.id}_nda`]}>
                          {updating[`${profile.id}_nda`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          {profile.nda_accepted ? "Revoke NDA" : "Grant NDA"}
                        </Button>
                        <Button size="sm" className="bg-transparent border border-[#1F1F1F] text-[#FAFAFA] hover:border-[#E3C567] hover:bg-transparent rounded-lg" onClick={() => resetOnboarding(profile)} disabled={updating[`${profile.id}_onboarding`]}>
                          {updating[`${profile.id}_onboarding`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                          Reset Onboarding
                        </Button>
                        <Button size="sm" className="bg-transparent border border-[#1F1F1F] text-[#FAFAFA] hover:border-[#E3C567] hover:bg-transparent rounded-lg" onClick={() => toggleAdmin(profile)} disabled={updating[`${profile.id}_role`]}>
                          {updating[`${profile.id}_role`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                          {profile.role === "admin" ? "Remove Admin" : "Make Admin"}
                        </Button>
                        <Select onValueChange={val => changeUserRole(profile, val)} defaultValue={profile.user_role || "member"}>
                          <SelectTrigger className="w-[130px] h-8 text-xs bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] rounded-lg">
                            <SelectValue placeholder="Change type" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
                            <SelectItem value="investor">Investor</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 rounded-lg" onClick={() => deleteProfile(profile)} disabled={updating[`${profile.id}_delete`]}>
                          {updating[`${profile.id}_delete`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Delete Profile
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-[#808080]/50">
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
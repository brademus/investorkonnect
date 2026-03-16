import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserPlus, Trash2, Loader2, Shield, Eye, Mail, CheckCircle, Clock, Crown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import TeamInviteBanner from "./TeamInviteBanner";

export default function TeamManagement({ profile }) {
  const [seats, setSeats] = useState([]);
  const [myMembership, setMyMembership] = useState(null);
  const [isOwner, setIsOwner] = useState(true);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('teamManage', { action: 'list' });
      setSeats(res.data.seats || []);
      setMyMembership(res.data.my_membership || null);
      setIsOwner(res.data.is_owner);
    } catch (err) {
      console.error('Failed to load team:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTeam(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error("Enter an email address"); return; }
    const ownerDomain = profile?.email?.split('@')[1]?.toLowerCase();
    const inviteeDomain = inviteEmail.trim().split('@')[1]?.toLowerCase();
    if (ownerDomain && inviteeDomain && ownerDomain !== inviteeDomain) {
      toast.error(`Team members must use a @${ownerDomain} email address.`);
      return;
    }
    setInviting(true);
    try {
      const res = await base44.functions.invoke('teamInvite', { email: inviteEmail.trim(), team_role: inviteRole });
      if (res?.data?.ok) {
        toast.success(res.data.message);
        setInviteEmail("");
        fetchTeam();
      } else {
        toast.error(res?.data?.error || 'Failed to send invite');
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error 
        || err?.data?.error 
        || (typeof err?.response?.data === 'string' ? err.response.data : null)
        || err?.message 
        || 'Failed to send invite';
      toast.error(errMsg);
    }
    setInviting(false);
  };

  const handleRemove = async (seatId) => {
    setRemovingId(seatId);
    try {
      const res = await base44.functions.invoke('teamManage', { action: 'remove', seat_id: seatId });
      if (res.data.ok) { toast.success('Team member removed'); fetchTeam(); }
    } catch (err) { toast.error('Failed to remove member'); }
    setRemovingId(null);
  };

  const handleRoleChange = async (seatId, newRole) => {
    try {
      await base44.functions.invoke('teamManage', { action: 'updateRole', seat_id: seatId, team_role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchTeam();
    } catch (err) { toast.error('Failed to update role'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  // If user is a team member (not owner), show their membership info
  if (!isOwner && myMembership) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-[#E3C567]" />
          <h3 className="text-lg font-semibold text-[#FAFAFA]">Team Membership</h3>
        </div>
        <div className="rounded-xl p-4 border border-[#1F1F1F] bg-[#141414]">
          <p className="text-sm text-[#FAFAFA]">
            You are a <span className="text-[#E3C567] font-semibold">{myMembership.team_role}</span> on{" "}
            <span className="font-semibold">{myMembership.owner_email}</span>'s team.
          </p>
          <p className="text-xs text-[#808080] mt-2">
            {myMembership.team_role === 'admin' 
              ? 'You have full access to create, edit, and manage deals.' 
              : 'You can view deals and activity but cannot make changes.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-[#E3C567]" />
        <h3 className="text-lg font-semibold text-[#FAFAFA]">Team Management</h3>
      </div>

      {/* Pending invite banner for the owner */}
      <TeamInviteBanner profile={profile} onAccepted={fetchTeam} />

      {/* Invite form */}
      <div className="rounded-xl p-5 border border-[#1F1F1F] bg-[#141414]">
        <Label className="text-[#FAFAFA] text-sm font-medium mb-3 block">Invite Team Member</Label>
        <p className="text-xs text-[#808080] mb-4">
          Team members must use a matching <span className="text-[#E3C567] font-medium">@{profile?.email?.split('@')[1] || 'company.com'}</span> email address.
        </p>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              type="email"
              placeholder={`colleague@${profile?.email?.split('@')[1] || 'company.com'}`}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="bg-[#0D0D0D] border-[#333] text-[#FAFAFA]"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
          </div>
          <div className="w-[130px]">
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="bg-[#0D0D0D] border-[#333] text-[#FAFAFA]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0D0D0D] border-[#333]">
                <SelectItem value="admin"><div className="flex items-center gap-2"><Shield className="w-3 h-3" /> Admin</div></SelectItem>
                <SelectItem value="viewer"><div className="flex items-center gap-2"><Eye className="w-3 h-3" /> Viewer</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleInvite} disabled={inviting} className="bg-[#E3C567] text-black hover:bg-[#EDD89F]">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-1" /> Invite</>}
          </Button>
        </div>
      </div>

      {/* Team list */}
      {seats.length > 0 && (
        <div className="rounded-xl border border-[#1F1F1F] overflow-hidden">
          <div className="px-5 py-3 bg-[#141414] border-b border-[#1F1F1F]">
            <p className="text-sm font-medium text-[#FAFAFA]">{seats.length} team member{seats.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-[#1F1F1F]">
            {seats.map(seat => (
              <div key={seat.id} className="px-5 py-4 flex items-center justify-between gap-4 bg-[#111114] hover:bg-[#141418] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-[#808080]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[#FAFAFA] truncate">
                      {seat.member_name || seat.member_email}
                    </p>
                    {seat.member_name && <p className="text-xs text-[#808080] truncate">{seat.member_email}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {seat.status === 'invited' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Pending
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5" /> Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Select value={seat.team_role} onValueChange={(val) => handleRoleChange(seat.id, val)}>
                    <SelectTrigger className="w-[110px] bg-[#0D0D0D] border-[#333] text-[#FAFAFA] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0D0D0D] border-[#333]">
                      <SelectItem value="admin"><div className="flex items-center gap-2 text-xs"><Shield className="w-3 h-3" /> Admin</div></SelectItem>
                      <SelectItem value="viewer"><div className="flex items-center gap-2 text-xs"><Eye className="w-3 h-3" /> Viewer</div></SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(seat.id)}
                    disabled={removingId === seat.id}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
                  >
                    {removingId === seat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {seats.length === 0 && (
        <div className="text-center py-8 text-[#808080]">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No team members yet. Invite someone to get started.</p>
        </div>
      )}
    </div>
  );
}
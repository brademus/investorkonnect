import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, ArrowLeft, CreditCard, Loader2, Plus, Minus,
  Mail, UserPlus, XCircle, CheckCircle, Clock, Shield, User
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import TeamInviteBanner from "@/components/team/TeamInviteBanner";

function TeamAccountContent() {
  const navigate = useNavigate();
  const { loading: profileLoading, user, profile } = useCurrentProfile();

  const [seats, setSeats] = useState([]);
  const [myMembership, setMyMembership] = useState(null);
  const [isOwner, setIsOwner] = useState(true);
  const [loading, setLoading] = useState(true);

  // Buy seats state
  const [buyCount, setBuyCount] = useState(1);
  const [buying, setBuying] = useState(false);

  // Per-seat action state
  const [inviteEmails, setInviteEmails] = useState({});
  const [invitingId, setInvitingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const ownerDomain = user?.email?.split('@')[1]?.toLowerCase() || '';

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('teamManage', { action: 'list' });
      setSeats(res.data?.seats || []);
      setMyMembership(res.data?.my_membership || null);
      setIsOwner(res.data?.is_owner);
    } catch (err) {
      console.error('Failed to load team:', err);
    }
    setLoading(false);
  };

  useEffect(() => { if (profile?.id) fetchTeam(); }, [profile?.id]);

  const openSeats = seats.filter(s => s.status === 'open');
  const assignedSeats = seats.filter(s => s.status === 'invited' || s.status === 'active');
  const totalPaidSeats = seats.filter(s => s.status !== 'removed').length;

  const handleBuySeats = async () => {
    setBuying(true);
    try {
      const res = await base44.functions.invoke('checkoutSeats', { count: buyCount });
      console.log('[TeamAccount] checkoutSeats response:', JSON.stringify(res?.data));

      if (res?.data?.ok) {
        const diag = res.data.diag || {};
        toast.success(`${res.data.seats_purchased} seat${res.data.seats_purchased !== 1 ? 's' : ''} purchased! Stripe mode: ${diag.stripe_key_type || 'unknown'}`);
        setBuyCount(1);
        await new Promise(r => setTimeout(r, 1500));
        fetchTeam();
      } else {
        const diag = res?.data?.diag || {};
        const msg = res?.data?.message || 'Failed to purchase seats';
        console.error('[TeamAccount] checkoutSeats failed:', msg, 'diag:', JSON.stringify(diag));
        toast.error(msg);
      }
    } catch (err) {
      console.error('[TeamAccount] checkoutSeats exception:', err);
      let msg = 'Failed to purchase seats';
      if (err?.data?.message) msg = err.data.message;
      else if (err?.response?.data?.message) msg = err.response.data.message;
      else if (err?.message && !err.message.includes('status code')) msg = err.message;
      const diag = err?.data?.diag || err?.response?.data?.diag;
      if (diag) console.error('[TeamAccount] diag:', JSON.stringify(diag));
      toast.error(msg);
    }
    setBuying(false);
  };

  const handleAssignSeat = async (seatId) => {
    const email = (inviteEmails[seatId] || '').trim().toLowerCase();
    if (!email || !email.includes('@')) { toast.error('Enter a valid email address'); return; }
    const domain = email.split('@')[1];
    if (domain !== ownerDomain) { toast.error(`Team members must use @${ownerDomain} email addresses`); return; }
    if (email === user.email.toLowerCase()) { toast.error('You cannot invite yourself'); return; }

    setInvitingId(seatId);
    try {
      const res = await base44.functions.invoke('teamManage', { action: 'assign', seat_id: seatId, email });
      if (res?.data?.ok) {
        toast.success(`Invite sent to ${email}`);
        setInviteEmails(prev => ({ ...prev, [seatId]: '' }));
        fetchTeam();
      } else {
        toast.error(res?.data?.error || 'Failed to send invite');
      }
    } catch (err) {
      let msg = 'Failed to send invite';
      if (err?.data?.error) msg = err.data.error;
      else if (err?.response?.data?.error) msg = err.response.data.error;
      toast.error(msg);
    }
    setInvitingId(null);
  };

  const handleRemoveMember = async (seatId) => {
    setRemovingId(seatId);
    try {
      const res = await base44.functions.invoke('teamManage', { action: 'remove_member', seat_id: seatId });
      if (res?.data?.ok) { toast.success('Member removed — seat is now available'); fetchTeam(); }
      else toast.error(res?.data?.error || 'Failed to remove member');
    } catch (_) { toast.error('Failed to remove member'); }
    setRemovingId(null);
  };

  const handleCancelSeat = async (seatId) => {
    setCancellingId(seatId);
    try {
      const res = await base44.functions.invoke('teamManage', { action: 'cancel_seat', seat_id: seatId });
      if (res?.data?.ok) { toast.success('Seat cancelled — billing stopped'); fetchTeam(); }
      else toast.error(res?.data?.error || 'Failed to cancel seat');
    } catch (_) { toast.error('Failed to cancel seat'); }
    setCancellingId(null);
  };

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // Team member view (not owner)
  if (!isOwner && myMembership) {
    return (
      <div className="min-h-screen bg-transparent py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link to={createPageUrl("Pipeline")} className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-4">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-[#E3C567]" />
              <h1 className="text-3xl font-bold text-[#FAFAFA]">Team Account</h1>
            </div>
          </div>
          <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center gap-2 mb-4">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl("Pipeline")} className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-4">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-[#E3C567]" />
            <h1 className="text-3xl font-bold text-[#FAFAFA]">Team Account</h1>
          </div>
          <p className="text-[#808080]">Purchase seats and invite your team to share your deal pipeline</p>
        </div>

        <TeamInviteBanner profile={profile} onAccepted={fetchTeam} />

        {/* Billing Summary */}
        {totalPaidSeats > 0 && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-[#E3C567]" />
                <div>
                  <p className="text-sm font-semibold text-[#FAFAFA]">{totalPaidSeats} seat{totalPaidSeats !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-[#808080]">{openSeats.length} open · {assignedSeats.length} assigned</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#E3C567]">${totalPaidSeats * 10}/mo</p>
                <p className="text-xs text-[#808080]">added to subscription</p>
              </div>
            </div>
          </div>
        )}

        {/* Buy Seats */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-[#E3C567]" />
            <h3 className="text-lg font-semibold text-[#FAFAFA]">Buy Team Seats</h3>
          </div>
          <p className="text-sm text-[#808080] mb-5">Each seat is $10/month. Purchase seats first, then assign them to team members.</p>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setBuyCount(Math.max(1, buyCount - 1))} className="w-10 h-10 rounded-xl bg-[#0D0D0D] border border-[#333] flex items-center justify-center text-[#FAFAFA] hover:border-[#E3C567] transition-colors">
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-16 h-10 rounded-xl bg-[#0D0D0D] border border-[#333] flex items-center justify-center">
                <span className="text-xl font-bold text-[#E3C567]">{buyCount}</span>
              </div>
              <button type="button" onClick={() => setBuyCount(Math.min(10, buyCount + 1))} className="w-10 h-10 rounded-xl bg-[#0D0D0D] border border-[#333] flex items-center justify-center text-[#FAFAFA] hover:border-[#E3C567] transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-[#808080]">
              <span className="text-[#E3C567] font-bold text-lg">${buyCount * 10}</span>/mo
            </div>
            <Button onClick={handleBuySeats} disabled={buying} className="bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold rounded-full h-11 px-6 ml-auto">
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4 mr-2" />Buy {buyCount} Seat{buyCount !== 1 ? 's' : ''}</>}
            </Button>
          </div>
        </div>

        {/* Open Seats */}
        {openSeats.length > 0 && (
          <div className="rounded-2xl p-6 mb-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-[#E3C567]" />
              <h3 className="text-lg font-semibold text-[#FAFAFA]">Open Seats ({openSeats.length})</h3>
            </div>
            <p className="text-xs text-[#808080] mb-4">
              Assign a team member to each open seat. They must use a <span className="text-[#E3C567]">@{ownerDomain}</span> email.
            </p>
            <div className="space-y-3">
              {openSeats.map((seat, idx) => (
                <div key={seat.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0D0D0D] border border-[#1F1F1F]">
                  <div className="w-8 h-8 rounded-full bg-[#E3C567]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#E3C567]">{idx + 1}</span>
                  </div>
                  <Input
                    type="email"
                    placeholder={`teammate@${ownerDomain}`}
                    value={inviteEmails[seat.id] || ''}
                    onChange={(e) => setInviteEmails(prev => ({ ...prev, [seat.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAssignSeat(seat.id)}
                    className="bg-[#141414] border-[#333] text-[#FAFAFA] flex-1"
                  />
                  <Button onClick={() => handleAssignSeat(seat.id)} disabled={invitingId === seat.id} size="sm" className="bg-[#E3C567] text-black hover:bg-[#EDD89F] flex-shrink-0">
                    {invitingId === seat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-1" /> Invite</>}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleCancelSeat(seat.id)} disabled={cancellingId === seat.id} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 flex-shrink-0" title="Cancel seat (stop billing)">
                    {cancellingId === seat.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned Team Members */}
        {assignedSeats.length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <div className="px-6 py-4 border-b border-[#1F1F1F]">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#E3C567]" />
                <h3 className="text-lg font-semibold text-[#FAFAFA]">Team Members ({assignedSeats.length})</h3>
              </div>
            </div>
            <div className="divide-y divide-[#1F1F1F]">
              {assignedSeats.map(seat => (
                <div key={seat.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-[#808080]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[#FAFAFA] truncate">{seat.member_name || seat.member_email}</p>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select 
                      value={seat.team_role === 'viewer' ? 'member' : (seat.team_role || 'member')} 
                      onValueChange={async (val) => {
                        try {
                          await base44.functions.invoke('teamManage', { action: 'updateRole', seat_id: seat.id, team_role: val });
                          toast.success(`Role updated to ${val}`);
                          fetchTeam();
                        } catch (_) { toast.error('Failed to update role'); }
                      }}
                    >
                      <SelectTrigger className="w-[110px] bg-[#0D0D0D] border-[#333] text-[#FAFAFA] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0D0D0D] border-[#333]">
                        <SelectItem value="admin"><div className="flex items-center gap-2 text-xs"><Shield className="w-3 h-3" /> Admin</div></SelectItem>
                        <SelectItem value="member"><div className="flex items-center gap-2 text-xs"><User className="w-3 h-3" /> Member</div></SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(seat.id)} disabled={removingId === seat.id} className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 text-xs">
                      {removingId === seat.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Remove"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleCancelSeat(seat.id)} disabled={cancellingId === seat.id} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs">
                      {cancellingId === seat.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel Seat"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalPaidSeats === 0 && (
          <div className="text-center py-12 text-[#808080]">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-1">No team seats yet</p>
            <p className="text-xs">Purchase seats above to start building your team</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamAccount() {
  return (
    <AuthGuard requireAuth={true}>
      <TeamAccountContent />
    </AuthGuard>
  );
}
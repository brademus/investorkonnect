import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Shows a banner if the current user has a pending team invitation.
 * Appears at the top of the Team Management section or Pipeline.
 */
export default function TeamInviteBanner({ profile, onAccepted }) {
  const [invite, setInvite] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.email) return;
    const check = async () => {
      try {
        const seats = await base44.entities.TeamSeat.filter({ member_email: profile.email.toLowerCase(), status: 'invited' });
        setInvite(seats[0] || null);
      } catch (_) {}
      setLoading(false);
    };
    check();
  }, [profile?.email]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await base44.functions.invoke('teamManage', { action: 'accept' });
      if (res.data.ok) {
        toast.success('You have joined the team!');
        setInvite(null);
        onAccepted?.();
      }
    } catch (err) {
      toast.error('Failed to accept invitation');
    }
    setAccepting(false);
  };

  if (loading || !invite) return null;

  return (
    <div className="rounded-xl p-4 border border-[#E3C567]/30 bg-[#E3C567]/5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <UserPlus className="w-5 h-5 text-[#E3C567]" />
        <div>
          <p className="text-sm text-[#FAFAFA] font-medium">Team Invitation</p>
          <p className="text-xs text-[#808080]">
            <span className="text-[#E3C567]">{invite.owner_email}</span> invited you as a{" "}
            <span className="font-semibold">{invite.team_role}</span>
          </p>
        </div>
      </div>
      <Button onClick={handleAccept} disabled={accepting} className="bg-[#E3C567] text-black hover:bg-[#EDD89F]">
        {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" /> Accept</>}
      </Button>
    </div>
  );
}
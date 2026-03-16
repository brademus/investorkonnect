import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Users, Shield, Eye } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const seatId = urlParams.get("seatId");

  const [loading, setLoading] = useState(true);
  const [seat, setSeat] = useState(null);
  const [ownerName, setOwnerName] = useState("");
  const [responding, setResponding] = useState(false);
  const [result, setResult] = useState(null); // 'accepted' | 'declined' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!seatId) { setLoading(false); return; }
    const load = async () => {
      try {
        // Check if user is authenticated
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          // Redirect to login, then come back here
          base44.auth.redirectToLogin(window.location.href);
          return;
        }

        // Fetch the seat
        const seats = await base44.entities.TeamSeat.filter({ id: seatId });
        if (!seats.length) { setErrorMsg("Invitation not found."); setLoading(false); return; }
        const s = seats[0];
        setSeat(s);

        // Check if it's still pending
        if (s.status !== 'invited') {
          setResult(s.status === 'active' ? 'accepted' : 'declined');
          setLoading(false);
          return;
        }

        // Get owner name
        try {
          const owners = await base44.entities.Profile.filter({ id: s.owner_profile_id });
          if (owners.length) setOwnerName(owners[0].full_name || owners[0].email || s.owner_email);
          else setOwnerName(s.owner_email);
        } catch (_) {
          setOwnerName(s.owner_email);
        }
      } catch (err) {
        console.error("Error loading invite:", err);
        setErrorMsg("Could not load invitation.");
      }
      setLoading(false);
    };
    load();
  }, [seatId]);

  const handleRespond = async (action) => {
    setResponding(true);
    try {
      const res = await base44.functions.invoke('teamAcceptInvite', { seat_id: seatId, action });
      if (res.data?.ok) {
        setResult(res.data.action);
        if (res.data.action === 'accepted') {
          toast.success("You've joined the team!");
          // Clear profile cache so Pipeline picks up new team_owner_id
          try { sessionStorage.removeItem('__ik_profile_cache'); } catch (_) {}
          setTimeout(() => navigate(createPageUrl("Pipeline"), { replace: true }), 1500);
        } else {
          toast.info("Invitation declined.");
        }
      } else {
        toast.error(res.data?.error || "Something went wrong");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.data?.error || err?.message || "Failed to respond";
      toast.error(msg);
      setErrorMsg(msg);
    }
    setResponding(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  if (!seatId || errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="ik-page-card max-w-md w-full text-center py-12">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#FAFAFA] mb-2">Invalid Invitation</h2>
          <p className="text-[#808080] mb-6">{errorMsg || "No invitation ID provided."}</p>
          <Button onClick={() => navigate(createPageUrl("Home"))} className="bg-[#E3C567] text-black hover:bg-[#EDD89F]">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (result === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="ik-page-card max-w-md w-full text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#E3C567] mb-2">Welcome to the Team!</h2>
          <p className="text-[#808080] mb-6">You now have access to {ownerName || "your team's"} deal dashboard.</p>
          <Button onClick={() => { try { sessionStorage.removeItem('__ik_profile_cache'); } catch (_) {} navigate(createPageUrl("Pipeline"), { replace: true }); }} className="bg-[#E3C567] text-black hover:bg-[#EDD89F]">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (result === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="ik-page-card max-w-md w-full text-center py-12">
          <XCircle className="w-12 h-12 text-[#808080] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#FAFAFA] mb-2">Invitation Declined</h2>
          <p className="text-[#808080] mb-6">You can always ask the team owner to re-invite you later.</p>
          <Button onClick={() => navigate(createPageUrl("Home"))} variant="outline" className="border-[#333] text-[#FAFAFA]">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Show the invitation details with accept/decline
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="ik-page-card max-w-md w-full py-10 px-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#E3C567]/15 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[#E3C567]" />
          </div>
          <h2 className="text-2xl font-bold text-[#E3C567] mb-2">Team Invitation</h2>
          <p className="text-[#808080]">You've been invited to join a team</p>
        </div>

        <div className="rounded-xl p-5 border border-[#1F1F1F] bg-[#0D0D0D] mb-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#808080] uppercase tracking-wider mb-1">Invited by</p>
              <p className="text-[#FAFAFA] font-semibold">{ownerName}</p>
            </div>
            <div>
              <p className="text-xs text-[#808080] uppercase tracking-wider mb-1">Your Role</p>
              <div className="flex items-center gap-2">
                {seat.team_role === 'admin' ? (
                  <><Shield className="w-4 h-4 text-[#E3C567]" /><span className="text-[#FAFAFA] font-semibold">Admin</span></>
                ) : (
                  <><Eye className="w-4 h-4 text-[#808080]" /><span className="text-[#FAFAFA] font-semibold">Viewer</span></>
                )}
              </div>
              <p className="text-xs text-[#808080] mt-1">
                {seat.team_role === 'admin'
                  ? 'Full access to create, edit, and manage all deals.'
                  : 'View-only access to all deals and activity.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => handleRespond('decline')}
            disabled={responding}
            variant="outline"
            className="flex-1 border-[#333] text-[#FAFAFA] hover:bg-[#1F1F1F]"
          >
            {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Decline'}
          </Button>
          <Button
            onClick={() => handleRespond('accept')}
            disabled={responding}
            className="flex-1 bg-[#E3C567] text-black hover:bg-[#EDD89F] font-semibold"
          >
            {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" /> Accept</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
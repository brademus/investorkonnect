import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
import { 
  Loader2, MapPin, Star, TrendingUp, Users, 
  ArrowRight, CheckCircle, Shield, Lock 
} from "lucide-react";
import { toast } from "sonner";

/**
 * STEP 7: AGENT MATCHING (Investor Only)
 * 
 * Shows top 3 matched agents for investor's target state.
 * ENFORCES LOCK-IN: If investor already has a room in this state, redirect to it.
 * No top navigation - wizard flow only.
 */
function MatchesContent() {
  const navigate = useNavigate();
  const { loading, profile, role, targetState } = useCurrentProfile();
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [engaging, setEngaging] = useState(null);
  const [existingRoom, setExistingRoom] = useState(null);

  useEffect(() => {
    document.title = "Your Top Matches - AgentVault";
  }, []);

  // Check for existing room lock-in
  useEffect(() => {
    if (loading || !profile) return;

    const checkLockIn = async () => {
      try {
        console.log('[Matches] Checking for existing rooms in state:', targetState);
        
        // Get all investor's rooms
        const response = await base44.functions.invoke('inboxList');
        const rooms = response.data || [];
        
        // Check if any room exists for this state
        const roomInState = rooms.find(room => {
          // Room metadata should include state
          const roomState = room.state || room.targetState || room.metadata?.state;
          return roomState === targetState && !room.closedAt;
        });

        if (roomInState) {
          console.log('[Matches] 🔒 Found existing room for state, redirecting:', roomInState.id);
          toast.info('You already have an active deal room for this market');
          
          // Redirect to existing room
          setTimeout(() => {
            navigate(createPageUrl(`Room?id=${roomInState.id}`), { replace: true });
          }, 1500);
          
          setExistingRoom(roomInState);
          return;
        }

        // No lock-in, fetch matches
        await fetchMatches();

      } catch (error) {
        console.error('[Matches] Error checking lock-in:', error);
        toast.error('Failed to load matches');
        setLoadingMatches(false);
      }
    };

    checkLockIn();
  }, [loading, profile, targetState, navigate]);

  const fetchMatches = async () => {
    try {
      const response = await base44.functions.invoke('matchList', {
        state: targetState
      });

      if (response.data?.matches) {
        // Get top 3 matches
        const topMatches = response.data.matches.slice(0, 3);
        setMatches(topMatches);
        console.log('[Matches] Loaded matches:', topMatches.length);
      } else {
        setMatches([]);
      }

      setLoadingMatches(false);
    } catch (error) {
      console.error('[Matches] Error fetching matches:', error);
      toast.error('Failed to load agent matches');
      setLoadingMatches(false);
    }
  };

  const handleEngage = async (agent) => {
    setEngaging(agent.id);

    try {
      console.log('[Matches] Creating room with agent:', agent.id);

      // Create room via existing backend
      const response = await base44.functions.invoke('introCreate', {
        agentId: agent.id,
        message: `Hi ${agent.full_name}, I'd like to connect about properties in ${targetState}.`,
        state: targetState
      });

      if (response.data?.room_id) {
        toast.success(`Connected with ${agent.full_name}!`);
        
        // Navigate to the new room
        setTimeout(() => {
          navigate(createPageUrl(`Room?id=${response.data.room_id}`), { replace: true });
        }, 1000);
      } else {
        throw new Error('No room ID returned');
      }

    } catch (error) {
      console.error('[Matches] Error engaging agent:', error);
      toast.error('Failed to connect with agent. Please try again.');
      setEngaging(null);
    }
  };

  // Locked into existing room
  if (existingRoom) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Active Deal Room</h2>
            <p className="text-slate-600 mb-6">
              You already have an active deal room for {targetState}. Redirecting...
            </p>
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || loadingMatches) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Finding your top matches...</p>
        </div>
      </div>
    );
  }

  // No matches found
  if (matches.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No Matches Yet</h2>
            <p className="text-slate-600 mb-6">
              We're working on finding agents in {targetState}. Check back soon!
            </p>
            <Button
              onClick={() => navigate(createPageUrl("Dashboard"))}
              variant="outline"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 py-8">
      {/* NO TOP NAV */}
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            Your Top Matches in {targetState}
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            We've found the best verified agents for your investment goals
          </p>
        </div>

        {/* Lock-in Notice */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8 max-w-3xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900 mb-1">Exclusive Partnership Model</h3>
              <p className="text-sm text-blue-800">
                Once you engage an agent for {targetState}, they become your exclusive partner for that market. 
                This ensures focused attention and alignment on your investment goals.
              </p>
            </div>
          </div>
        </div>

        {/* Match Cards */}
        <div className="grid gap-6 mb-12">
          {matches.map((agent, index) => (
            <div
              key={agent.id}
              className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-8 hover:shadow-2xl transition-all"
            >
              <div className="flex items-start gap-6">
                
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-yellow-900' :
                    index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700' :
                    'bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100'
                  }`}>
                    #{index + 1}
                  </div>
                </div>

                {/* Agent Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {agent.full_name}
                      </h3>
                      {agent.agent?.brokerage && (
                        <p className="text-slate-600">{agent.agent.brokerage}</p>
                      )}
                    </div>
                    
                    {agent.agent?.verification_status === 'verified' && (
                      <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        Verified
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 mb-1">
                        {agent.score || 95}%
                      </div>
                      <div className="text-xs text-slate-600">Match Score</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="text-2xl font-bold text-slate-900">
                          {agent.rating || '4.9'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">Rating</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900 mb-1">
                        {agent.agent?.markets?.length || 1}
                      </div>
                      <div className="text-xs text-slate-600">Markets</div>
                    </div>
                  </div>

                  {/* Bio */}
                  {agent.agent?.bio && (
                    <p className="text-slate-700 mb-4 line-clamp-2">
                      {agent.agent.bio}
                    </p>
                  )}

                  {/* Specialties */}
                  {agent.agent?.specialties && agent.agent.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {agent.agent.specialties.slice(0, 4).map((specialty, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Match Reasons */}
                  {agent.reasons && agent.reasons.length > 0 && (
                    <div className="bg-emerald-50 rounded-lg p-4 mb-4 border border-emerald-200">
                      <h4 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Why this match?
                      </h4>
                      <ul className="space-y-1">
                        {agent.reasons.map((reason, idx) => (
                          <li key={idx} className="text-sm text-emerald-800 flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CTA */}
                  <Button
                    onClick={() => handleEngage(agent)}
                    disabled={engaging !== null}
                    size="lg"
                    className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg"
                  >
                    {engaging === agent.id ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creating Deal Room...
                      </>
                    ) : (
                      <>
                        Engage {agent.full_name}
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-2">What happens next?</h4>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>You'll enter a secure deal room with your chosen agent</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>Both parties sign mutual NDA for protection</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>Share documents, communicate, and collaborate on deals</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>All activity is logged and auditable</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Matches() {
  return (
    <StepGuard requiredStep={6}> {/* Requires NDA */}
      <MatchesContent />
    </StepGuard>
  );
}
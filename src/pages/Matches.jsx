import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { useWizard } from "@/components/WizardContext";
import { StepGuard } from "@/components/StepGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star, Shield, Users, Loader2, ArrowRight,
  MapPin, Briefcase
} from "lucide-react";
import { toast } from "sonner";

/**
 * STEP 7: MATCHING (Investor Only)
 * 
 * Show top 3 matched agents. 
 * Enforce lock-in: one agent per state.
 * No top nav.
 */
function MatchesContent() {
  const navigate = useNavigate();
  const { profile, targetState, refresh } = useCurrentProfile();
  const { selectedState } = useWizard();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [existingRoom, setExistingRoom] = useState(null);

  const state = targetState || selectedState;

  useEffect(() => {
    document.title = "Find Your Agent - AgentVault";
    checkLockIn();
  }, []);

  const checkLockIn = async () => {
    try {
      // Check if investor already has a room for this state
      const response = await base44.functions.invoke('inboxList');
      const rooms = response.data || [];
      
      const roomForState = rooms.find(r => 
        r.room && 
        r.room.state === state &&
        !r.room.closedAt
      );

      if (roomForState) {
        // Lock-in: redirect to existing room
        toast.info(`You already have an active room for ${state}`);
        setExistingRoom(roomForState);
        navigate(createPageUrl(`Room/${roomForState.roomId}`), { replace: true });
        return;
      }

      // No room - load matches
      await loadMatches();
    } catch (error) {
      console.error('[Matches] Lock-in check error:', error);
      await loadMatches(); // Continue anyway
    }
  };

  const loadMatches = async () => {
    try {
      setLoading(true);
      
      // Use matchList function to get real matches
      const response = await base44.functions.invoke('matchList');
      const data = response.data;
      
      setMatches(data.results || []);
      setLoading(false);
    } catch (error) {
      console.error('[Matches] Load error:', error);
      toast.error("Failed to load matches");
      setLoading(false);
    }
  };

  const handleEngage = async (match) => {
    try {
      toast.info("Creating your deal room...");

      // Create room via introCreate
      const response = await base44.functions.invoke('introCreate', {
        agentId: match.agentId || match.agent?.userId,
        state: state
      });

      if (response.data.roomId) {
        toast.success("Deal room created!");
        await refresh(); // Refresh to update hasRoom
        
        // Navigate to room - now nav will appear
        navigate(createPageUrl(`Room/${response.data.roomId}`), { replace: true });
      } else {
        toast.error("Failed to create room");
      }
    } catch (error) {
      console.error('[Matches] Engage error:', error);
      toast.error("Failed to engage agent");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (existingRoom) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 py-12">
      {/* NO TOP NAV */}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Your Top Matches</h1>
          <p className="text-xl text-slate-600">
            Based on your criteria, here are the best-matched agents for <strong>{state}</strong>
          </p>
        </div>

        {/* Matches Grid */}
        {matches.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-lg">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No matches found</h3>
            <p className="text-slate-600 mb-6">
              We couldn't find agents matching your criteria in this market yet.
            </p>
            <Button onClick={() => navigate(createPageUrl("Home"))}>
              Select Different Market
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {matches.slice(0, 3).map((match, idx) => (
              <div
                key={match.matchId || match.id || idx}
                className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden hover:shadow-2xl hover:scale-105 transition-all"
              >
                {/* Agent Card */}
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    {match.agent?.headshotUrl ? (
                      <img
                        src={match.agent.headshotUrl}
                        alt={match.agent.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="w-8 h-8 text-blue-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1 text-lg">{match.agent?.name || 'Agent'}</h3>
                      <p className="text-sm text-slate-600">{match.agent?.company || match.agent?.brokerage}</p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {match.agent?.vetted && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <Shield className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    {match.score && (
                      <Badge variant="outline">
                        {match.score}% Match
                      </Badge>
                    )}
                  </div>

                  {/* Markets */}
                  {match.agent?.markets && match.agent.markets.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-1 text-xs text-slate-600 mb-2">
                        <MapPin className="w-3 h-3" />
                        <span>Markets</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {match.agent.markets.slice(0, 3).map(market => (
                          <Badge key={market} variant="secondary" className="text-xs">
                            {market}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Specialties */}
                  {match.agent?.specialties && match.agent.specialties.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-1 text-xs text-slate-600 mb-2">
                        <Briefcase className="w-3 h-3" />
                        <span>Specialties</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {match.agent.specialties.slice(0, 2).map(spec => (
                          <Badge key={spec} variant="secondary" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  {match.agent?.bio && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3">{match.agent.bio}</p>
                  )}
                </div>

                {/* Action */}
                <div className="border-t border-slate-200 p-4 bg-gradient-to-r from-blue-50 to-emerald-50">
                  <Button
                    onClick={() => handleEngage(match)}
                    className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white"
                  >
                    Engage Agent
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lock-in Info */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Exclusive Matching
          </h3>
          <p className="text-sm text-blue-800">
            Once you engage an agent for this market, you'll work exclusively with them for this deal. 
            This ensures focused attention and prevents conflicts of interest.
          </p>
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
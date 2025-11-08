import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star, Shield, Users, Loader2, Send, 
  MapPin, Briefcase, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import NDAModal from "@/components/NDAModal";

function MatchesContent() {
  const navigate = useNavigate();
  const { profile, hasNDA, loading: profileLoading, refresh } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [selectedState] = useState(() => sessionStorage.getItem('selectedState') || 'AZ');

  useEffect(() => {
    // Check NDA first
    if (!profileLoading) {
      if (!hasNDA) {
        setShowNDAModal(true);
        setLoading(false);
      } else {
        loadMatches();
      }
    }
  }, [profileLoading, hasNDA]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      
      // Use matchList function to get real matches
      const response = await base44.functions.invoke('matchList');
      const data = response.data;
      
      setMatches(data.results || []);
      setLoading(false);
    } catch (error) {
      console.error('Load matches error:', error);
      toast.error("Failed to load matches");
      setLoading(false);
    }
  };

  const handleEngage = async (match) => {
    try {
      // Create intro/room
      const response = await base44.functions.invoke('introCreate', {
        agentId: match.agentId,
        state: selectedState
      });

      if (response.data.roomId) {
        toast.success("Deal room created!");
        // Navigate to room
        navigate(createPageUrl(`Room/${response.data.roomId}`));
      } else {
        toast.success("Connection request sent!");
        loadMatches(); // Reload
      }
    } catch (error) {
      console.error('Engage error:', error);
      toast.error("Failed to engage. Please try again.");
    }
  };

  const handleNDAAccepted = () => {
    setShowNDAModal(false);
    refresh(); // Refresh profile
    loadMatches(); // Load matches
  };

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      {showNDAModal && <NDAModal open={showNDAModal} onAccepted={handleNDAAccepted} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Top Matches</h1>
          <p className="text-slate-600">
            Based on your criteria, here are the best-matched agents for {selectedState}
          </p>
        </div>

        {/* Matches Grid */}
        {matches.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.slice(0, 3).map((match) => (
              <div
                key={match.matchId || match.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all"
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
                      <h3 className="font-bold text-slate-900 mb-1">{match.agent?.name || 'Agent'}</h3>
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
                        Match: {match.score}%
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

                  {/* Match Reasons */}
                  {match.reasons && match.reasons.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-slate-600 mb-2">Why you matched:</div>
                      <div className="flex flex-wrap gap-1">
                        {match.reasons.slice(0, 2).map((reason, idx) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  {match.agent?.bio && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3">{match.agent.bio}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-200 p-4 bg-slate-50">
                  <Button
                    onClick={() => handleEngage(match)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Engage Agent
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">🔒 Exclusive Matching</h3>
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
    <AuthGuard 
      requireAuth={true}
      requireOnboarding={true}
      requireRole="investor"
      requireKYC={true}
    >
      <MatchesContent />
    </AuthGuard>
  );
}
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Star, Shield, Users, Loader2, Send, 
  Heart, X, CheckCircle
} from "lucide-react";
import { toast } from "sonner";

export default function Matches() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [vettedOnly, setVettedOnly] = useState(false);
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [allMarkets, setAllMarkets] = useState([]);
  const [connectDialog, setConnectDialog] = useState(null);
  const [connectMessage, setConnectMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadMatches();
  }, [vettedOnly]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (vettedOnly) params.append('vettedOnly', 'true');
      params.append('status', 'suggested,shortlisted');
      
      const response = await base44.functions.invoke('matchList', params);
      const data = response.data;
      
      setMatches(data.results || []);
      
      // Extract unique markets
      const markets = new Set();
      data.results?.forEach(m => {
        m.agent.markets?.forEach(market => markets.add(market));
      });
      setAllMarkets([...markets].sort());
      
      setLoading(false);
    } catch (error) {
      console.error('Load matches error:', error);
      toast.error("Failed to load matches");
      setLoading(false);
    }
  };

  const handleConnect = async (match) => {
    setConnectDialog(match);
    setConnectMessage(`Hi ${match.agent.name}, I'm interested in connecting to discuss investment opportunities in ${match.agent.markets?.slice(0, 2).join(' and ')}.`);
  };

  const sendIntroRequest = async () => {
    if (!connectDialog) return;
    
    setSending(true);
    try {
      await base44.functions.invoke('introCreate', {
        agentId: connectDialog.agent.userId,
        message: connectMessage
      });
      
      toast.success("Connection request sent!");
      setConnectDialog(null);
      setConnectMessage('');
      loadMatches(); // Reload to update status
    } catch (error) {
      console.error('Send intro error:', error);
      toast.error("Failed to send request");
    } finally {
      setSending(false);
    }
  };

  const handleShortlist = async (matchId) => {
    try {
      const match = matches.find(m => m.matchId === matchId);
      await base44.entities.Match.update(matchId, { 
        status: match.status === 'shortlisted' ? 'suggested' : 'shortlisted' 
      });
      loadMatches();
      toast.success(match.status === 'shortlisted' ? "Removed from shortlist" : "Added to shortlist");
    } catch (error) {
      console.error('Shortlist error:', error);
      toast.error("Failed to update");
    }
  };

  const handlePass = async (matchId) => {
    try {
      await base44.entities.Match.update(matchId, { status: 'passed' });
      setMatches(matches.filter(m => m.matchId !== matchId));
      toast.success("Passed on this match");
    } catch (error) {
      console.error('Pass error:', error);
      toast.error("Failed to update");
    }
  };

  const filteredMatches = matches.filter(match => {
    if (selectedMarkets.length === 0) return true;
    return match.agent.markets?.some(m => selectedMarkets.includes(m));
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Matches</h1>
          <p className="text-slate-600">Vetted agents matched to your target markets</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">Filters</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="vettedOnly"
                checked={vettedOnly}
                onCheckedChange={setVettedOnly}
              />
              <Label htmlFor="vettedOnly" className="cursor-pointer">
                Show only vetted agents
              </Label>
            </div>
            
            {allMarkets.length > 0 && (
              <div>
                <Label className="mb-2 block">Markets</Label>
                <div className="flex flex-wrap gap-2">
                  {allMarkets.map(market => (
                    <Badge
                      key={market}
                      variant={selectedMarkets.includes(market) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        if (selectedMarkets.includes(market)) {
                          setSelectedMarkets(selectedMarkets.filter(m => m !== market));
                        } else {
                          setSelectedMarkets([...selectedMarkets, market]);
                        }
                      }}
                    >
                      {market}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Matches Grid */}
        {filteredMatches.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No matches found</h3>
            <p className="text-slate-600 mb-6">Try adjusting your filters or markets</p>
            <Button onClick={() => navigate(createPageUrl("Dashboard"))}>
              Back to Dashboard
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((match) => (
              <div
                key={match.matchId}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Agent Card */}
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    {match.agent.headshotUrl ? (
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
                      <h3 className="font-bold text-slate-900 mb-1">{match.agent.name}</h3>
                      <p className="text-sm text-slate-600">{match.agent.company}</p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {match.agent.vetted && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <Shield className="w-3 h-3 mr-1" />
                        Vetted
                      </Badge>
                    )}
                    {match.agent.reputationScore >= 80 && (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                        <Star className="w-3 h-3 mr-1" />
                        {match.agent.reputationScore}
                      </Badge>
                    )}
                    <Badge variant="outline">
                      Score: {match.score}
                    </Badge>
                  </div>

                  {/* Markets */}
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {match.agent.markets?.slice(0, 3).map(market => (
                        <Badge key={market} variant="secondary" className="text-xs">
                          {market}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Match Reasons */}
                  <div className="mb-4">
                    <Label className="text-xs text-slate-600 mb-2 block">Why you matched:</Label>
                    <div className="flex flex-wrap gap-1">
                      {match.reasons?.slice(0, 3).map((reason, idx) => (
                        <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bio */}
                  {match.agent.bio && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3">{match.agent.bio}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-200 p-4 bg-slate-50 flex gap-2">
                  <Button
                    onClick={() => handleConnect(match)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Connect
                  </Button>
                  <Button
                    onClick={() => handleShortlist(match.matchId)}
                    variant={match.status === 'shortlisted' ? "default" : "outline"}
                    size="sm"
                  >
                    <Heart className={`w-4 h-4 ${match.status === 'shortlisted' ? 'fill-current' : ''}`} />
                  </Button>
                  <Button
                    onClick={() => handlePass(match.matchId)}
                    variant="outline"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connect Dialog */}
        <Dialog open={!!connectDialog} onOpenChange={() => setConnectDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Connection Request</DialogTitle>
              <DialogDescription>
                Send a message to {connectDialog?.agent.name} to start the conversation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={connectMessage}
                onChange={(e) => setConnectMessage(e.target.value)}
                rows={4}
                placeholder="Introduce yourself and explain why you'd like to connect..."
              />
              <div className="flex gap-3">
                <Button
                  onClick={sendIntroRequest}
                  disabled={sending || !connectMessage}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Request
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setConnectDialog(null)}
                  variant="outline"
                  disabled={sending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
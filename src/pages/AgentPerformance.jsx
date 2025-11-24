import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, TrendingDown, Target, Clock, Lightbulb, 
  BarChart3, Users, MessageSquare, CheckCircle, Loader2 
} from "lucide-react";

/**
 * AGENT PERFORMANCE DASHBOARD
 * Displays conversion funnel metrics and AI-driven improvement suggestions
 */
function AgentPerformanceContent() {
  const { role } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await base44.functions.invoke('getAgentPerformanceMetrics');
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'agent') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">This dashboard is only available for agents.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  const metricCards = [
    {
      label: 'Match-to-Intro Rate',
      value: metrics?.metrics.matchToIntroRate,
      target: 30,
      icon: Users,
      color: 'blue'
    },
    {
      label: 'Intro-to-Room Rate',
      value: metrics?.metrics.introToRoomRate,
      target: 60,
      icon: MessageSquare,
      color: 'emerald'
    },
    {
      label: 'Room-to-Close Rate',
      value: metrics?.metrics.roomToCloseRate,
      target: 40,
      icon: CheckCircle,
      color: 'purple'
    },
    {
      label: 'Avg Time to Close',
      value: metrics?.metrics.avgTimeToClose,
      suffix: 'days',
      icon: Clock,
      color: 'orange'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Performance Dashboard</h1>
          <p className="text-slate-600">Track your conversion funnel and get AI-driven improvement tips</p>
        </div>

        {/* Metric Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metricCards.map((card) => {
            const Icon = card.icon;
            const isAboveTarget = card.target && card.value >= card.target;
            
            return (
              <Card key={card.label} className="p-6 border-2 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-${card.color}-100 rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${card.color}-600`} />
                  </div>
                  {card.target && (
                    isAboveTarget ? (
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )
                  )}
                </div>
                <p className="text-2xl font-bold text-slate-900 mb-1">
                  {card.value}{card.suffix || '%'}
                </p>
                <p className="text-sm text-slate-600 mb-2">{card.label}</p>
                {card.target && (
                  <div className="flex items-center gap-2 text-xs">
                    <Target className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-500">Target: {card.target}%</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Funnel Overview */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Conversion Funnel
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {metrics?.metrics.totalMatches}
              </div>
              <p className="text-sm text-slate-600">Total Matches</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600 mb-2">
                {metrics?.metrics.acceptedIntros}
              </div>
              <p className="text-sm text-slate-600">Accepted Intros</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {metrics?.metrics.activeRooms}
              </div>
              <p className="text-sm text-slate-600">Active Rooms</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {metrics?.metrics.closedDeals}
              </div>
              <p className="text-sm text-slate-600">Closed Deals</p>
            </div>
          </div>
        </Card>

        {/* AI Insight */}
        {metrics?.insight && (
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-bold text-slate-900">AI-Powered Suggestion</h3>
                  <Badge variant="outline" className="bg-white">
                    Focus Area: {metrics.insight.weakestMetric}
                  </Badge>
                </div>
                <p className="text-slate-700 mb-4">{metrics.insight.suggestion}</p>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Current: </span>
                    <span className="font-semibold text-slate-900">
                      {metrics.insight.currentValue}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Target: </span>
                    <span className="font-semibold text-emerald-600">
                      {metrics.insight.targetValue}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}

export default function AgentPerformance() {
  return (
    <AuthGuard requireAuth={true}>
      <AgentPerformanceContent />
    </AuthGuard>
  );
}
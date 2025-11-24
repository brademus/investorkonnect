import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, DollarSign, PieChart, Calendar, 
  Building2, MapPin, Loader2, Target
} from "lucide-react";

/**
 * INVESTOR PORTFOLIO TRACKER
 * Displays aggregated portfolio metrics and deal performance
 */
function InvestorPortfolioContent() {
  const { role } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    try {
      const response = await base44.functions.invoke('getInvestorPortfolioData');
      setPortfolio(response.data);
    } catch (error) {
      console.error('Failed to load portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'investor') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">This dashboard is only available for investors.</p>
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

  const summaryCards = [
    {
      label: 'Portfolio Value',
      value: `$${(portfolio?.summary.portfolioValue / 1000).toFixed(0)}K`,
      icon: DollarSign,
      color: 'emerald'
    },
    {
      label: 'Total Return',
      value: `${portfolio?.summary.returnPercent}%`,
      icon: TrendingUp,
      color: 'blue'
    },
    {
      label: 'IRR',
      value: `${portfolio?.performance.irr}%`,
      icon: Target,
      color: 'purple'
    },
    {
      label: 'Cash-on-Cash',
      value: `${portfolio?.performance.cashOnCashReturn}%`,
      icon: DollarSign,
      color: 'orange'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Investment Portfolio</h1>
          <p className="text-slate-600">Track your real estate investments and performance metrics</p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            
            return (
              <Card key={card.label} className="p-6 border-2 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-${card.color}-100 rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${card.color}-600`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mb-1">
                  {card.value}
                </p>
                <p className="text-sm text-slate-600">{card.label}</p>
              </Card>
            );
          })}
        </div>

        {/* Portfolio Overview */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              By Property Type
            </h2>
            <div className="space-y-3">
              {Object.entries(portfolio?.diversification.byPropertyType || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-slate-700">{type}</span>
                  <Badge variant="secondary">{count} {count === 1 ? 'deal' : 'deals'}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              By Market
            </h2>
            <div className="space-y-3">
              {Object.entries(portfolio?.diversification.byMarket || {}).map(([market, count]) => (
                <div key={market} className="flex items-center justify-between">
                  <span className="text-slate-700">{market}</span>
                  <Badge variant="secondary">{count} {count === 1 ? 'deal' : 'deals'}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Deal History */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Closed Deals</h2>
          <div className="space-y-4">
            {portfolio?.deals.slice(0, 5).map((deal) => (
              <div key={deal.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-1">{deal.title}</h3>
                  <p className="text-sm text-slate-600 mb-2">{deal.address}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{deal.propertyType}</span>
                    <span>•</span>
                    <span>${(deal.investment / 1000).toFixed(0)}K invested</span>
                    <span>•</span>
                    <span>{new Date(deal.closedDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800">Closed</Badge>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}

export default function InvestorPortfolio() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorPortfolioContent />
    </AuthGuard>
  );
}
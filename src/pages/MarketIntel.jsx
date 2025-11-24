import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, RefreshCw, TrendingUp, MapPin, 
  Calendar, Loader2, CheckCircle 
} from "lucide-react";
import ReactMarkdown from "react-markdown";

/**
 * PERSONALIZED MARKET INTELLIGENCE FEED
 * Real-time market data tailored to user preferences
 */
function MarketIntelContent() {
  const { profile } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [intel, setIntel] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadIntel();
  }, []);

  const loadIntel = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getPersonalizedMarketIntel');
      setIntel(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load market intel:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !intel) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Analyzing markets and gathering latest intel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-blue-600" />
                Market Intelligence
              </h1>
              <p className="text-slate-600">Personalized insights for your target markets</p>
            </div>
            <Button
              onClick={loadIntel}
              disabled={loading}
              variant="outline"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Your Preferences */}
        <Card className="p-6 mb-6 bg-gradient-to-br from-blue-50 to-slate-50">
          <h2 className="font-semibold text-slate-900 mb-3">Personalized For:</h2>
          <div className="flex flex-wrap gap-2">
            {intel?.generatedFor.markets?.map((market) => (
              <Badge key={market} className="bg-blue-100 text-blue-800">
                <MapPin className="w-3 h-3 mr-1" />
                {market}
              </Badge>
            ))}
            {intel?.generatedFor.strategies?.map((strategy) => (
              <Badge key={strategy} className="bg-emerald-100 text-emerald-800">
                <TrendingUp className="w-3 h-3 mr-1" />
                {strategy}
              </Badge>
            ))}
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleString()}
            </p>
          )}
        </Card>

        {/* Market Brief */}
        <Card className="p-8">
          <div className="prose prose-slate max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-900 mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold text-slate-900 mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-900 mt-4 mb-2">{children}</h3>,
                ul: ({ children }) => <ul className="space-y-2 mb-4">{children}</ul>,
                li: ({ children }) => (
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                    <span>{children}</span>
                  </li>
                ),
                p: ({ children }) => <p className="text-slate-700 mb-4 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="text-slate-900 font-semibold">{children}</strong>
              }}
            >
              {intel?.brief}
            </ReactMarkdown>
          </div>
        </Card>

      </div>
    </div>
  );
}

export default function MarketIntel() {
  return (
    <AuthGuard requireAuth={true}>
      <MarketIntelContent />
    </AuthGuard>
  );
}
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, MapPin, Briefcase, DollarSign, Target, Building2, User, TrendingUp, Handshake, MessageSquare, Shield, Layers, Home, Banknote, Star } from "lucide-react";
import InvestorBusinessCard from "@/components/InvestorBusinessCard";
import AgentRatingStars from "@/components/AgentRatingStars";

// Label maps for onboarding values
const INVESTOR_DESCRIPTION_LABELS = {
  new: "New / Just Getting Started",
  few_deals: "Have Done a Few Deals",
  full_time: "Full-time / Professional Investor",
  family_office: "Family Office / Fund"
};

const DEAL_SIZE_LABELS = {
  under_150k: "Under $150k",
  "150k_300k": "$150k–$300k",
  "300k_600k": "$300k–$600k",
  "600k_1m": "$600k–$1M",
  over_1m: "$1M+"
};

const CAPITAL_LABELS = {
  under_50k: "Less than $50k",
  "50k_150k": "$50k–$150k",
  "150k_300k": "$150k–$300k",
  "300k_600k": "$300k–$600k",
  "600k_1m": "$600k–$1M",
  over_1m: "$1M+"
};

const HOLD_PERIOD_LABELS = {
  under_1y: "Less than 1 year",
  "1_3y": "1–3 years",
  "3_7y": "3–7 years",
  over_7y: "7+ years",
  depends: "Depends on deal"
};

const PRIORITY_LABELS = {
  cash_on_cash: "Highest Cash-on-Cash Return",
  appreciation: "Long-term Appreciation",
  fast_flips: "Fast Flips / Short Timelines",
  capital_preservation: "Capital Preservation / Low Risk"
};

const COMMUNICATION_LABELS = {
  text: "Text First",
  email: "Email First",
  phone: "Phone Calls OK",
  weekly_recap: "Weekly Recap Preferred"
};

const EXCLUSIVITY_LABELS = {
  one_per_market: "1 Primary Agent Per Market",
  multiple: "Open to Multiple Agents"
};

const FINANCING_LINED_UP_LABELS = {
  yes: "Yes",
  in_process: "In Process",
  not_yet: "Not Yet"
};

const ACCREDITED_LABELS = {
  yes: "Yes",
  no: "No",
  not_sure: "Not Sure"
};

function InfoSection({ icon: Icon, title, children }) {
  if (!children) return null;
  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-[#E3C567]" />
        <h3 className="text-lg font-bold text-[#FAFAFA]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex items-start justify-between py-2 border-b border-[#1F1F1F] last:border-0">
      <span className="text-sm text-[#808080]">{label}</span>
      <span className="text-sm text-[#FAFAFA] text-right max-w-[60%]">
        {Array.isArray(value) ? value.join(", ") : value}
      </span>
    </div>
  );
}

function TagList({ items, labelMap }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <Badge key={item} className="bg-[#E3C567]/15 text-[#E3C567] border border-[#E3C567]/30 hover:bg-[#E3C567]/20">
          {labelMap?.[item] || item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Badge>
      ))}
    </div>
  );
}

export default function InvestorProfile() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const profileId = params.get("profileId");
  const { profile: currentProfile } = useCurrentProfile();

  const [investorProfile, setInvestorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ikDealsCount, setIkDealsCount] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    const load = async () => {
      try {
        const profiles = await base44.entities.Profile.filter({ id: profileId });
        setInvestorProfile(profiles?.[0] || null);
        try {
          const [deals, revs] = await Promise.all([
            base44.entities.Deal.filter({ investor_id: profileId }),
            base44.entities.Review.filter({ reviewee_profile_id: profileId })
          ]);
          setIkDealsCount(deals?.length || 0);
          setReviews(revs || []);
        } catch (e) {
          console.log('[InvestorProfile] Could not load deals/reviews:', e);
          setIkDealsCount(0);
        }
      } catch (err) {
        console.error("[InvestorProfile] Load failed:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  if (!investorProfile) {
    return (
      <div className="min-h-screen bg-transparent py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-6 bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border-[#E3C567]/40 hover:border-[#E3C567] rounded-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
            <p className="text-[#808080]">Investor profile not found</p>
          </div>
        </div>
      </div>
    );
  }

  const inv = investorProfile.investor || {};
  const meta = investorProfile.metadata || {};
  const basicProfile = meta.basicProfile || {};
  const onboarding = investorProfile.onboarding || {};
  // Merge all onboarding data sources
  const ob = { ...meta, ...onboarding, ...basicProfile };

  const markets = investorProfile.markets || [];
  const targetState = investorProfile.target_state;

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => navigate(-1)} className="mb-6 bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border-[#E3C567]/40 hover:border-[#E3C567] rounded-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        {/* Digital Business Card */}
        <div className="mb-6">
          <InvestorBusinessCard investorProfile={investorProfile} ikDealsCount={ikDealsCount} />
        </div>

        {/* Uploaded Business Card */}
        {investorProfile.businessCardUrl && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[#FAFAFA] mb-3">Uploaded Business Card</h3>
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl overflow-hidden">
              <img
                src={investorProfile.businessCardUrl}
                alt={`${investorProfile.full_name}'s business card`}
                className="w-full object-contain max-h-[400px]"
              />
            </div>
          </div>
        )}





        {/* Deal Structure */}
        {(ob.deal_types_open_to?.length > 0 || ob.preferred_deal_structure?.length > 0) && (
          <InfoSection icon={Layers} title="Deal Structure Preferences">
            {ob.deal_types_open_to?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-[#808080] mb-2">Deal Types Open To</p>
                <TagList items={ob.deal_types_open_to} />
              </div>
            )}
            {ob.preferred_deal_structure?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-[#808080] mb-2">Preferred Structures</p>
                <TagList items={ob.preferred_deal_structure} />
              </div>
            )}
          </InfoSection>
        )}

        {/* Financial Criteria */}
        {(ob.price_per_deal_min || ob.price_per_deal_max || ob.total_capital_to_deploy || ob.preferred_financing?.length > 0 || ob.capital_available_12mo || ob.financing_methods?.length > 0) && (
          <InfoSection icon={DollarSign} title="Financial Criteria">
            {(ob.price_per_deal_min || ob.price_per_deal_max) && (
              <InfoRow
                label="Price Range Per Deal"
                value={`${ob.price_per_deal_min ? '$' + Number(ob.price_per_deal_min).toLocaleString() : '—'} – ${ob.price_per_deal_max ? '$' + Number(ob.price_per_deal_max).toLocaleString() : '—'}`}
              />
            )}
            <InfoRow label="Total Capital to Deploy" value={ob.total_capital_to_deploy ? `$${Number(ob.total_capital_to_deploy).toLocaleString()}` : null} />
            <InfoRow label="Capital Available (12 mo)" value={CAPITAL_LABELS[ob.capital_available_12mo]} />
            {ob.min_cap_rate && <InfoRow label="Min Cap Rate" value={`${ob.min_cap_rate}%`} />}
            {ob.target_cash_on_cash && <InfoRow label="Target Cash-on-Cash" value={`${ob.target_cash_on_cash}%`} />}
            {(ob.min_deal_size_units || ob.max_deal_size_units) && (
              <InfoRow label="Unit Range (MF)" value={`${ob.min_deal_size_units || '—'} – ${ob.max_deal_size_units || '—'} units`} />
            )}
            {ob.preferred_financing?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[#808080] mb-2">Preferred Financing</p>
                <TagList items={ob.preferred_financing} />
              </div>
            )}
            {ob.financing_methods?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[#808080] mb-2">Financing Methods</p>
                <TagList items={ob.financing_methods} />
              </div>
            )}
            <InfoRow label="Financing Lined Up" value={FINANCING_LINED_UP_LABELS[ob.financing_lined_up]} />
          </InfoSection>
        )}

        {/* Agent Preferences */}
        {(ob.communication_style || ob.lead_types_desired?.length > 0 || ob.service_expectations?.length > 0 || ob.exclusivity_preference) && (
          <InfoSection icon={Handshake} title="Agent Relationship Preferences">
            <InfoRow label="Communication Style" value={COMMUNICATION_LABELS[ob.communication_style]} />
            <InfoRow label="Exclusivity" value={EXCLUSIVITY_LABELS[ob.exclusivity_preference]} />
            {ob.lead_types_desired?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[#808080] mb-2">Lead Types Desired</p>
                <TagList items={ob.lead_types_desired} />
              </div>
            )}
            {ob.service_expectations?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[#808080] mb-2">Service Expectations</p>
                <TagList items={ob.service_expectations} />
              </div>
            )}
          </InfoSection>
        )}

        {/* Reviews */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-[#E3C567]" />
            <h3 className="text-lg font-bold text-[#FAFAFA]">Reviews</h3>
          </div>
          {reviews.length === 0 ? (
            <p className="text-sm text-[#808080] text-center py-4">No reviews yet</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <AgentRatingStars
                  rating={reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length}
                  reviewCount={reviews.length}
                  size="md"
                />
              </div>
              {reviews.map((r) => (
                <div key={r.id} className="border-t border-[#1F1F1F] pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#FAFAFA]">{r.reviewer_name || "Anonymous"}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= (r.rating || 0) ? "text-[#E3C567] fill-[#E3C567]" : "text-[#333]"}`} />
                      ))}
                    </div>
                  </div>
                  {r.body && <p className="text-sm text-[#808080] leading-relaxed">{r.body}</p>}
                  {r.created_date && (
                    <p className="text-xs text-[#666] mt-1">{new Date(r.created_date).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Holding & Additional Info */}
        {(ob.investment_holding_structures?.length > 0 || ob.background_links || ob.anything_else_for_agent) && (
          <InfoSection icon={Shield} title="Additional Details">
            {ob.investment_holding_structures?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-[#808080] mb-2">Holding Structures</p>
                <TagList items={ob.investment_holding_structures} />
              </div>
            )}
            {ob.background_links && (
              <div className="py-2 border-b border-[#1F1F1F]">
                <p className="text-sm text-[#808080] mb-1">Background Links</p>
                <div className="space-y-1">
                  {ob.background_links.split('\n').filter(Boolean).map((link, i) => (
                    <a key={i} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#E3C567] hover:underline block truncate">
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {ob.anything_else_for_agent && (
              <div className="py-2">
                <p className="text-sm text-[#808080] mb-1">Additional Notes for Agent</p>
                <p className="text-sm text-[#FAFAFA]/80 whitespace-pre-wrap">{ob.anything_else_for_agent}</p>
              </div>
            )}
          </InfoSection>
        )}
      </div>
    </div>
  );
}
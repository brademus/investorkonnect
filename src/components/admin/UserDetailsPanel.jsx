import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Mail, Phone, MapPin, Building2, Calendar, Shield, FileText, CreditCard, ExternalLink, Briefcase, Award, Target, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import moment from "moment";

const Section = ({ title, children }) => (
  <div className="mb-5">
    <h3 className="text-xs font-semibold text-[#E3C567] uppercase tracking-wider mb-2.5">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const Row = ({ icon: Icon, label, value }) => {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      {Icon && <Icon className="w-3.5 h-3.5 text-[#808080] mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="text-[#808080]">{label}: </span>
        <span className="text-[#FAFAFA] break-words">{Array.isArray(value) ? value.join(", ") : value}</span>
      </div>
    </div>
  );
};

const Bool = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-[#808080]">{label}</span>
    <Badge className={value ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30" : "bg-[rgba(255,255,255,0.04)] text-[#808080] border border-[rgba(255,255,255,0.06)]"}>
      {value ? "Yes" : "No"}
    </Badge>
  </div>
);

export default function UserDetailsPanel({ profile, onClose }) {
  if (!profile) return null;
  const role = profile.user_role || profile.user_type;
  const agent = profile.agent || {};
  const investor = profile.investor || {};
  const buyBox = investor.buy_box || {};

  const publicProfileUrl = role === "agent"
    ? `${createPageUrl("AgentProfile")}?profileId=${profile.id}`
    : role === "investor"
      ? `${createPageUrl("InvestorProfile")}?profileId=${profile.id}`
      : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full overflow-y-auto shadow-2xl animate-slide-in"
        style={{ background: 'linear-gradient(180deg, #111114 0%, #0D0D0D 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 p-5 flex items-start justify-between gap-3" style={{ background: '#111114', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[#FAFAFA]">{profile.full_name || "No name"}</h2>
              {profile.role === "admin" && <Badge className="bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30 text-[10px]">Admin</Badge>}
              {profile.qualification_tier === "elite" && <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">Elite</Badge>}
              {profile.qualification_tier === "conditional" && <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">Conditional</Badge>}
            </div>
            <p className="text-sm text-[#808080] mt-1 truncate">{profile.email}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge className="capitalize bg-[rgba(255,255,255,0.06)] text-[#FAFAFA] border border-[rgba(255,255,255,0.08)]">{role || "member"}</Badge>
              <Badge className="capitalize bg-[rgba(255,255,255,0.04)] text-[#808080] border border-[rgba(255,255,255,0.06)]">{profile.subscription_tier || "no plan"}</Badge>
            </div>
            {publicProfileUrl && (
              <Link to={publicProfileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#E3C567] hover:underline mt-2">
                <ExternalLink className="w-3 h-3" /> View public profile
              </Link>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-[#808080] hover:text-[#FAFAFA] hover:bg-transparent shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5">
          {/* Contact */}
          <Section title="Contact">
            <Row icon={Mail} label="Email" value={profile.email} />
            <Row icon={Phone} label="Phone" value={profile.phone} />
            <Row icon={MapPin} label="Location" value={profile.location} />
            <Row icon={Building2} label="Company" value={profile.company || investor.company_name || agent.brokerage} />
            <Row icon={Calendar} label="Joined" value={profile.created_date ? moment(profile.created_date).format("MMM D, YYYY") : null} />
          </Section>

          {/* Identity & Compliance */}
          <Section title="Identity & Compliance">
            <Bool label="Onboarding Complete" value={!!profile.onboarding_completed_at} />
            <Bool label="Identity Verified" value={profile.kyc_status === "approved" || profile.identity_status === "verified" || !!profile.identity_verified_at} />
            <Bool label="NDA Signed" value={!!profile.nda_accepted} />
            <Row icon={Shield} label="ID Verified On" value={profile.identity_verified_at ? moment(profile.identity_verified_at).format("MMM D, YYYY") : null} />
            <Row icon={FileText} label="NDA Signed On" value={profile.nda_accepted_at ? moment(profile.nda_accepted_at).format("MMM D, YYYY") : null} />
            <Row label="Verified Name" value={[profile.verified_first_name, profile.verified_last_name].filter(Boolean).join(" ")} />
          </Section>

          {/* Subscription */}
          <Section title="Subscription">
            <Row icon={CreditCard} label="Tier" value={profile.subscription_tier || "none"} />
            <Row label="Status" value={profile.subscription_status || "none"} />
            <Row label="Stripe Customer" value={profile.stripe_customer_id} />
          </Section>

          {/* Agent-specific */}
          {role === "agent" && (
            <>
              <Section title="License & Brokerage">
                <Row icon={Briefcase} label="Brokerage" value={agent.brokerage || profile.broker} />
                <Row label="License #" value={agent.license_number || profile.license_number} />
                <Row label="License State" value={agent.license_state || profile.license_state} />
                <Row label="Licensed States" value={agent.licensed_states || profile.markets} />
                <Row icon={MapPin} label="Main County" value={agent.main_county} />
                <Row label="Verification" value={agent.verification_status} />
              </Section>

              <Section title="Experience">
                <Row icon={Award} label="Years Experience" value={agent.experience_years} />
                <Row label="Investor Experience (yrs)" value={agent.investor_experience_years} />
                <Row label="Deals Last 12mo" value={agent.investment_deals_last_12m} />
                <Row label="Active Clients" value={agent.active_client_count} />
                <Row label="Investor Clients" value={agent.investor_clients_count} />
              </Section>

              <Section title="Specialties">
                <Row label="Investment Strategies" value={agent.investment_strategies} />
                <Row label="Property Types" value={agent.specialties} />
                <Row label="Markets" value={agent.markets} />
                <Row label="Languages" value={agent.languages_spoken} />
              </Section>

              {agent.bio && (
                <Section title="Bio">
                  <p className="text-sm text-[#FAFAFA]/80 leading-relaxed whitespace-pre-wrap">{agent.bio}</p>
                </Section>
              )}
            </>
          )}

          {/* Investor-specific */}
          {role === "investor" && (
            <>
              <Section title="Investor Profile">
                <Row icon={Building2} label="Company" value={investor.company_name} />
                <Row label="Website" value={investor.website} />
                <Row label="Accreditation" value={profile.accreditation} />
                <Row label="Markets" value={profile.markets} />
                <Row icon={Target} label="Target State" value={profile.target_state} />
                <Row label="Boost Credits" value={investor.boost_credits} />
              </Section>

              {Object.keys(buyBox).length > 0 && (
                <Section title="Buy Box">
                  {Object.entries(buyBox).map(([k, v]) => (
                    <Row key={k} icon={DollarSign} label={k.replace(/_/g, " ")} value={typeof v === "object" ? JSON.stringify(v) : String(v)} />
                  ))}
                </Section>
              )}

              {investor.bio && (
                <Section title="Bio">
                  <p className="text-sm text-[#FAFAFA]/80 leading-relaxed whitespace-pre-wrap">{investor.bio}</p>
                </Section>
              )}

              {profile.goals && (
                <Section title="Goals">
                  <p className="text-sm text-[#FAFAFA]/80 leading-relaxed whitespace-pre-wrap">{profile.goals}</p>
                </Section>
              )}
            </>
          )}

          {/* IDs */}
          <Section title="System">
            <Row label="Profile ID" value={profile.id} />
            <Row label="User ID" value={profile.user_id} />
            <Row label="Onboarding Version" value={profile.onboarding_version} />
          </Section>
        </div>
      </div>
    </div>
  );
}
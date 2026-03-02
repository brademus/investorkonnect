import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, ExternalLink, Trash2 } from "lucide-react";
import moment from "moment";

const STATUS_COLORS = {
  draft: "bg-[rgba(255,255,255,0.04)] text-[#808080] border border-[rgba(255,255,255,0.06)]",
  sent: "bg-[#60A5FA]/15 text-[#60A5FA] border border-[#60A5FA]/30",
  investor_signed: "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30",
  agent_signed: "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30",
  fully_signed: "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30",
  voided: "bg-red-500/15 text-red-400 border border-red-500/30",
  superseded: "bg-[rgba(255,255,255,0.04)] text-[#808080]/60 border border-[rgba(255,255,255,0.04)]",
};

export default function AdminAgreementsTab({ agreements, profiles, onReload }) {
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");

  const getName = (id) => {
    const p = profiles.find(p => p.id === id);
    return p?.full_name || p?.email || id || "—";
  };

  const filtered = statusFilter === "all" ? agreements : agreements.filter(a => a.status === statusFilter);

  const changeStatus = async (ag, newStatus) => {
    setUpdating(prev => ({ ...prev, [`${ag.id}_status`]: true }));
    try {
      await base44.entities.LegalAgreement.update(ag.id, { status: newStatus });
      toast.success("Agreement status updated");
      onReload();
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${ag.id}_status`]: false }));
    }
  };

  const voidAgreement = async (ag) => {
    if (!confirm("Void this agreement? This marks it as voided.")) return;
    await changeStatus(ag, "voided");
  };

  const deleteAgreement = async (ag) => {
    if (!confirm("⚠️ Permanently delete this agreement record?")) return;
    setUpdating(prev => ({ ...prev, [`${ag.id}_delete`]: true }));
    try {
      await base44.entities.LegalAgreement.delete(ag.id);
      toast.success("Agreement deleted");
      onReload();
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${ag.id}_delete`]: false }));
    }
  };

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="investor_signed">Investor Signed</SelectItem>
            <SelectItem value="fully_signed">Fully Signed</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-[#808080] mb-3">{filtered.length} agreements</p>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-[#808080] text-center py-8">No agreements found</p>}
        {filtered.map(ag => (
          <div key={ag.id} className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div
              className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              onClick={() => setExpanded(expanded === ag.id ? null : ag.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#FAFAFA]">
                  {getName(ag.investor_profile_id)} ↔ {getName(ag.agent_profile_id)}
                </div>
                <div className="text-xs text-[#808080]">
                  {ag.governing_state} • {ag.transaction_type || "—"} • {moment(ag.created_date).fromNow()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] rounded-full ${STATUS_COLORS[ag.status] || "bg-[rgba(255,255,255,0.04)] text-[#808080]"}`}>
                  {(ag.status || "").replace(/_/g, " ")}
                </Badge>
                {expanded === ag.id ? <ChevronUp className="w-4 h-4 text-[#808080]" /> : <ChevronDown className="w-4 h-4 text-[#808080]" />}
              </div>
            </div>
            {expanded === ag.id && (
              <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
                  <div><span className="text-[#808080]">Investor Signed:</span> <span className="text-[#FAFAFA]">{ag.investor_signed_at ? moment(ag.investor_signed_at).format("MMM D, h:mm A") : "No"}</span></div>
                  <div><span className="text-[#808080]">Agent Signed:</span> <span className="text-[#FAFAFA]">{ag.agent_signed_at ? moment(ag.agent_signed_at).format("MMM D, h:mm A") : "No"}</span></div>
                  <div><span className="text-[#808080]">DocuSign:</span> <span className="text-[#FAFAFA]">{ag.docusign_envelope_id ? "Yes" : "No"}</span></div>
                  {ag.signed_pdf_url && (
                    <div>
                      <a href={ag.signed_pdf_url} target="_blank" rel="noreferrer" className="text-[#60A5FA] hover:text-[#93C5FD] flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> View Signed PDF
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select onValueChange={val => changeStatus(ag, val)} defaultValue={ag.status}>
                    <SelectTrigger className="w-[170px] h-8 text-xs bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="investor_signed">Investor Signed</SelectItem>
                      <SelectItem value="agent_signed">Agent Signed</SelectItem>
                      <SelectItem value="fully_signed">Fully Signed</SelectItem>
                      <SelectItem value="voided">Voided</SelectItem>
                      <SelectItem value="superseded">Superseded</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="bg-transparent text-red-400 border border-red-500/30 hover:bg-red-500/15 rounded-lg" onClick={() => voidAgreement(ag)}>
                    Void
                  </Button>
                  <Button size="sm" className="bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 rounded-lg" onClick={() => deleteAgreement(ag)} disabled={updating[`${ag.id}_delete`]}>
                    {updating[`${ag.id}_delete`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                    Delete
                  </Button>
                </div>
                <div className="mt-2 text-[10px] text-[#808080]/50">Agreement ID: {ag.id} • Deal: {ag.deal_id}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
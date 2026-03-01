import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, ExternalLink, Trash2 } from "lucide-react";
import moment from "moment";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  investor_signed: "bg-amber-100 text-amber-700",
  agent_signed: "bg-amber-100 text-amber-700",
  fully_signed: "bg-emerald-100 text-emerald-700",
  voided: "bg-red-100 text-red-700",
  superseded: "bg-slate-100 text-slate-500",
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
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="investor_signed">Investor Signed</SelectItem>
            <SelectItem value="fully_signed">Fully Signed</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-slate-500 mb-3">{filtered.length} agreements</p>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No agreements found</p>}
        {filtered.map(ag => (
          <div key={ag.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
              onClick={() => setExpanded(expanded === ag.id ? null : ag.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">
                  {getName(ag.investor_profile_id)} ↔ {getName(ag.agent_profile_id)}
                </div>
                <div className="text-xs text-slate-500">
                  {ag.governing_state} • {ag.transaction_type || "—"} • {moment(ag.created_date).fromNow()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] ${STATUS_COLORS[ag.status] || "bg-slate-100"}`}>
                  {(ag.status || "").replace(/_/g, " ")}
                </Badge>
                {expanded === ag.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
            {expanded === ag.id && (
              <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
                  <div><span className="text-slate-500">Investor Signed:</span> {ag.investor_signed_at ? moment(ag.investor_signed_at).format("MMM D, h:mm A") : "No"}</div>
                  <div><span className="text-slate-500">Agent Signed:</span> {ag.agent_signed_at ? moment(ag.agent_signed_at).format("MMM D, h:mm A") : "No"}</div>
                  <div><span className="text-slate-500">DocuSign:</span> {ag.docusign_envelope_id ? "Yes" : "No"}</div>
                  {ag.signed_pdf_url && (
                    <div>
                      <a href={ag.signed_pdf_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> View Signed PDF
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select onValueChange={val => changeStatus(ag, val)} defaultValue={ag.status}>
                    <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="investor_signed">Investor Signed</SelectItem>
                      <SelectItem value="agent_signed">Agent Signed</SelectItem>
                      <SelectItem value="fully_signed">Fully Signed</SelectItem>
                      <SelectItem value="voided">Voided</SelectItem>
                      <SelectItem value="superseded">Superseded</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => voidAgreement(ag)}>
                    Void
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteAgreement(ag)} disabled={updating[`${ag.id}_delete`]}>
                    {updating[`${ag.id}_delete`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                    Delete
                  </Button>
                </div>
                <div className="mt-2 text-[10px] text-slate-400">Agreement ID: {ag.id} • Deal: {ag.deal_id}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
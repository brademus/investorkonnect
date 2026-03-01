import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronUp, Loader2, Trash2, Eye } from "lucide-react";
import { PIPELINE_STAGES } from "@/components/pipelineStages";

const STAGE_COLORS = {
  new_deals: "bg-blue-100 text-blue-700",
  connected_deals: "bg-purple-100 text-purple-700",
  in_closing: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  canceled: "bg-red-100 text-red-700",
};

export default function AdminDealsTab({ deals, profiles, rooms, onReload }) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState({});

  const getProfileName = (id) => {
    const p = profiles.find(p => p.id === id);
    return p?.full_name || p?.email || id || "Unknown";
  };

  const filtered = deals.filter(d => {
    const matchSearch = !search ||
      (d.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.property_address || "").toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "all" || d.pipeline_stage === stageFilter;
    return matchSearch && matchStage;
  });

  const changeStage = async (deal, newStage) => {
    setUpdating(prev => ({ ...prev, [`${deal.id}_stage`]: true }));
    try {
      await base44.entities.Deal.update(deal.id, { pipeline_stage: newStage });
      toast.success(`Deal moved to ${newStage}`);
      onReload();
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${deal.id}_stage`]: false }));
    }
  };

  const changeStatus = async (deal, newStatus) => {
    setUpdating(prev => ({ ...prev, [`${deal.id}_status`]: true }));
    try {
      await base44.entities.Deal.update(deal.id, { status: newStatus });
      toast.success(`Deal status changed to ${newStatus}`);
      onReload();
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${deal.id}_status`]: false }));
    }
  };

  const deleteDeal = async (deal) => {
    if (!confirm(`Delete deal "${deal.title || deal.property_address}"? This cannot be undone.`)) return;
    setUpdating(prev => ({ ...prev, [`${deal.id}_delete`]: true }));
    try {
      await base44.entities.Deal.delete(deal.id);
      toast.success("Deal deleted");
      onReload();
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${deal.id}_delete`]: false }));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {PIPELINE_STAGES.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-slate-500 mb-3">{filtered.length} deals</p>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No deals found</p>}
        {filtered.map(deal => {
          const room = rooms.find(r => r.deal_id === deal.id);
          return (
            <div key={deal.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpanded(expanded === deal.id ? null : deal.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">{deal.title || deal.property_address || "Untitled Deal"}</div>
                  <div className="text-xs text-slate-500">
                    {deal.city && `${deal.city}, `}{deal.state} • Investor: {getProfileName(deal.investor_id)}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Badge className={`text-[10px] ${STAGE_COLORS[deal.pipeline_stage] || "bg-slate-100 text-slate-600"}`}>
                    {deal.pipeline_stage || "—"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{deal.status || "—"}</Badge>
                  {expanded === deal.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
              {expanded === deal.id && (
                <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
                    <div><span className="text-slate-500">Price:</span> <span className="font-medium">${(deal.purchase_price || 0).toLocaleString()}</span></div>
                    <div><span className="text-slate-500">List Price:</span> <span className="font-medium">${(deal.estimated_list_price || 0).toLocaleString()}</span></div>
                    <div><span className="text-slate-500">Type:</span> <span className="font-medium capitalize">{deal.deal_type || "—"}</span></div>
                    <div><span className="text-slate-500">Room:</span> <span className="font-medium">{room ? "Yes" : "No"}</span></div>
                    {room?.locked_agent_id && <div><span className="text-slate-500">Locked Agent:</span> <span className="font-medium">{getProfileName(room.locked_agent_id)}</span></div>}
                    <div><span className="text-slate-500">Created:</span> <span className="font-medium">{new Date(deal.created_date).toLocaleDateString()}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select onValueChange={val => changeStage(deal, val)} defaultValue={deal.pipeline_stage || "new_deals"}>
                      <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Move stage" /></SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={val => changeStatus(deal, val)} defaultValue={deal.status || "draft"}>
                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="destructive" onClick={() => deleteDeal(deal)} disabled={updating[`${deal.id}_delete`]}>
                      {updating[`${deal.id}_delete`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                      Delete
                    </Button>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400">Deal ID: {deal.id}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { PIPELINE_STAGES } from "@/components/pipelineStages";

const STAGE_COLORS = {
  new_deals: "bg-[#60A5FA]/15 text-[#60A5FA] border border-[#60A5FA]/30",
  connected_deals: "bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30",
  active_listings: "bg-[#E3C567]/15 text-[#E3C567] border border-[#E3C567]/30",
  in_closing: "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30",
  completed: "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30",
  canceled: "bg-red-500/15 text-red-400 border border-red-500/30",
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
          <Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] rounded-lg" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px] bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
            <SelectItem value="all">All Stages</SelectItem>
            {PIPELINE_STAGES.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-[#808080] mb-3">{filtered.length} deals</p>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-[#808080] text-center py-8">No deals found</p>}
        {filtered.map(deal => {
          const room = rooms.find(r => r.deal_id === deal.id);
          return (
            <div key={deal.id} className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                onClick={() => setExpanded(expanded === deal.id ? null : deal.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#FAFAFA] truncate">{deal.title || deal.property_address || "Untitled Deal"}</div>
                  <div className="text-xs text-[#808080]">
                    {deal.city && `${deal.city}, `}{deal.state} • Investor: {getProfileName(deal.investor_id)}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Badge className={`text-[10px] rounded-full ${STAGE_COLORS[deal.pipeline_stage] || "bg-[rgba(255,255,255,0.04)] text-[#808080] border border-[rgba(255,255,255,0.06)]"}`}>
                    {deal.pipeline_stage || "—"}
                  </Badge>
                  <Badge className="text-[10px] capitalize bg-[rgba(255,255,255,0.04)] text-[#808080] border border-[rgba(255,255,255,0.06)] rounded-full">{deal.status || "—"}</Badge>
                  {expanded === deal.id ? <ChevronUp className="w-4 h-4 text-[#808080]" /> : <ChevronDown className="w-4 h-4 text-[#808080]" />}
                </div>
              </div>
              {expanded === deal.id && (
                <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
                    <div><span className="text-[#808080]">Price:</span> <span className="font-medium text-[#FAFAFA]">${(deal.purchase_price || 0).toLocaleString()}</span></div>
                    <div><span className="text-[#808080]">List Price:</span> <span className="font-medium text-[#FAFAFA]">${(deal.estimated_list_price || 0).toLocaleString()}</span></div>
                    <div><span className="text-[#808080]">Type:</span> <span className="font-medium capitalize text-[#FAFAFA]">{deal.deal_type || "—"}</span></div>
                    <div><span className="text-[#808080]">Room:</span> <span className="font-medium text-[#FAFAFA]">{room ? "Yes" : "No"}</span></div>
                    {room?.locked_agent_id && <div><span className="text-[#808080]">Locked Agent:</span> <span className="font-medium text-[#FAFAFA]">{getProfileName(room.locked_agent_id)}</span></div>}
                    <div><span className="text-[#808080]">Created:</span> <span className="font-medium text-[#FAFAFA]">{new Date(deal.created_date).toLocaleDateString()}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select onValueChange={val => changeStage(deal, val)} defaultValue={deal.pipeline_stage || "new_deals"}>
                      <SelectTrigger className="w-[160px] h-8 text-xs bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] rounded-lg"><SelectValue placeholder="Move stage" /></SelectTrigger>
                      <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
                        {PIPELINE_STAGES.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={val => changeStatus(deal, val)} defaultValue={deal.status || "draft"}>
                      <SelectTrigger className="w-[130px] h-8 text-xs bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 rounded-lg" onClick={() => deleteDeal(deal)} disabled={updating[`${deal.id}_delete`]}>
                      {updating[`${deal.id}_delete`] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                      Delete
                    </Button>
                  </div>
                  <div className="mt-2 text-[10px] text-[#808080]/50">Deal ID: {deal.id}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { createDealRoom, listMyRooms, searchCounterparties } from "@/components/functions";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Users, Lock, FileText, 
  Plus, MessageCircle, Loader2, AlertCircle, ArrowRight, Search, X
} from "lucide-react";
import { toast } from "sonner";

function NewRoomModal({ open, onClose, onCreated }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    
    let cancelled = false;
    const loadCounterparties = async () => {
      setLoading(true);
      try {
        const response = await searchCounterparties({ q: query });
        if (!cancelled) {
          setItems(response.data?.items || []);
        }
      } catch (error) {
        console.error('Search error:', error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCounterparties();
    return () => { cancelled = true; };
  }, [open, query]);

  const createRoom = async () => {
    if (!selected) return;

    setCreating(true);
    try {
      const response = await createDealRoom({
        counterparty_profile_id: selected.id
      });
      
      if (response.data?.room?.id) {
        onCreated?.(response.data.room);
        onClose?.();
      } else {
        toast.error(response.data?.error || "Could not create room");
      }
    } catch (error) {
      console.error('Create room error:', error);
      toast.error("Failed to create room");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="ik-card w-full max-w-lg overflow-hidden">
        <div className="bg-[#D3A029] text-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Create Deal Room</h3>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-white/80 text-sm mt-2">
            Select a counterparty to start a secure deal room
          </p>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-10 h-12 rounded-xl border-[#E5E7EB]"
            />
          </div>

          <div className="max-h-80 overflow-y-auto border border-[#E5E7EB] rounded-xl">
            {loading ? (
              <div className="p-6 text-center text-sm text-[#6B7280]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D3A029]" />
                Searching...
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#6B7280]">
                No results found
              </div>
            ) : (
              items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left px-4 py-3 border-b border-[#F3F4F6] last:border-b-0 transition-colors ${
                    selected?.id === p.id ? "bg-[#FFFBEB] border-l-2 border-l-[#D3A029]" : "hover:bg-[#F9FAFB]"
                  }`}
                >
                  <div className="font-medium text-[#111827]">
                    {p.full_name || p.email || "User"}
                  </div>
                  <div className="text-xs text-[#6B7280] capitalize">
                    {p.user_role || p.role || "Member"}
                    {p.company && ` • ${p.company}`}
                  </div>
                </button>
              ))
            )}
          </div>

          {selected && (
            <div className="mt-4 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-3">
              <div className="text-sm text-[#92400E]">
                <strong>Selected:</strong> {selected.full_name || selected.email}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="ik-btn-outline">
              Cancel
            </button>
            <button 
              onClick={createRoom} 
              disabled={!selected || creating}
              className="ik-btn-primary disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create & Open Chat
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DealRooms() {
  const navigate = useNavigate();
  const { loading: profileLoading, role, onboarded, kycVerified, hasNDA, user, profile } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [openNew, setOpenNew] = useState(false);

  useEffect(() => {
    if (!profileLoading) {
      setLoading(false);
      if (onboarded && kycVerified && hasNDA) {
        loadRooms();
      }
    }
  }, [profileLoading, onboarded, kycVerified, hasNDA]);

  const loadRooms = async () => {
    try {
      const response = await listMyRooms();
      setRooms(response.data?.items || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error("Failed to load deal rooms");
    }
  };

  const handleCreated = (room) => {
    navigate(`${createPageUrl("Room")}?roomId=${room.id}`);
  };

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Loading deal rooms...</p>
        </div>
      </div>
    );
  }

  // Show gate if not ready
  if (!onboarded || !kycVerified || !hasNDA) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="ik-card p-8 max-w-md">
          <h2 className="ik-h1 text-[#111827] mb-4">Complete Setup to Access Deal Rooms</h2>
          <div className="space-y-3">
            {!onboarded && (
              <div className="ik-tile flex-col items-start gap-2">
                <div className="flex items-center gap-3">
                  <span className="ik-icon-pill">📋</span>
                  <span className="font-medium text-[#111827]">Complete onboarding</span>
                </div>
                <button onClick={() => navigate(createPageUrl(role === 'agent' ? 'AgentOnboarding' : 'InvestorOnboarding'))} className="ik-btn-primary text-sm mt-2">
                  Start Onboarding
                </button>
              </div>
            )}
            {!kycVerified && (
              <div className="ik-tile flex-col items-start gap-2">
                <div className="flex items-center gap-3">
                  <span className="ik-icon-pill">🛡️</span>
                  <span className="font-medium text-[#111827]">Verify identity</span>
                </div>
                <button onClick={() => navigate(createPageUrl('Verify'))} className="ik-btn-primary text-sm mt-2">
                  Verify Now
                </button>
              </div>
            )}
            {!hasNDA && (
              <div className="ik-tile flex-col items-start gap-2">
                <div className="flex items-center gap-3">
                  <span className="ik-icon-pill">🔒</span>
                  <span className="font-medium text-[#111827]">Accept NDA</span>
                </div>
                <button onClick={() => navigate(createPageUrl('NDA'))} className="ik-btn-primary text-sm mt-2">
                  Review NDA
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 lg:space-y-9">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="ik-h1 text-[#111827]">Deal Rooms</h1>
          <p className="mt-1 text-sm text-[#6B7280] sm:text-[0.95rem]">
            Secure collaboration spaces for your deals
          </p>
        </div>
        <button 
          className="ik-btn-primary"
          onClick={() => setOpenNew(true)}
        >
          <Plus className="w-5 h-5" />
          New Deal Room
        </button>
      </header>

      {/* Protection Notice */}
      <section className="ik-card ik-card-hover bg-[#FFFBEB] border-[#FCD34D] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="ik-icon-pill">🛡️</span>
          <p className="text-sm text-[#92400E]">
            <strong>Protected:</strong> All deal rooms are verified and NDA-protected. 
            Information shared here is confidential.
          </p>
        </div>
      </section>

      {/* Rooms List */}
      {rooms.length === 0 ? (
        <section className="ik-card p-12 text-center">
          <Users className="w-16 h-16 text-[#E5E7EB] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[#111827] mb-2">No Deal Rooms Yet</h3>
          <p className="text-[#6B7280] mb-6">
            Create your first deal room to start collaborating
          </p>
          <button 
            className="ik-btn-primary"
            onClick={() => setOpenNew(true)}
          >
            <Plus className="w-5 h-5" />
            Create Deal Room
          </button>
        </section>
      ) : (
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <button 
              key={room.id}
              className="ik-tile flex-col items-start gap-3 text-left"
              onClick={() => navigate(`${createPageUrl("Room")}?roomId=${room.id}`)}
            >
              <div className="flex items-start justify-between w-full">
                <h3 className="font-bold text-[#111827] text-lg">
                  {room.counterparty_name || `Room ${room.id.slice(0, 8)}`}
                </h3>
                <span className="ik-chip ik-chip-success text-xs">
                  {room.counterparty_role || 'Active'}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  Docs
                </div>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="ik-card p-5">
          <div className="ik-icon-pill mb-3">🔒</div>
          <h3 className="ik-section-title mb-2">NDA Protected</h3>
          <p className="ik-section-subtitle">
            All deal information is protected by legally binding NDAs
          </p>
        </div>
        <div className="ik-card p-5">
          <div className="ik-icon-pill mb-3">📋</div>
          <h3 className="ik-section-title mb-2">Audit Trail</h3>
          <p className="ik-section-subtitle">
            Every action is logged for security and compliance
          </p>
        </div>
        <div className="ik-card p-5">
          <div className="ik-icon-pill mb-3">✓</div>
          <h3 className="ik-section-title mb-2">Verified Users Only</h3>
          <p className="ik-section-subtitle">
            All participants are identity-verified and NDA-signed
          </p>
        </div>
      </section>

      <NewRoomModal 
        open={openNew} 
        onClose={() => setOpenNew(false)} 
        onCreated={handleCreated} 
      />
    </div>
  );
}
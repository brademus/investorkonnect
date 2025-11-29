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
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-10 mb-12">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                Deal Rooms
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600">
                Secure collaboration spaces for your investor–agent deals.
              </p>
            </div>
            <button 
              className="ik-btn-primary gap-2"
              onClick={() => setOpenNew(true)}
            >
              <Plus className="w-5 h-5" />
              New Deal Room
            </button>
          </div>
        </header>

        {/* Protection Notice Banner */}
        <section className="mb-6">
          <div className="ik-card bg-[#FFFBEB] border-[#FDE68A] p-5 flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] flex-shrink-0">
              <Shield className="w-5 h-5 text-[#D3A029]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#92400E]">Protected Environment</h3>
              <p className="mt-1 text-sm text-[#92400E]/80">
                All deal rooms are verified and NDA-protected. Information shared here is confidential.
              </p>
            </div>
          </div>
        </section>

        {/* Main Content Card */}
        <section className="mb-8">
          <div className="ik-card">
            {rooms.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF3C7] mb-5">
                  <Users className="w-8 h-8 text-[#D3A029]" />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  No deal rooms yet
                </h2>
                <p className="mt-2 max-w-md text-sm sm:text-base text-gray-600">
                  Create your first deal room to securely chat, track milestones, and manage contracts in one place.
                </p>
                <button 
                  className="mt-6 ik-btn-primary gap-2"
                  onClick={() => setOpenNew(true)}
                >
                  <Plus className="w-5 h-5" />
                  Create Deal Room
                </button>
              </div>
            ) : (
              /* Rooms Grid */
              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rooms.map((room) => (
                    <button 
                      key={room.id}
                      className="ik-card ik-card-hover p-5 text-left flex flex-col gap-4 hover:shadow-md hover:-translate-y-[2px] transition-all duration-200"
                      onClick={() => navigate(`${createPageUrl("Room")}?roomId=${room.id}`)}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex-shrink-0">
                            <Users className="w-5 h-5 text-[#D3A029]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {room.counterparty_name || `Room ${room.id.slice(0, 8)}`}
                            </h3>
                            <p className="text-xs text-gray-500 capitalize">
                              {room.counterparty_role || 'Counterparty'}
                            </p>
                          </div>
                        </div>
                        <span className="ik-chip ik-chip-success text-xs px-2 py-1">
                          Active
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4" />
                          <span>Docs</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4" />
                          <span>Secure</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100">
                        <span className="ik-btn-outline text-sm w-full justify-center gap-2">
                          Open Room
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Features Strip */}
        <section className="mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="ik-card p-5 hover:shadow-md hover:-translate-y-[2px] transition-all duration-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] mb-3">
                <Lock className="w-5 h-5 text-[#D3A029]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">NDA Protected</h3>
              <p className="mt-1 text-xs sm:text-sm text-gray-600">
                Every deal room is covered by your signed NDA, so conversations stay private.
              </p>
            </div>
            <div className="ik-card p-5 hover:shadow-md hover:-translate-y-[2px] transition-all duration-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] mb-3">
                <FileText className="w-5 h-5 text-[#D3A029]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Audit Trail</h3>
              <p className="mt-1 text-xs sm:text-sm text-gray-600">
                Every action is logged for complete security and compliance tracking.
              </p>
            </div>
            <div className="ik-card p-5 hover:shadow-md hover:-translate-y-[2px] transition-all duration-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] mb-3">
                <Shield className="w-5 h-5 text-[#D3A029]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Verified Users Only</h3>
              <p className="mt-1 text-xs sm:text-sm text-gray-600">
                All participants are identity-verified and have signed the platform NDA.
              </p>
            </div>
          </div>
        </section>
      </div>

      <NewRoomModal 
        open={openNew} 
        onClose={() => setOpenNew(false)} 
        onCreated={handleCreated} 
      />
    </div>
  );
}
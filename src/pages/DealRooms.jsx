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
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Create Deal Room</h3>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-2">
            Select a counterparty to start a secure deal room
          </p>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-10"
            />
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-600">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Searching...
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-600">
                No results found
              </div>
            ) : (
              items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-blue-50 transition-colors ${
                    selected?.id === p.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium text-slate-900">
                    {p.full_name || p.email || "User"}
                  </div>
                  <div className="text-xs text-slate-500 capitalize">
                    {p.user_role || p.role || "Member"}
                    {p.company && ` • ${p.company}`}
                  </div>
                </button>
              ))
            )}
          </div>

          {selected && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-900">
                <strong>Selected:</strong> {selected.full_name || selected.email}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={createRoom} 
              disabled={!selected || creating}
              className="bg-blue-600 hover:bg-blue-700"
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
            </Button>
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Show gate if not ready
  if (!onboarded || !kycVerified || !hasNDA) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Complete Setup to Access Deal Rooms</h2>
          <div className="space-y-3">
            {!onboarded && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-orange-900">Complete onboarding</p>
                  <Button size="sm" onClick={() => navigate(createPageUrl(role === 'agent' ? 'AgentOnboarding' : 'InvestorOnboarding'))} className="mt-2">
                    Start Onboarding
                  </Button>
                </div>
              </div>
            )}
            {!kycVerified && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Verify identity</p>
                  <Button size="sm" onClick={() => navigate(createPageUrl('Verify'))} className="mt-2">
                    Verify Now
                  </Button>
                </div>
              </div>
            )}
            {!hasNDA && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <Lock className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-purple-900">Accept NDA</p>
                  <Button size="sm" onClick={() => navigate(createPageUrl('NDA'))} className="mt-2">
                    Review NDA
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Deal Rooms</h1>
                <p className="text-slate-600">Secure collaboration spaces for your deals</p>
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setOpenNew(true)}
              >
                <Plus className="w-5 h-5 mr-2" />
                New Deal Room
              </Button>
            </div>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-800">
                  <strong>Protected:</strong> All deal rooms are verified and NDA-protected. 
                  Information shared here is confidential.
                </p>
              </div>
            </div>
          </div>

          {/* Rooms List */}
          {rooms.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Deal Rooms Yet</h3>
              <p className="text-slate-600 mb-6">
                Create your first deal room to start collaborating
              </p>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setOpenNew(true)}
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Deal Room
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <div 
                  key={room.id}
                  className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`${createPageUrl("Room")}?roomId=${room.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-bold text-slate-900 text-lg">
                      {room.counterparty_name || `Room ${room.id.slice(0, 8)}`}
                    </h3>
                    <Badge className="bg-emerald-100 text-emerald-800 capitalize">
                      {room.counterparty_role || 'Active'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      Chat
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      Docs
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Features */}
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <Lock className="w-10 h-10 text-blue-600 mb-4" />
              <h3 className="font-bold text-slate-900 mb-2">NDA Protected</h3>
              <p className="text-slate-600 text-sm">
                All deal information is protected by legally binding NDAs
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <FileText className="w-10 h-10 text-emerald-600 mb-4" />
              <h3 className="font-bold text-slate-900 mb-2">Audit Trail</h3>
              <p className="text-slate-600 text-sm">
                Every action is logged for security and compliance
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <Shield className="w-10 h-10 text-purple-600 mb-4" />
              <h3 className="font-bold text-slate-900 mb-2">Verified Users Only</h3>
              <p className="text-slate-600 text-sm">
                All participants are identity-verified and NDA-signed
              </p>
            </div>
          </div>
        </div>
      </div>

      <NewRoomModal 
        open={openNew} 
        onClose={() => setOpenNew(false)} 
        onCreated={handleCreated} 
      />
    </div>
  );
}
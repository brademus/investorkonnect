import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Shield, FileText, CheckCircle, RefreshCw, Trash2, AlertTriangle } from "lucide-react";

export default function AdminSettingsTab({ docusignConnection, onReload }) {
  const [adminEmail, setAdminEmail] = useState("");
  const [processing, setProcessing] = useState({});
  const [connectingDocusign, setConnectingDocusign] = useState(false);

  const grantAdmin = async () => {
    if (!adminEmail) { toast.error("Enter an email"); return; }
    if (!confirm(`Grant admin access to ${adminEmail}?`)) return;
    setProcessing(prev => ({ ...prev, admin: true }));
    try {
      const res = await base44.functions.invoke("grantAdmin", { email: adminEmail });
      if (res.data?.ok) {
        toast.success(`${adminEmail} is now admin`);
        setAdminEmail("");
        onReload();
      } else {
        toast.error(res.data?.error || "Failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(prev => ({ ...prev, admin: false }));
    }
  };

  const refreshVectors = async (role) => {
    setProcessing(prev => ({ ...prev, [`vectors_${role}`]: true }));
    try {
      const res = await base44.functions.invoke("refreshAllEmbeddings", { role });
      toast.success(`${role} vectors: ${res.data?.created || 0} created, ${res.data?.updated || 0} updated`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(prev => ({ ...prev, [`vectors_${role}`]: false }));
    }
  };

  const connectDocusign = async () => {
    setConnectingDocusign(true);
    try {
      const res = await base44.functions.invoke("docusignConnect", { returnTo: window.location.href, force: true });
      if (res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else if (res.data?.connected) {
        toast.info("Already connected");
        onReload();
        setConnectingDocusign(false);
      } else {
        toast.error(res.data?.error || "No auth URL received");
        setConnectingDocusign(false);
      }
    } catch (err) {
      toast.error(err.message);
      setConnectingDocusign(false);
    }
  };

  const disconnectDocusign = async () => {
    if (!confirm("Disconnect DocuSign?")) return;
    try {
      await base44.entities.DocuSignConnection.delete(docusignConnection.id);
      toast.success("Disconnected");
      onReload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runHealthCheck = async () => {
    setProcessing(prev => ({ ...prev, health: true }));
    try {
      const res = await base44.functions.invoke("profileHealthCheck", {});
      const d = res.data;
      toast.success(`Health: ${d?.summary?.health_status || "done"} — ${d?.summary?.checks_passed}/${d?.summary?.checks_total} passed`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(prev => ({ ...prev, health: false }));
    }
  };

  const runDedup = async () => {
    if (!confirm("Remove duplicate profiles?")) return;
    setProcessing(prev => ({ ...prev, dedup: true }));
    try {
      const res = await base44.functions.invoke("profileDedup", {});
      toast.success(`Removed ${res.data?.summary?.duplicates_removed || 0} duplicates`);
      onReload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(prev => ({ ...prev, dedup: false }));
    }
  };

  const cardStyle = { background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' };

  return (
    <div className="space-y-6">
      {/* Grant Admin */}
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3 className="font-semibold text-[#FAFAFA] mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#E3C567]" /> Grant Admin Access
        </h3>
        <p className="text-xs text-[#808080] mb-3">Give a user admin privileges without affecting their data.</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="user@example.com"
            value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            className="flex-1 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#808080] rounded-lg"
          />
          <Button onClick={grantAdmin} disabled={processing.admin} className="bg-[#E3C567] text-black hover:bg-[#EDD89F] rounded-lg">
            {processing.admin ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Make Admin
          </Button>
        </div>
      </div>

      {/* DocuSign */}
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3 className="font-semibold text-[#FAFAFA] mb-1 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#60A5FA]" /> DocuSign Connection
        </h3>
        {docusignConnection ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-[#34D399]" />
              <span className="text-sm font-medium text-[#34D399]">Connected</span>
            </div>
            <div className="text-xs text-[#808080] mb-3">
              Account: {docusignConnection.account_id} • Env: {docusignConnection.env}
            </div>
            <Button size="sm" className="bg-transparent text-red-400 border border-red-500/30 hover:bg-red-500/15 rounded-lg" onClick={disconnectDocusign}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-[#808080] mb-3">Connect to enable electronic signatures.</p>
            <Button onClick={connectDocusign} disabled={connectingDocusign} className="bg-[#E3C567] text-black hover:bg-[#EDD89F] rounded-lg">
              {connectingDocusign ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Connect DocuSign
            </Button>
          </div>
        )}
      </div>

      {/* System Tools */}
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3 className="font-semibold text-[#FAFAFA] mb-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#808080]" /> System Tools
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: "Run Health Check", icon: <CheckCircle className="w-4 h-4 mr-2 text-[#34D399]" />, key: "health", action: runHealthCheck },
            { label: "Remove Duplicate Profiles", icon: <Trash2 className="w-4 h-4 mr-2 text-red-400" />, key: "dedup", action: runDedup },
            { label: "Rebuild Agent Vectors", icon: <RefreshCw className="w-4 h-4 mr-2 text-[#A78BFA]" />, key: "vectors_agent", action: () => refreshVectors("agent") },
            { label: "Rebuild Investor Vectors", icon: <RefreshCw className="w-4 h-4 mr-2 text-[#A78BFA]" />, key: "vectors_investor", action: () => refreshVectors("investor") },
            { label: "Backfill Agent Coordinates", icon: <RefreshCw className="w-4 h-4 mr-2 text-[#60A5FA]" />, key: "backfill", action: async () => {
              setProcessing(prev => ({ ...prev, backfill: true }));
              try {
                const res = await base44.functions.invoke("backfillAgentCoordinates", {});
                toast.success(`Backfill: ${res.data?.updated || 0} updated, ${res.data?.skipped || 0} skipped`);
              } catch (err) { toast.error(err.message); }
              finally { setProcessing(prev => ({ ...prev, backfill: false })); }
            }},
            { label: "Refresh All Data", icon: <RefreshCw className="w-4 h-4 mr-2" />, key: "refresh", action: () => { onReload(); toast.success("Data refreshed"); } },
          ].map(tool => (
            <Button key={tool.key} className="justify-start bg-transparent border border-[#1F1F1F] text-[#FAFAFA] hover:border-[#E3C567] hover:bg-transparent rounded-lg" onClick={tool.action} disabled={processing[tool.key]}>
              {processing[tool.key] ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : tool.icon}
              {tool.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl p-5" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
        <h3 className="font-semibold text-red-400 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-red-400/70 mb-3">These actions are destructive and cannot be undone.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 rounded-lg" onClick={async () => {
            const input = prompt("⚠️ This will DELETE all non-admin profiles and related data. Type RESET to confirm:");
            if (input !== "RESET") return;
            setProcessing(prev => ({ ...prev, reset: true }));
            try {
              const res = await base44.functions.invoke("resetProfiles", {});
              toast.success(`Reset complete: ${res.data?.deletedProfiles || 0} profiles deleted`);
              onReload();
            } catch (err) { toast.error(err.message); }
            finally { setProcessing(prev => ({ ...prev, reset: false })); }
          }} disabled={processing.reset}>
            {processing.reset ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
            Reset Non-Admin Profiles
          </Button>
        </div>
      </div>
    </div>
  );
}
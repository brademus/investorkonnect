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

  return (
    <div className="space-y-6">
      {/* Grant Admin */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-600" /> Grant Admin Access
        </h3>
        <p className="text-xs text-slate-500 mb-3">Give a user admin privileges without affecting their data.</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="user@example.com"
            value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            className="flex-1"
          />
          <Button onClick={grantAdmin} disabled={processing.admin}>
            {processing.admin ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Make Admin
          </Button>
        </div>
      </div>

      {/* DocuSign */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" /> DocuSign Connection
        </h3>
        {docusignConnection ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Connected</span>
            </div>
            <div className="text-xs text-slate-500 mb-3">
              Account: {docusignConnection.account_id} • Env: {docusignConnection.env}
            </div>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={disconnectDocusign}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-500 mb-3">Connect to enable electronic signatures.</p>
            <Button onClick={connectDocusign} disabled={connectingDocusign}>
              {connectingDocusign ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Connect DocuSign
            </Button>
          </div>
        )}
      </div>

      {/* System Tools */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-slate-600" /> System Tools
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" onClick={runHealthCheck} disabled={processing.health} className="justify-start">
            {processing.health ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />}
            Run Health Check
          </Button>
          <Button variant="outline" onClick={runDedup} disabled={processing.dedup} className="justify-start">
            {processing.dedup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2 text-red-500" />}
            Remove Duplicate Profiles
          </Button>
          <Button variant="outline" onClick={() => refreshVectors("agent")} disabled={processing.vectors_agent} className="justify-start">
            {processing.vectors_agent ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2 text-purple-500" />}
            Rebuild Agent Vectors
          </Button>
          <Button variant="outline" onClick={() => refreshVectors("investor")} disabled={processing.vectors_investor} className="justify-start">
            {processing.vectors_investor ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2 text-purple-500" />}
            Rebuild Investor Vectors
          </Button>
          <Button variant="outline" onClick={async () => {
            setProcessing(prev => ({ ...prev, backfill: true }));
            try {
              const res = await base44.functions.invoke("backfillAgentCoordinates", {});
              toast.success(`Backfill: ${res.data?.updated || 0} updated, ${res.data?.skipped || 0} skipped`);
            } catch (err) { toast.error(err.message); }
            finally { setProcessing(prev => ({ ...prev, backfill: false })); }
          }} disabled={processing.backfill} className="justify-start">
            {processing.backfill ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2 text-blue-500" />}
            Backfill Agent Coordinates
          </Button>
          <Button variant="outline" onClick={() => { onReload(); toast.success("Data refreshed"); }} className="justify-start">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh All Data
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 rounded-xl border border-red-200 p-5">
        <h3 className="font-semibold text-red-900 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-red-700 mb-3">These actions are destructive and cannot be undone.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" size="sm" onClick={async () => {
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
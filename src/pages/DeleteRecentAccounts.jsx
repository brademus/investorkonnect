import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createPageUrl } from "@/components/utils";
import { Loader2, ShieldAlert, Trash2, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function DeleteRecentAccounts() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await base44.auth.me();
        if (!mounted) return;
        setUser(u);
        setIsAdmin(u?.role === "admin");
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleDelete = async () => {
    if (!isAdmin) return;
    const sure = window.confirm(
      "This will permanently delete the last two most recently created accounts and ALL related data (deals, rooms, messages, payments, activities, etc.). Are you absolutely sure?"
    );
    if (!sure) return;

    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await base44.functions.invoke("deleteRecentAccounts");
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="flex items-center gap-2 text-sm text-[#E3C567]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking permissions...
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-6">
          <div className="flex items-center gap-2 text-red-400">
            <ShieldAlert className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Admin access required</h1>
          </div>
          <p className="mt-3 text-sm text-[#9CA3AF]">
            You must be an admin to run destructive maintenance tools.
          </p>
          <div className="mt-5">
            <Link to={createPageUrl("Pipeline")} className="ik-btn-outline inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Pipeline
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#E3C567]">Delete Last Two Accounts</h1>
        <Link to={createPageUrl("Admin")} className="ik-btn-outline inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
      </div>

      <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-6">
        <p className="text-sm text-[#D1D5DB]">
          This tool will:
        </p>
        <ul className="mt-2 list-disc list-inside text-sm text-[#9CA3AF] space-y-1">
          <li>Identify the two most recently created profiles</li>
          <li>Delete all deals associated with those profiles (as investor or agent)</li>
          <li>Delete related rooms, messages, contracts, activities, appointments, payment schedules and milestones, matches, intro requests, and vectors</li>
          <li>Delete the profiles and attempt to delete the underlying auth users</li>
        </ul>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={handleDelete} disabled={running} className="bg-red-600 hover:bg-red-700">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete last two accounts
              </>
            )}
          </Button>
          <Link to={createPageUrl("Admin")} className="ik-btn-outline inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Link>
        </div>

        {error && (
          <div className="mt-5 text-sm text-red-400">Error: {error}</div>
        )}

        {result && (
          <div className="mt-6">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Completed</span>
            </div>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-black/40 p-4 text-xs text-[#E5E7EB] border border-[#1F1F1F]">
{JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
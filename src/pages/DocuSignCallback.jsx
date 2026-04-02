import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function DocuSignCallback() {
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const stateParam = params.get("state");

    let returnTo = "/Admin?docusign=connected";
    let codeVerifier = null;
    if (stateParam) {
      try {
        const parsed = JSON.parse(atob(stateParam));
        if (parsed.returnTo) {
          const url = new URL(parsed.returnTo, window.location.origin);
          url.searchParams.set("docusign", "connected");
          returnTo = url.pathname + url.search;
        }
        if (parsed.cv) codeVerifier = parsed.cv;
      } catch (_) {}
    }

    if (!code) {
      const err = params.get("error") || "No authorization code received";
      setStatus("error");
      setError(err);
      setTimeout(() => {
        window.location.href = "/Admin?docusign=error&message=" + encodeURIComponent(err);
      }, 2000);
      return;
    }

    const exchange = async () => {
      try {
        const res = await base44.functions.invoke("docusignCallback", { code, code_verifier: codeVerifier });
        if (res.data?.success) {
          setStatus("success");
          setTimeout(() => { window.location.href = returnTo; }, 1000);
        } else if (res.data?.select_account) {
          // Multiple accounts — redirect to admin with account picker params
          const accountsParam = encodeURIComponent(JSON.stringify(res.data.accounts));
          const atParam = encodeURIComponent(res.data.access_token);
          const rtParam = encodeURIComponent(res.data.refresh_token || '');
          const expParam = encodeURIComponent(res.data.expires_at || '');
          setStatus("success");
          window.location.href = `/Admin?docusign=select_account&accounts=${accountsParam}&access_token=${atParam}&refresh_token=${rtParam}&expires_at=${expParam}`;
        } else {
          setStatus("error");
          setError(res.data?.error || "Connection failed");
          setTimeout(() => {
            window.location.href = "/Admin?docusign=error&message=" + encodeURIComponent(res.data?.error || "Connection failed");
          }, 2000);
        }
      } catch (err) {
        setStatus("error");
        setError(err.message);
        setTimeout(() => {
          window.location.href = "/Admin?docusign=error&message=" + encodeURIComponent(err.message);
        }, 2000);
      }
    };

    exchange();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {status === "processing" && (
          <>
            <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin mx-auto mb-4" />
            <p className="text-[#FAFAFA] text-lg">Connecting DocuSign...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-[#FAFAFA] text-lg">DocuSign connected!</p>
            <p className="text-[#808080] text-sm mt-1">Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-[#FAFAFA] text-lg">Connection Failed</p>
            <p className="text-[#808080] text-sm mt-1">{error}</p>
            <p className="text-[#808080] text-xs mt-2">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}
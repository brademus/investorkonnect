import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function DocuSignCallback() {
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    // Check if this is already a result redirect (docusign=connected or docusign=error)
    const docusignResult = params.get("docusign");
    if (docusignResult === "connected") {
      setStatus("success");
      setTimeout(() => { window.location.href = "/Admin?docusign=connected"; }, 1000);
      return;
    }
    if (docusignResult === "error") {
      setStatus("error");
      setError(params.get("message") || "Connection failed");
      setTimeout(() => { window.location.href = "/Admin?docusign=error&message=" + encodeURIComponent(params.get("message") || ""); }, 2000);
      return;
    }

    if (!code) {
      const err = params.get("error") || "No authorization code received";
      setStatus("error");
      setError(err);
      setTimeout(() => {
        window.location.href = "/Admin?docusign=error&message=" + encodeURIComponent(err);
      }, 3000);
      return;
    }

    // Redirect to the backend function GET endpoint to handle the token exchange
    // server-side (no auth needed). Pass through all query params as-is.
    setDetail("Redirecting to server for token exchange...");
    window.location.href = `/functions/docusignCallback${window.location.search}`;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {status === "processing" && (
          <>
            <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin mx-auto mb-4" />
            <p className="text-[#FAFAFA] text-lg">Connecting DocuSign...</p>
            {detail && <p className="text-[#808080] text-xs mt-2">{detail}</p>}
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-[#FAFAFA] text-lg">DocuSign connected!</p>
            <p className="text-[#808080] text-sm mt-1">Redirecting...</p>
            {detail && <p className="text-[#808080] text-xs mt-1">{detail}</p>}
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-[#FAFAFA] text-lg">Connection Failed</p>
            <p className="text-[#808080] text-sm mt-1">{error}</p>
            {detail && <p className="text-[#808080]/60 text-xs mt-2 break-all">{detail}</p>}
            <p className="text-[#808080] text-xs mt-3">Redirecting to Admin...</p>
          </>
        )}
      </div>
    </div>
  );
}
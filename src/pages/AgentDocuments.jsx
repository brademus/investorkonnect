import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft } from "lucide-react";

function AgentDocumentsContent() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to={createPageUrl("Dashboard")} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-[#D3A029]" />
          <h1 className="text-3xl font-bold text-slate-900">Documents</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <p className="text-slate-600">Document upload and management coming soon.</p>
        </div>
      </div>
    </div>
  );
}

export default function AgentDocuments() {
  return (
    <AuthGuard requireAuth={true}>
      <AgentDocumentsContent />
    </AuthGuard>
  );
}
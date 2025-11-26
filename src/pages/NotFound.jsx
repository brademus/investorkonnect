import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { Home, Search, AlertCircle } from "lucide-react";

export default function NotFound() {
  useEffect(() => {
    document.title = "404 - Page Not Found | Investor Konnect";
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <AlertCircle className="w-20 h-20 text-slate-300 mx-auto mb-4" />
          <h1 className="text-6xl font-bold text-slate-900 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-slate-700 mb-4">Page Not Found</h2>
          <p className="text-slate-600">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={createPageUrl("Home")}>
            <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
          <Link to={createPageUrl("Contact")}>
            <Button variant="outline" className="w-full sm:w-auto">
              Contact Support
            </Button>
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-sm text-slate-600 mb-4">Popular pages:</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={createPageUrl("Investors")} className="text-sm text-blue-600 hover:text-blue-700">
              For Investors
            </Link>
            <Link to={createPageUrl("Agents")} className="text-sm text-blue-600 hover:text-blue-700">
              For Agents
            </Link>
            <Link to={createPageUrl("Pricing")} className="text-sm text-blue-600 hover:text-blue-700">
              Pricing
            </Link>
            <Link to={createPageUrl("Reviews")} className="text-sm text-blue-600 hover:text-blue-700">
              Reviews
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
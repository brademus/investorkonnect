import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle, Home, Mail } from "lucide-react";

export default function ThankYou() {
  useEffect(() => {
    document.title = "Thank You - Investor Konnect";
    
    if (window.gtag) {
      window.gtag('event', 'contact_success', {
        event_category: 'engagement'
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Message Received!</h1>
          <p className="text-lg text-slate-600 mb-2">
            Thank you for reaching out to Investor Konnect.
          </p>
          <p className="text-slate-600 mb-8">
            We'll get back to you within 24 hours at the email address you provided.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to={createPageUrl("Home")} className="flex-1">
              <Button variant="outline" className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <Link to={createPageUrl("Dashboard")} className="flex-1">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
        
        <p className="text-sm text-slate-500 mt-6">
          Need urgent help? Email <a href="mailto:support@investorkonnect.com" className="text-blue-600 hover:text-blue-700">support@investorkonnect.com</a>
        </p>
      </div>
    </div>
  );
}
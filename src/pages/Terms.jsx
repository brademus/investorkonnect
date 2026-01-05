import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

export default function Terms() {
  useEffect(() => {
    document.title = 'Terms of Use - Investor Konnect';
  }, []);

  return (
    <div className="min-h-screen bg-transparent py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          to={createPageUrl('Dashboard')} 
          className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-[#E3C567] mb-8">Terms of Use</h1>

          <div className="prose prose-invert prose-sm max-w-none text-[#FAFAFA]">
            <p className="text-lg mb-6">
              Terms of Use will be provided. For questions, contact support@investorkonnect.com.
            </p>

            <p className="text-sm text-[#808080]">
              This page is under construction. Complete terms and conditions will be available soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
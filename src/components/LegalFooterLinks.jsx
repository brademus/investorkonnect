import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

export default function LegalFooterLinks() {
  return (
    <div className="flex items-center justify-center gap-4 py-8 text-xs text-[#666]">
      <Link 
        to={createPageUrl('Privacy')} 
        className="hover:text-[#E3C567] transition-colors"
      >
        Privacy Policy
      </Link>
      <span className="text-[#333]">•</span>
      <Link 
        to={createPageUrl('Terms')} 
        className="hover:text-[#E3C567] transition-colors"
      >
        Terms of Use
      </Link>
    </div>
  );
}
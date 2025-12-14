import React from 'react';
import { Loader2 } from 'lucide-react';

// Simple spinner fallback - the Lottie animation has rendering issues with embedded WebP images
export default function LoadingAnimation({ className = "" }) {
  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-64 h-64';
  
  return (
    <div className={`flex items-center justify-center ${sizeClass} ${className}`}>
      <Loader2 className="w-16 h-16 text-[#E3C567] animate-spin" />
    </div>
  );
}
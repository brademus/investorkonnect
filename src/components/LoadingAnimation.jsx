import React from 'react';

export default function LoadingAnimation({ className = "" }) {
  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-16 h-16';
  
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeClass} border-4 border-[#E3C567]/20 border-t-[#E3C567] rounded-full animate-spin`} />
    </div>
  );
}
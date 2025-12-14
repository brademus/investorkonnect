import React from 'react';

// CSS-based loading animation - no dependencies, always works
export default function LoadingAnimation({ className = "" }) {
  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-16 h-16';
  
  return (
    <div className={`flex items-center justify-center ${sizeClass} ${className}`}>
      <div className="relative w-full h-full">
        <style>{`
          @keyframes spin-gold {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .loading-ring {
            border: 3px solid rgba(227, 197, 103, 0.2);
            border-top-color: #E3C567;
            border-radius: 50%;
            width: 100%;
            height: 100%;
            animation: spin-gold 0.8s linear infinite;
          }
        `}</style>
        <div className="loading-ring"></div>
      </div>
    </div>
  );
}
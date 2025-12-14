import React from 'react';

export default function LoadingAnimation({ className = "" }) {
  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-16 h-16';
  
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeClass} relative`}>
        <style>{`
          @keyframes spin-smooth {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse-glow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          .spinner-ring {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            border: 3px solid transparent;
            border-top-color: #E3C567;
            border-right-color: #E3C567;
            animation: spin-smooth 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          .spinner-glow {
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(227, 197, 103, 0.3) 0%, transparent 70%);
            animation: pulse-glow 1.5s ease-in-out infinite;
          }
        `}</style>
        <div className="spinner-glow"></div>
        <div className="spinner-ring"></div>
      </div>
    </div>
  );
}
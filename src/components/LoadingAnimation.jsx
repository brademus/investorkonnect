import React from 'react';

export default function LoadingAnimation({ className = "" }) {
  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-16 h-16';
  
  return (
    <div className={`flex items-center justify-center ${sizeClass} ${className}`}>
      <div className="relative" style={{ width: '100%', height: '100%' }}>
        <style>{`
          @keyframes spin-premium {
            0% { 
              transform: rotate(0deg);
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
            100% { 
              transform: rotate(360deg);
              opacity: 1;
            }
          }
          
          @keyframes pulse-glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(227, 197, 103, 0.4);
            }
            50% {
              box-shadow: 0 0 40px rgba(227, 197, 103, 0.7);
            }
          }
          
          .loading-spinner-outer {
            border: 3px solid transparent;
            border-top-color: #E3C567;
            border-right-color: #E3C567;
            border-radius: 50%;
            width: 100%;
            height: 100%;
            animation: spin-premium 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
          }
          
          .loading-spinner-inner {
            position: absolute;
            top: 20%;
            left: 20%;
            width: 60%;
            height: 60%;
            border: 2px solid transparent;
            border-bottom-color: rgba(227, 197, 103, 0.5);
            border-left-color: rgba(227, 197, 103, 0.5);
            border-radius: 50%;
            animation: spin-premium 0.8s linear infinite reverse;
          }
          
          .loading-center-dot {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 25%;
            height: 25%;
            background: linear-gradient(135deg, #E3C567 0%, #F4D88E 100%);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: pulse-glow 1.5s ease-in-out infinite;
          }
        `}</style>
        <div className="loading-spinner-outer">
          <div className="loading-spinner-inner"></div>
          <div className="loading-center-dot"></div>
        </div>
      </div>
    </div>
  );
}
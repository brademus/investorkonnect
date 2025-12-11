import React from 'react';

export default function LoadingAnimation({ className = "" }) {
  // Default to gold if no text color is provided in className
  const colorClass = className && className.includes('text-') ? '' : 'text-[#E3C567]';
  // Default size if not provided
  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-24 h-24';
  
  return (
    <div className={`flex items-center justify-center bg-transparent ${colorClass} ${sizeClass} ${className}`}>
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full animate-spin"
      >
        <path 
          d="M12 2.25C6.61522 2.25 2.25 6.61522 2.25 12C2.25 17.3848 6.61522 21.75 12 21.75C17.3848 21.75 21.75 17.3848 21.75 12C21.75 6.61522 17.3848 2.25 12 2.25ZM12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75Z" 
          fill="currentColor"
          fillOpacity="0.15" 
        />
        <path 
          d="M12 2.25C6.61522 2.25 2.25 6.61522 2.25 12C2.25 12.4142 2.58579 12.75 3 12.75C3.41421 12.75 3.75 12.4142 3.75 12C3.75 7.44365 7.44365 3.75 12 3.75C16.5563 3.75 20.25 7.44365 20.25 12C20.25 12.4142 20.5858 12.75 21 12.75C21.4142 12.75 21.75 12.4142 21.75 12C21.75 6.61522 17.3848 2.25 12 2.25Z" 
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
import React from 'react';

export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
      <div className="text-center">
        <p className="text-[#FAFAFA] mb-4">User not registered</p>
        <a href="/Home" className="text-[#E3C567] hover:underline">Return to Home</a>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import AgreementPanel from '@/components/AgreementPanel';

/**
 * Agreement tab - extracted from Room.js
 * Focus: agreement rendering only
 */
export default function RoomAgreementPanel({ dealId, roomId, profile, deal, room }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="flex-1 overflow-auto">
      <AgreementPanel
        dealId={dealId}
        roomId={roomId}
        profile={profile}
        deal={deal}
        room={room}
        refreshTrigger={refreshTrigger}
        onRefresh={() => setRefreshTrigger(t => t + 1)}
      />
    </div>
  );
}
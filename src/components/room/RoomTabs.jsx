import React from 'react';
import { FileText, MessageSquare, CheckSquare, DollarSign } from 'lucide-react';

/**
 * Simplified tab navigation - extracted from Room.js
 * Focus: tab switching only, no logic
 */
export function RoomTabs({ activeTab, onTabChange, counterOfferCount, appointmentCount }) {
  const tabs = [
    { id: 'agreement', label: 'Agreement', icon: FileText },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'walkthrough', label: 'Walkthrough', icon: CheckSquare, badge: appointmentCount },
    { id: 'escrow', label: 'Escrow', icon: DollarSign }
  ];

  return (
    <div className="border-b border-[#1F1F1F] flex gap-1 px-4 overflow-x-auto">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              isActive
                ? 'border-[#E3C567] text-[#E3C567]'
                : 'border-transparent text-[#808080] hover:text-[#FAFAFA]'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{tab.label}</span>
            {tab.badge ? <span className="text-xs bg-[#E3C567] text-black rounded-full w-5 h-5 flex items-center justify-center">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
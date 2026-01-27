import React from 'react';
import { ArrowLeft, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RoomHeader({ deal, room, isFullySigned, onBack }) {
  const getStatusIcon = () => {
    if (isFullySigned) return <CheckCircle className="w-4 h-4 text-[#10B981]" />;
    if (room?.agreement_status === 'investor_signed') return <Clock className="w-4 h-4 text-[#60A5FA]" />;
    return <AlertCircle className="w-4 h-4 text-[#F59E0B]" />;
  };

  const getStatusLabel = () => {
    if (isFullySigned) return 'Fully Signed';
    if (room?.agreement_status === 'investor_signed') return 'Awaiting Agent';
    return 'In Progress';
  };

  return (
    <div className="border-b border-[#1F1F1F] p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button onClick={onBack} variant="ghost" size="icon" className="text-[#808080]">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-lg font-bold text-[#FAFAFA]">{deal?.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            {getStatusIcon()}
            <span className="text-sm text-[#808080]">{getStatusLabel()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
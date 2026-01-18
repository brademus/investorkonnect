import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function IdentityMismatchModal({ open, onClose, enteredName, verifiedName, onUpdateProfile, onReverify }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
        <DialogHeader>
          <DialogTitle className="text-[#FAFAFA]">Name Mismatch</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-[#FAFAFA]">Your verified legal name does not match what you entered.</p>
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">
            <div className="text-[#808080]">Entered name</div>
            <div className="text-[#FAFAFA]">{enteredName || '—'}</div>
          </div>
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">
            <div className="text-[#808080]">Verified name</div>
            <div className="text-[#FAFAFA]">{verifiedName || '—'}</div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black" onClick={onUpdateProfile}>Update profile name</Button>
            <Button variant="outline" className="flex-1" onClick={onReverify}>Re-verify</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
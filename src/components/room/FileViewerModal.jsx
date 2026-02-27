import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ExternalLink, FileText } from "lucide-react";

/**
 * Modal for viewing/downloading files inline without navigating away.
 * Supports PDFs and images via iframe/img, and provides a download button for all file types.
 */
export default function FileViewerModal({ open, onOpenChange, fileUrl, fileName }) {
  const ext = (fileName || fileUrl || '').split('.').pop()?.toLowerCase()?.split('?')[0] || '';
  const isPdf = ext === 'pdf' || (fileUrl || '').includes('.pdf');
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || (fileUrl || '').match(/\.(png|jpg|jpeg|gif|webp|svg)/i);

  const canPreview = isPdf || isImage;

  const handleDownload = async () => {
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch {
      // Fallback: open in new tab
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col bg-[#0D0D0D] border-[#1F1F1F] p-0 gap-0">
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-3 border-b border-[#1F1F1F] shrink-0">
          <DialogTitle className="text-sm font-medium text-[#FAFAFA] truncate max-w-[60%]">
            {fileName || 'File'}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              size="sm"
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs h-8"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />Download
            </Button>
            <Button
              onClick={() => window.open(fileUrl, '_blank')}
              size="sm"
              variant="outline"
              className="rounded-full border-[#1F1F1F] text-[#808080] hover:text-[#FAFAFA] hover:border-[#E3C567] text-xs h-8"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Open
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isPdf && (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0"
              title={fileName || 'PDF Viewer'}
            />
          )}
          {isImage && !isPdf && (
            <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A] p-4 overflow-auto">
              <img
                src={fileUrl}
                alt={fileName || 'Image'}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          )}
          {!canPreview && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center gap-4 p-8">
              <div className="w-20 h-20 rounded-full bg-[#1F1F1F] flex items-center justify-center">
                <FileText className="w-10 h-10 text-[#808080]" />
              </div>
              <div>
                <p className="text-[#FAFAFA] font-medium mb-1">{fileName || 'File'}</p>
                <p className="text-sm text-[#808080]">Preview not available for this file type</p>
              </div>
              <Button
                onClick={handleDownload}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full mt-2"
              >
                <Download className="w-4 h-4 mr-2" />Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
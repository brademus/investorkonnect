import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";

/**
 * Modal for viewing/downloading files inline without navigating away.
 * Converts files to blob URLs so they render in-app without triggering downloads.
 */
export default function FileViewerModal({ open, onOpenChange, fileUrl, fileName }) {
  const ext = (fileName || fileUrl || '').split('.').pop()?.toLowerCase()?.split('?')[0] || '';
  const isPdf = ext === 'pdf' || (fileUrl || '').includes('.pdf');
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || !!(fileUrl || '').match(/\.(png|jpg|jpeg|gif|webp|svg)/i);
  const isOfficeDoc = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
  const canPreview = isPdf || isImage || isOfficeDoc;

  const [blobUrl, setBlobUrl] = useState(null);
  const [loadingBlob, setLoadingBlob] = useState(false);
  const [blobError, setBlobError] = useState(false);
  const prevUrlRef = useRef(null);

  // For PDFs: fetch as blob so the browser's built-in PDF viewer renders inline
  // instead of triggering a download from the remote content-disposition header.
  useEffect(() => {
    if (!open || !fileUrl || !isPdf) {
      if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
      setBlobError(false);
      prevUrlRef.current = null;
      return;
    }
    if (prevUrlRef.current === fileUrl) return;
    prevUrlRef.current = fileUrl;
    setLoadingBlob(true);
    setBlobError(false);

    fetch(fileUrl)
      .then(res => {
        if (!res.ok) throw new Error('fetch failed');
        return res.blob();
      })
      .then(blob => {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        setBlobUrl(url);
        setLoadingBlob(false);
      })
      .catch(() => {
        setBlobError(true);
        setLoadingBlob(false);
      });

    return () => {
      // cleanup handled on next open/close cycle
    };
  }, [open, fileUrl, isPdf]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  // Google Docs Viewer fallback for Office docs or when PDF blob fails
  const googleViewerUrl = (isOfficeDoc || (isPdf && blobError)) && fileUrl
    ? `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`
    : null;

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
          {/* PDF: render blob URL in iframe so browser PDF viewer shows inline */}
          {isPdf && !blobError && (
            loadingBlob ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
                <p className="text-sm text-[#808080]">Loading document...</p>
              </div>
            ) : blobUrl ? (
              <iframe
                src={blobUrl}
                className="w-full h-full border-0 bg-white"
                title={fileName || 'PDF Viewer'}
              />
            ) : null
          )}

          {/* PDF fallback or Office docs: use Google Docs Viewer */}
          {googleViewerUrl && !(isPdf && !blobError) && (
            <iframe
              src={googleViewerUrl}
              className="w-full h-full border-0 bg-white"
              title={fileName || 'Document Viewer'}
            />
          )}

          {/* Images */}
          {isImage && !isPdf && (
            <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A] p-4 overflow-auto">
              <img
                src={fileUrl}
                alt={fileName || 'Image'}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          )}

          {/* Unsupported file type */}
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
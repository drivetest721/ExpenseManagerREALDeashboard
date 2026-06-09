/**
 * InvoicePreviewPanel — Center panel showing horizontal nav + active attachment.
 */
import { Paperclip } from 'lucide-react';
import type { AttachmentMeta } from '../../../utils/attachmentApi';

interface Props {
  lsAllAttachments: string[];
  iPreviewIdx: number;
  setIPreviewIdx: (i: number) => void;
  objPreviewMeta: AttachmentMeta | null;
  strPreviewUrl: string;
  bScanning: boolean;
}

// Helper: format bytes to human-readable size
function formatFileSize(iBytes: number): string {
  if (iBytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(iBytes) / Math.log(k));
  return Math.round((iBytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default function InvoicePreviewPanel({
  lsAllAttachments,
  iPreviewIdx,
  setIPreviewIdx,
  objPreviewMeta,
  strPreviewUrl,
  bScanning,
}: Props) {
  return (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex-shrink-0 flex items-center justify-center">
        Invoice Preview
      </h2>

      {lsAllAttachments.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
              <Paperclip className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">No invoices uploaded yet</p>
            <p className="text-xs text-gray-400 mt-1">Upload invoices from the expense table</p>
          </div>
        </div>
      ) : (
        <>
          {/* Horizontal Navigation */}
          <div className="flex-shrink-0 flex items-center gap-3 mb-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-200">
            <button
              onClick={() => setIPreviewIdx(Math.max(0, iPreviewIdx - 1))}
              disabled={iPreviewIdx === 0}
              className="px-4 py-2 text-xs font-bold bg-white hover:bg-gradient-to-r hover:from-[#00703C] hover:to-[#005a30] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all hover:text-white border-2 border-gray-300 hover:border-[#00703C] shadow-sm disabled:hover:bg-white disabled:hover:text-gray-700"
            >
              ← Prev
            </button>
            <div className="flex-1 text-center">
              <p className="text-xs font-bold text-gray-700">
                Invoice <span className="text-lg text-[#00703C]">{iPreviewIdx + 1}</span> of{' '}
                <span className="text-lg text-[#00703C]">{lsAllAttachments.length}</span>
              </p>
              {objPreviewMeta && (
                <div className="mt-1.5">
                  <span className="text-xs text-gray-600 font-semibold">File Name: {objPreviewMeta.file_name}</span>
                  &nbsp;|&nbsp;
                  <span className="text-xs text-gray-600 font-semibold">size: {formatFileSize(objPreviewMeta.size)}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIPreviewIdx(Math.min(lsAllAttachments.length - 1, iPreviewIdx + 1))}
              disabled={iPreviewIdx === lsAllAttachments.length - 1}
              className="px-4 py-2 text-xs font-bold bg-white hover:bg-gradient-to-r hover:from-[#00703C] hover:to-[#005a30] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all hover:text-white border-2 border-gray-300 hover:border-[#00703C] shadow-sm disabled:hover:bg-white disabled:hover:text-gray-700"
            >
              Next →
            </button>
          </div>

          {/* Preview Area */}
          <div className="flex-1 overflow-auto border-2 border-gray-300 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 relative shadow-inner">
            {bScanning ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-10">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-[#00703C] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm font-semibold text-gray-700">Scanning for viruses…</p>
                  <p className="text-xs text-gray-500 mt-1">Please wait</p>
                </div>
              </div>
            ) : objPreviewMeta ? (
              objPreviewMeta.mime.startsWith('image/') ? (
                <img src={strPreviewUrl} alt={objPreviewMeta.file_name} className="w-full h-full object-contain p-4" />
              ) : objPreviewMeta.ext === 'pdf' ? (
                <iframe src={strPreviewUrl} className="w-full h-full" title={objPreviewMeta.file_name}></iframe>
              ) : (
                <div className="flex items-center justify-center h-full p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center mx-auto mb-3">
                      <Paperclip className="w-8 h-8 text-orange-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">{objPreviewMeta.file_name}</p>
                    <p className="text-xs text-gray-500 mt-2">Preview not available for this file type</p>
                    <p className="text-xs text-gray-400 mt-1">Download to view the document</p>
                  </div>
                </div>
              )
            ) : null}
          </div>
        </>
      )}
    </>
  );
}

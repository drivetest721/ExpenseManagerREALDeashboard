/**
 * AttachmentViewerModal \u2014 in-app carousel viewer for reimbursement
 * attachments. Renders images inline, PDFs in a scrollable iframe, and
 * Word documents behind a virus-scan gate.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  X, ChevronLeft, ChevronRight, FileText, Download,
  ShieldCheck, ShieldAlert, Loader2, ExternalLink, FileWarning,
} from 'lucide-react';
import {
  getAttachmentMetaApi,
  fetchAttachmentBlobApi,
  scanAttachmentApi,
} from '../../utils/attachmentApi';
import type {
  AttachmentMeta,
  AttachmentBlob,
  AttachmentScanResult,
} from '../../utils/attachmentApi';

interface AttachmentViewerModalProps {
  lsAttachmentIds: string[];
  iInitialIndex?: number;
  onClose: () => void;
}

type ItemKind = 'image' | 'pdf' | 'docx' | 'other';

function kindOf(objMeta: AttachmentMeta | null): ItemKind {
  if (!objMeta) return 'other';
  const strExt = (objMeta.ext || '').toLowerCase();
  const strMime = (objMeta.mime || '').toLowerCase();
  if (strMime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(strExt)) return 'image';
  if (strMime === 'application/pdf' || strExt === 'pdf') return 'pdf';
  if (strExt === 'docx' || strExt === 'doc' || strMime.includes('word')) return 'docx';
  return 'other';
}

export default function AttachmentViewerModal({
  lsAttachmentIds,
  iInitialIndex = 0,
  onClose,
}: AttachmentViewerModalProps) {
  const [iIndex, setIIndex] = useState<number>(
    Math.max(0, Math.min(iInitialIndex, lsAttachmentIds.length - 1)),
  );
  const [lsMeta, setLsMeta] = useState<(AttachmentMeta | null)[]>(
    () => lsAttachmentIds.map(() => null),
  );
  const [lsBlob, setLsBlob] = useState<(AttachmentBlob | null)[]>(
    () => lsAttachmentIds.map(() => null),
  );
  const [lsScan, setLsScan] = useState<(AttachmentScanResult | null)[]>(
    () => lsAttachmentIds.map(() => null),
  );
  const [lsLoading, setLsLoading] = useState<boolean[]>(
    () => lsAttachmentIds.map(() => false),
  );
  const [lsScanning, setLsScanning] = useState<boolean[]>(
    () => lsAttachmentIds.map(() => false),
  );
  const [lsError, setLsError] = useState<(string | null)[]>(
    () => lsAttachmentIds.map(() => null),
  );

  const refMounted = useRef<boolean>(true);

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    refMounted.current = true;
    return () => {
      refMounted.current = false;
      lsBlob.forEach((b) => b?.revoke());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the current item's metadata + blob (and scan if docx)
  useEffect(() => {
    const strId = lsAttachmentIds[iIndex];
    if (!strId) return;

    const fnLoad = async () => {
      let objMeta = lsMeta[iIndex];
      if (!objMeta) {
        try {
          objMeta = await getAttachmentMetaApi(strId);
          if (!refMounted.current) return;
          setLsMeta((prev) => {
            const next = [...prev];
            next[iIndex] = objMeta;
            return next;
          });
        } catch (objErr: any) {
          if (!refMounted.current) return;
          setLsError((prev) => {
            const next = [...prev];
            next[iIndex] = objErr?.response?.data?.detail || 'Failed to load metadata';
            return next;
          });
          return;
        }
      }

      const strKind = kindOf(objMeta);

      // For DOCX, run virus scan before fetching the blob.
      if (strKind === 'docx' && !lsScan[iIndex] && !lsScanning[iIndex]) {
        setLsScanning((prev) => { const n = [...prev]; n[iIndex] = true; return n; });
        try {
          const objRes = await scanAttachmentApi(strId);
          if (!refMounted.current) return;
          setLsScan((prev) => { const n = [...prev]; n[iIndex] = objRes; return n; });
        } catch (objErr: any) {
          if (!refMounted.current) return;
          setLsScan((prev) => {
            const n = [...prev];
            n[iIndex] = { status: 'error', engine: 'client', details: objErr?.response?.data?.detail || 'Scan failed' };
            return n;
          });
        } finally {
          if (refMounted.current) {
            setLsScanning((prev) => { const n = [...prev]; n[iIndex] = false; return n; });
          }
        }
      }

      // Fetch blob for image / pdf immediately; for docx only after a clean scan.
      const bNeedsBlob = (strKind === 'image' || strKind === 'pdf')
        || (strKind === 'docx' && lsScan[iIndex]?.status === 'clean');
      if (bNeedsBlob && !lsBlob[iIndex] && !lsLoading[iIndex]) {
        setLsLoading((prev) => { const n = [...prev]; n[iIndex] = true; return n; });
        try {
          const objBlob = await fetchAttachmentBlobApi(strId, objMeta);
          if (!refMounted.current) { objBlob.revoke(); return; }
          setLsBlob((prev) => { const n = [...prev]; n[iIndex] = objBlob; return n; });
        } catch (objErr: any) {
          if (!refMounted.current) return;
          setLsError((prev) => {
            const n = [...prev];
            n[iIndex] = objErr?.response?.data?.detail || 'Failed to load file';
            return n;
          });
        } finally {
          if (refMounted.current) {
            setLsLoading((prev) => { const n = [...prev]; n[iIndex] = false; return n; });
          }
        }
      }
    };

    void fnLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iIndex, lsScan[iIndex]?.status]);

  // Keyboard navigation
  const fnPrev = useCallback(() => {
    setIIndex((i) => (i > 0 ? i - 1 : i));
  }, []);
  const fnNext = useCallback(() => {
    setIIndex((i) => (i < lsAttachmentIds.length - 1 ? i + 1 : i));
  }, [lsAttachmentIds.length]);

  useEffect(() => {
    const fnKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') fnPrev();
      else if (e.key === 'ArrowRight') fnNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', fnKey);
    return () => window.removeEventListener('keydown', fnKey);
  }, [fnPrev, fnNext, onClose]);

  const objMeta = lsMeta[iIndex];
  const objBlob = lsBlob[iIndex];
  const objScan = lsScan[iIndex];
  const bLoading = lsLoading[iIndex];
  const bScanning = lsScanning[iIndex];
  const strError = lsError[iIndex];
  const strKind = kindOf(objMeta);

  const fnDownload = () => {
    if (!objBlob) return;
    const objA = document.createElement('a');
    objA.href = objBlob.url;
    objA.download = objBlob.fileName;
    objA.click();
  };

  const fnOpenNewTab = () => {
    if (objBlob) window.open(objBlob.url, '_blank', 'noopener');
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-900 truncate">
              {objMeta?.file_name || 'Loading\u2026'}
            </span>
            {objMeta?.ext && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 flex-shrink-0">
                {objMeta.ext}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
              {iIndex + 1} / {lsAttachmentIds.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {objBlob && (
              <button
                onClick={fnDownload}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded cursor-pointer transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded cursor-pointer transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 relative bg-gray-100 flex items-stretch overflow-hidden">
          {/* Prev arrow */}
          {lsAttachmentIds.length > 1 && (
            <button
              onClick={fnPrev}
              disabled={iIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
              title="Previous (\u2190)"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden flex items-stretch">
            {strError && (
              <div className="m-auto text-center text-sm text-red-600 px-6">
                <FileWarning className="w-8 h-8 mx-auto mb-2" />
                {strError}
              </div>
            )}
            {!strError && (bLoading || (!objMeta && !strError)) && (
              <div className="m-auto text-center text-sm text-gray-500">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                {'Loading\u2026'}
              </div>
            )}
            {!strError && objMeta && strKind === 'image' && objBlob && (
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 custom-scrollbar">
                <img
                  src={objBlob.url}
                  alt={objBlob.fileName}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            {!strError && objMeta && strKind === 'pdf' && objBlob && (
              <iframe
                src={objBlob.url}
                title={objBlob.fileName}
                className="w-full h-full border-0"
              />
            )}
            {!strError && objMeta && strKind === 'docx' && (
              <div className="m-auto max-w-md text-center px-6 py-8">
                {bScanning && (
                  <>
                    <Loader2 className="w-10 h-10 mx-auto mb-3 text-[#00703C] animate-spin" />
                    <p className="text-sm font-semibold text-gray-900">{'Scanning for malware\u2026'}</p>
                    <p className="text-xs text-gray-500 mt-1">Word documents are checked before they are opened.</p>
                  </>
                )}
                {!bScanning && objScan?.status === 'clean' && (
                  <>
                    <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <p className="text-sm font-semibold text-gray-900 mb-1">{'Scan complete \u2014 file is clean'}</p>
                    <p className="text-xs text-gray-500 mb-4">
                      Engine: <span className="font-mono">{objScan.engine}</span>
                    </p>
                    {bLoading && (
                      <p className="text-xs text-gray-500"><Loader2 className="w-4 h-4 inline animate-spin" /> {'Preparing file\u2026'}</p>
                    )}
                    {objBlob && (
                      <div className="flex flex-col gap-2 items-center">
                        <button
                          onClick={fnOpenNewTab}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#00703C] text-white rounded hover:bg-[#005a30] cursor-pointer text-sm font-medium transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" /> Open in new tab
                        </button>
                        <button
                          onClick={fnDownload}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 cursor-pointer text-sm font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                      </div>
                    )}
                  </>
                )}
                {!bScanning && objScan?.status === 'infected' && (
                  <>
                    <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-red-600" />
                    <p className="text-sm font-semibold text-red-700 mb-1">{'Threat detected \u2014 file blocked'}</p>
                    <p className="text-xs text-gray-600 mb-1">Engine: <span className="font-mono">{objScan.engine}</span></p>
                    <p className="text-xs text-red-600 break-words">{objScan.details}</p>
                  </>
                )}
                {!bScanning && objScan?.status === 'error' && (
                  <>
                    <FileWarning className="w-12 h-12 mx-auto mb-3 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-700 mb-1">Scan failed</p>
                    <p className="text-xs text-gray-600 break-words">{objScan.details}</p>
                  </>
                )}
                {!bScanning && objScan?.status === 'skipped' && (
                  <>
                    <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-semibold text-gray-700 mb-3">Scanning disabled on this server</p>
                    {objBlob && (
                      <button
                        onClick={fnOpenNewTab}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#00703C] text-white rounded hover:bg-[#005a30] cursor-pointer text-sm font-medium transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" /> Open in new tab
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {!strError && objMeta && strKind === 'other' && (
              <div className="m-auto text-center text-sm text-gray-600 px-6">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-semibold text-gray-800 mb-3">{objMeta.file_name}</p>
                <p className="text-xs text-gray-500 mb-4">Preview not available for this file type.</p>
                {objBlob && (
                  <button
                    onClick={fnDownload}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#00703C] text-white rounded hover:bg-[#005a30] cursor-pointer text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Next arrow */}
          {lsAttachmentIds.length > 1 && (
            <button
              onClick={fnNext}
              disabled={iIndex === lsAttachmentIds.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
              title="Next (\u2192)"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          )}
        </div>

        {/* Footer thumbnails / dots */}
        {lsAttachmentIds.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {lsAttachmentIds.map((_, i) => (
              <button
                key={i}
                onClick={() => setIIndex(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  i === iIndex ? 'w-6 bg-[#00703C]' : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                title={`Item ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

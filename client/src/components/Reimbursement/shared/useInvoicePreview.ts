/**
 * useInvoicePreview — Manages the list of attachment IDs gathered from
 * reimbursement rows, current preview index, virus scan + blob fetch lifecycle.
 */
import { useEffect, useRef, useState } from 'react';
import {
  scanAttachmentApi,
  getAttachmentMetaApi,
  fetchAttachmentBlobApi,
  type AttachmentMeta,
} from '../../../utils/attachmentApi';

export function useInvoicePreview(
  onError: (msg: string) => void,
) {
  const [lsAllAttachments, setLsAllAttachments] = useState<string[]>([]);
  const [iPreviewIdx, setIPreviewIdx] = useState(0);
  const [objPreviewMeta, setObjPreviewMeta] = useState<AttachmentMeta | null>(null);
  const [strPreviewUrl, setStrPreviewUrl] = useState('');
  const [bScanning, setBScanning] = useState(false);
  const refBlobCleanup = useRef<(() => void) | null>(null);

  // Rebuild unique attachment list from any source (rows / matrix cells).
  const rebuildFromIds = (lsIds: string[]) => {
    const lsUnique: string[] = [];
    for (const strId of lsIds) {
      if (strId && !lsUnique.includes(strId)) lsUnique.push(strId);
    }
    setLsAllAttachments(lsUnique);
    if (lsUnique.length > 0 && iPreviewIdx >= lsUnique.length) {
      setIPreviewIdx(lsUnique.length - 1);
    }
  };

  useEffect(() => {
    if (refBlobCleanup.current) {
      refBlobCleanup.current();
      refBlobCleanup.current = null;
    }

    if (lsAllAttachments.length === 0) {
      setObjPreviewMeta(null);
      setStrPreviewUrl('');
      return;
    }

    const strId = lsAllAttachments[iPreviewIdx];
    let bCancelled = false;

    (async () => {
      setBScanning(true);
      try {
        const objScan = await scanAttachmentApi(strId);
        if (bCancelled) return;
        if (objScan.status === 'infected') {
          onError('Virus detected in attachment. Cannot preview.');
          setObjPreviewMeta(null);
          setStrPreviewUrl('');
          return;
        }
        const objMeta = await getAttachmentMetaApi(strId);
        if (bCancelled) return;
        setObjPreviewMeta(objMeta);
        const objBlob = await fetchAttachmentBlobApi(strId, objMeta);
        if (bCancelled) {
          objBlob.revoke();
          return;
        }
        setStrPreviewUrl(objBlob.url);
        refBlobCleanup.current = objBlob.revoke;
      } catch (objErr: any) {
        if (!bCancelled) {
          onError(objErr?.response?.data?.detail || 'Failed to load invoice preview. Please try again.');
        }
      } finally {
        if (!bCancelled) setBScanning(false);
      }
    })();

    return () => {
      bCancelled = true;
      if (refBlobCleanup.current) {
        refBlobCleanup.current();
        refBlobCleanup.current = null;
      }
    };
  }, [lsAllAttachments, iPreviewIdx]);

  return {
    lsAllAttachments,
    iPreviewIdx,
    setIPreviewIdx,
    objPreviewMeta,
    strPreviewUrl,
    bScanning,
    rebuildFromIds,
  };
}

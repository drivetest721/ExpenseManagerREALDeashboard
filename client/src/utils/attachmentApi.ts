/**
 * attachmentApi.ts — Axios wrappers for Attachment upload/download endpoints.
 */
import { apiClient } from './apiClient';

export interface AttachmentUploadResponse {
  attachment_id: string;
  file_name: string;
  mime: string;
  size: number;
}

export interface AttachmentMeta {
  attachment_id: string;
  file_name: string;
  mime: string;
  size: number;
  ext: string;
}

export type AttachmentScanStatus = 'clean' | 'infected' | 'error' | 'skipped';

export interface AttachmentScanResult {
  status: AttachmentScanStatus;
  engine: string;
  details: string;
}

export interface AttachmentBlob {
  url: string;
  mime: string;
  fileName: string;
  size: number;
  revoke: () => void;
}

/**
 * POST /api/attachments/upload
 * Upload a file (multipart/form-data).
 */
export const uploadAttachmentApi = async (objFile: File): Promise<AttachmentUploadResponse> => {
  const objFormData = new FormData();
  objFormData.append('objFile', objFile);

  const objResp = await apiClient.post<AttachmentUploadResponse>('/api/attachments/upload', objFormData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return objResp.data;
};

/**
 * GET /api/attachments/:id
 * Returns the API path (useful for constructing URLs).
 */
export const getAttachmentUrlApi = (strId: string): string => {
  return `/api/attachments/${strId}`;
};

/**
 * Fetch an attachment via the authenticated apiClient and open it in a new tab.
 * Uses a temporary blob URL so the JWT token is sent properly.
 */
export const openAttachmentInTab = async (strId: string): Promise<void> => {
  const objResp = await apiClient.get<Blob>(`/api/attachments/${strId}`, {
    responseType: 'blob',
  });
  const strBlobUrl = URL.createObjectURL(objResp.data);
  const objTab = window.open(strBlobUrl, '_blank');
  // Revoke after a short delay so the browser has time to load the resource
  setTimeout(() => URL.revokeObjectURL(strBlobUrl), 10_000);
  if (!objTab) {
    // fallback: force download
    const objA = document.createElement('a');
    objA.href = strBlobUrl;
    objA.download = strId;
    objA.click();
  }
};

/**
 * GET /api/attachments/:id/meta
 * Returns filename / mime / size / extension without streaming the binary.
 */
export const getAttachmentMetaApi = async (strId: string): Promise<AttachmentMeta> => {
  const objResp = await apiClient.get<AttachmentMeta>(`/api/attachments/${strId}/meta`);
  return objResp.data;
};

/**
 * POST /api/attachments/:id/scan
 * Run a virus / structural scan on the file before opening it.
 */
export const scanAttachmentApi = async (strId: string): Promise<AttachmentScanResult> => {
  const objResp = await apiClient.post<AttachmentScanResult>(`/api/attachments/${strId}/scan`);
  return objResp.data;
};

/**
 * Fetch an attachment as a blob and return a temporary object URL plus
 * its metadata. The caller is responsible for invoking revoke() when done.
 */
export const fetchAttachmentBlobApi = async (
  strId: string,
  objMeta?: AttachmentMeta,
): Promise<AttachmentBlob> => {
  const objResp = await apiClient.get<Blob>(`/api/attachments/${strId}`, {
    responseType: 'blob',
  });
  const objBlob = objResp.data;
  const strUrl = URL.createObjectURL(objBlob);
  return {
    url: strUrl,
    mime: objMeta?.mime || objBlob.type || 'application/octet-stream',
    fileName: objMeta?.file_name || strId,
    size: objMeta?.size ?? objBlob.size,
    revoke: () => URL.revokeObjectURL(strUrl),
  };
};

/**
 * DELETE /api/attachments/:id
 * Admin-only deletion.
 */
export const deleteAttachmentApi = async (strId: string): Promise<void> => {
  await apiClient.delete(`/api/attachments/${strId}`);
};

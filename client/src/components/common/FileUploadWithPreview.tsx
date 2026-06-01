/**
 * FileUploadWithPreview — reusable file upload component with image preview
 * and PDF icon display.
 */
import { useState } from 'react';
import { uploadAttachmentApi } from '../../utils/attachmentApi';
import type { AttachmentUploadResponse } from '../../utils/attachmentApi';

interface FileUploadWithPreviewProps {
  strLabel?: string;
  onUploadComplete: (objAttachment: AttachmentUploadResponse) => void;
}

export default function FileUploadWithPreview({
  strLabel = 'Upload File',
  onUploadComplete,
}: FileUploadWithPreviewProps) {
  const [objFile, setObjFile] = useState<File | null>(null);
  const [strPreviewUrl, setStrPreviewUrl] = useState<string>('');
  const [bIsUploading, setBIsUploading] = useState<boolean>(false);
  const [strError, setStrError] = useState<string>('');

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const objSelectedFile = e.target.files?.[0];
    if (!objSelectedFile) return;

    setObjFile(objSelectedFile);
    setStrError('');

    // Generate preview for images
    if (objSelectedFile.type.startsWith('image/')) {
      const objReader = new FileReader();
      objReader.onload = (evt) => {
        setStrPreviewUrl(evt.target?.result as string);
      };
      objReader.readAsDataURL(objSelectedFile);
    } else {
      setStrPreviewUrl('');
    }
  }

  async function handleUpload() {
    if (!objFile) return;

    setBIsUploading(true);
    setStrError('');
    try {
      const objResp = await uploadAttachmentApi(objFile);
      onUploadComplete(objResp);
      setObjFile(null);
      setStrPreviewUrl('');
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Failed to upload file');
    } finally {
      setBIsUploading(false);
    }
  }

  return (
    <div className="border border-gray-300 rounded p-3 bg-gray-50">
      <label className="block text-sm font-medium text-gray-700 mb-2 cursor-default">
        {strLabel}
      </label>

      <input
        type="file"
        onChange={handleFileSelect}
        accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
        className="block w-full text-sm text-gray-700 mb-2"
      />

      {objFile && (
        <div className="mb-2">
          <p className="text-xs text-gray-600 cursor-default">
            Selected: <strong>{objFile.name}</strong> ({(objFile.size / 1024).toFixed(1)} KB)
          </p>
        </div>
      )}

      {strPreviewUrl && (
        <div className="mb-2">
          <img src={strPreviewUrl} alt="Preview" className="max-w-full h-40 object-contain border border-gray-200 rounded" />
        </div>
      )}

      {objFile && !objFile.type.startsWith('image/') && (
        <div className="mb-2">
          <p className="text-xs text-gray-600 cursor-default">
            📄 {objFile.type === 'application/pdf' ? 'PDF document' : 'Document'}
          </p>
        </div>
      )}

      {strError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 mb-2 text-xs cursor-default">
          {strError}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!objFile || bIsUploading}
        className="w-full px-3 py-2 bg-[#00703C] text-white rounded hover:bg-[#005a30] disabled:opacity-50 text-sm"
      >
        {bIsUploading ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
}

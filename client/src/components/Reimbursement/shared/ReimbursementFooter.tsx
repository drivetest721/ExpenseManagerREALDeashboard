/**
 * ReimbursementFooter — Sticky bottom Save Draft / Submit action bar.
 */
import { Save, Send } from 'lucide-react';

interface Props {
  bIsSaving: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export default function ReimbursementFooter({ bIsSaving, onSaveDraft, onSubmit }: Props) {
  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t-4 border-[#00703C]/20 px-6 py-5 flex justify-end items-center gap-4 flex-shrink-0 shadow-lg">
      <div className="flex gap-3">
        <button
          onClick={onSaveDraft}
          disabled={bIsSaving}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl hover:from-gray-800 hover:to-gray-900 disabled:opacity-50 transition-all shadow-md hover:shadow-lg hover:scale-105"
        >
          <Save className="w-4 h-4" />
          {bIsSaving ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          onClick={onSubmit}
          disabled={bIsSaving}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold bg-gradient-to-r from-[#00703C] to-[#005a30] text-white rounded-xl hover:from-[#005a30] hover:to-[#004020] disabled:opacity-50 transition-all shadow-md hover:shadow-lg hover:scale-105"
        >
          <Send className="w-4 h-4" />
          {bIsSaving ? 'Submitting…' : 'Save & Submit'}
        </button>
      </div>
    </div>
  );
}

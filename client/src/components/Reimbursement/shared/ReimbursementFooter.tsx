/**
 * ReimbursementFooter — Sticky bottom action bar.
 *
 * Modes:
 *   'normal'     → Save Draft + Save & Submit  (default, for DRAFT)
 *   'reapply'    → message textarea + Re-Apply  (after QUERY_RAISED / PRIVATE_ASK)
 *   'ca-reapply' → message textarea + Re-Apply to CA  (after CA_QUERY)
 */
import { Save, Send, RefreshCw } from 'lucide-react';

export type FooterMode = 'normal' | 'reapply' | 'ca-reapply';

interface Props {
  bIsSaving: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
  // Reapply-specific props
  strMode?: FooterMode;
  strReApplyMessage?: string;
  onReApplyMessageChange?: (msg: string) => void;
  onReApply?: () => void;
}

export default function ReimbursementFooter({
  bIsSaving,
  onSaveDraft,
  onSubmit,
  strMode = 'normal',
  strReApplyMessage = '',
  onReApplyMessageChange,
  onReApply,
}: Props) {
  // ── Re-apply mode (QUERY_RAISED / PRIVATE_ASK / CA_QUERY) ──────────────────
  if (strMode === 'reapply' || strMode === 'ca-reapply') {
    const strBtnLabel = strMode === 'ca-reapply' ? 'Re-Apply to CA' : 'Re-Apply';
    const strBusy = strMode === 'ca-reapply' ? 'Re-Applying to CA…' : 'Re-Applying…';

    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-t-4 border-orange-300 px-6 py-5 flex-shrink-0 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          {/* Message input */}
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-1 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              Message to Manager <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              value={strReApplyMessage}
              onChange={e => onReApplyMessageChange?.(e.target.value)}
              placeholder="Describe what you changed or clarify the manager's query…"
              rows={2}
              disabled={bIsSaving}
              className="w-full px-3 py-2 text-sm border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 resize-none bg-white disabled:opacity-60"
            />
          </div>
          {/* Action buttons */}
          <div className="flex gap-3 flex-shrink-0">
            {/* 
            <button
              onClick={onSaveDraft}
              disabled={bIsSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
              title="Save changes without reapplying"
            >
              <Save className="w-4 h-4" />
              {bIsSaving ? 'Saving…' : 'Save Changes'}
            </button>
            */}
            <button
              onClick={onReApply}
              disabled={bIsSaving || !strReApplyMessage.trim()}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-md hover:shadow-lg hover:scale-105 cursor-pointer"
            >
              <RefreshCw className="w-4 h-6" />
              {bIsSaving ? strBusy : strBtnLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal mode (DRAFT) ─────────────────────────────────────────────────────
  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t-4 border-[#00703C]/20 px-6 py-5 flex justify-end items-center gap-4 flex-shrink-0 shadow-lg">
      <div className="flex gap-3">
        <button
          onClick={onSaveDraft}
          disabled={bIsSaving}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl hover:from-gray-800 hover:to-gray-900 disabled:opacity-50 transition-all shadow-md hover:shadow-lg hover:scale-105 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {bIsSaving ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          onClick={onSubmit}
          disabled={bIsSaving}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold bg-gradient-to-r from-[#00703C] to-[#005a30] text-white rounded-xl hover:from-[#005a30] hover:to-[#004020] disabled:opacity-50 transition-all shadow-md hover:shadow-lg hover:scale-105 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          {bIsSaving ? 'Submitting…' : 'Save & Submit'}
        </button>
      </div>
    </div>
  );
}

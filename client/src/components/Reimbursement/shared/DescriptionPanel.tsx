/**
 * DescriptionPanel — Collapsible reimbursement description (10-250 chars).
 */
import { Check, ChevronDown, ChevronUp, FileEdit } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  bShow: boolean;
  onToggleShow: () => void;
  bHasError: boolean;
  onClearError: () => void;
}

export default function DescriptionPanel({
  value,
  onChange,
  bShow,
  onToggleShow,
  bHasError,
  onClearError,
}: Props) {
  return (
    <div className="flex-shrink-0 mt-4 border-t-2 border-gray-200 pt-4">
      <button
        type="button"
        onClick={onToggleShow}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#00703C] to-[#005a30] rounded-t-lg text-white font-bold text-sm hover:from-[#005a30] hover:to-[#004020] transition-all shadow-md cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <FileEdit className="w-5 h-5" />
          <span>Reimbursement Description</span>
          <span className="text-red-300 text-xs">(Required: 10-250 chars)</span>
        </div>
        {bShow ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {bShow && (
        <div
          className={`p-4 rounded-b-lg shadow-inner animate-fadeIn transition-all ${
            bHasError
              ? 'bg-red-50 border-2 border-red-500'
              : 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-[#00703C]'
          }`}
        >
          <textarea
            value={value}
            onChange={e => {
              onChange(e.target.value);
              if (bHasError) onClearError();
            }}
            placeholder="Describe the purpose of this reimbursement request (minimum 10 characters required)…"
            required
            minLength={10}
            maxLength={250}
            rows={4}
            className={`w-full px-4 py-3 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-[#00703C] placeholder:text-gray-400 hover:border-[#00703C]/50 transition-all shadow-sm resize-none font-medium ${
              bHasError ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
          />
          <div className="mt-2 flex justify-between items-center text-xs">
            <span
              className={`font-semibold ${
                value.length < 10
                  ? 'text-red-600'
                  : value.length >= 250
                    ? 'text-orange-600'
                    : 'text-green-600'
              }`}
            >
              {value.length < 10
                ? `${10 - value.length} more character${10 - value.length !== 1 ? 's' : ''} required`
                : `${value.length} / 250 characters`}
            </span>
            {value.length >= 10 && value.length <= 250 && (
              <span className="text-green-600 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Valid
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

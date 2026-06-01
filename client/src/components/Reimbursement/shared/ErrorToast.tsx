/**
 * ErrorToast — Floating dismissible error toast (top-right).
 */
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  message: string;
  onClose: () => void;
}

export default function ErrorToast({ message, onClose }: Props) {
  if (!message) return null;
  return (
    <div className="fixed top-20 right-6 z-50 max-w-md animate-fadeIn">
      <div className="bg-red-500 text-white px-5 py-4 rounded-xl shadow-2xl flex items-start gap-3 border-2 border-red-600">
        <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-semibold flex-1 leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white hover:bg-red-600 rounded-lg p-1 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

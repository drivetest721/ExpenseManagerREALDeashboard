/**
 * ErrorCard — used for displaying unhandled exceptions
 * (per .augment/rules/Augment_instruction.md → "Unhandled Exceptions").
 * Styling matches ui_schema_guidelines.md §3 (Error Banner).
 */
import { AlertTriangle } from 'lucide-react';

interface ErrorCardProps {
  title?: string;
  error: Error | string;
}

export function ErrorCard({ title = 'An error occurred', error }: ErrorCardProps) {
  const strMessage = typeof error === 'string' ? error : error.message;
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md cursor-default">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-red-900">{title}</h3>
          <p className="text-sm text-red-800">{strMessage}</p>
        </div>
      </div>
    </div>
  );
}

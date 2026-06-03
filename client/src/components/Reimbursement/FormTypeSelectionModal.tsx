/**
 * FormTypeSelectionModal — Modal prompting user to choose between General Expense or Business Trip form.
 * Opens before navigating to the full-page reimbursement form.
 */
import { useNavigate } from 'react-router-dom';
import { FileText, Plane } from 'lucide-react';

interface Props {
  bIsOpen: boolean;
  onClose: () => void;
}

export default function FormTypeSelectionModal({ bIsOpen, onClose }: Props) {
  const navigate = useNavigate();

  if (!bIsOpen) return null;

  const handleSelect = (strFormType: 'general' | 'business-trip') => {
    onClose();
    navigate(`/expense/new/${strFormType}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#00703C] to-[#005a30]">
          <h2 className="text-xl font-bold text-white">Select Form Type</h2>
          <p className="text-sm text-white/80 mt-1">Choose the type of reimbursement you want to create</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* General Expense */}
          <button
            onClick={() => handleSelect('general')}
            className="w-full flex items-start gap-4 p-5 border-2 border-gray-200 rounded-xl hover:border-[#00703C] hover:bg-[#00703C]/5 transition-all group cursor-pointer"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-[#00703C] transition-colors">
              <FileText className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-base font-bold text-gray-900 group-hover:text-[#00703C] transition-colors">📄 General Expense</h3>
              <p className="text-sm text-gray-600 mt-1">
                Regular reimbursement for daily expenses like meals, transport, office supplies, etc.
              </p>
            </div>
          </button>

          {/* Business Trip */}
          <button
            onClick={() => handleSelect('business-trip')}
            className="w-full flex items-start gap-4 p-5 border-2 border-gray-200 rounded-xl hover:border-[#00703C] hover:bg-[#00703C]/5 transition-all group cursor-pointer"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-[#00703C] transition-colors">
              <Plane className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-base font-bold text-gray-900 group-hover:text-[#00703C] transition-colors">✈️ Business Trip</h3>
              <p className="text-sm text-gray-600 mt-1">
                Reimbursement for business travel expenses including flights, hotels, meals, and transport.
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

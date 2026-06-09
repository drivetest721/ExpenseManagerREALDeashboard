/**
 * RightSidebar — Approval Chain placeholder + Payment Method selector.
 */
import { Check } from 'lucide-react';
import type { PaymentMethod } from '../../../types/paymentMethod';

interface Props {
  lsPaymentMethods: PaymentMethod[];
  strSelectedPaymentMethod: string;
  onSelectPaymentMethod: (id: string) => void;
}

export default function RightSidebar({
  lsPaymentMethods,
  strSelectedPaymentMethod,
  onSelectPaymentMethod,
}: Props) {
  console.log('Rendering RightSidebar with payment methods:', lsPaymentMethods);
  console.log('Selected payment method:', strSelectedPaymentMethod);
  console.log('onSelectPaymentMethod:', onSelectPaymentMethod);

  return (
    <>
      {/* Approval Chain Placeholder */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-center">
          Approval Chain
        </h2>
        <div className="space-y-3">
          <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl shadow-sm">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-xs text-gray-600 italic leading-relaxed">
                Your approval chain will be automatically determined when you submit the reimbursement based on your reporting hierarchy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Selection */}
      {/* <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-center">
          Payment Method
        </h2>
        {lsPaymentMethods.length === 0 ? (
          <div className="p-5 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-yellow-800">No payment method configured</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Add a UPI ID or QR code in{' '}
                  <a href="/profile" className="underline font-bold hover:text-yellow-900">Profile Settings</a> to receive payments.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {lsPaymentMethods.map(pm => (
              <label
                key={pm.payment_method_id}
                className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  strSelectedPaymentMethod === pm.payment_method_id
                    ? 'border-[#00703C] bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
                    : 'border-gray-300 hover:border-gray-400 hover:shadow-sm bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={pm.payment_method_id}
                  checked={strSelectedPaymentMethod === pm.payment_method_id}
                  onChange={() => onSelectPaymentMethod(pm.payment_method_id)}
                  className="mt-1 w-5 h-5 text-[#00703C] border-2 border-gray-300 focus:ring-[#00703C] cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-gray-900">
                      {pm.type === 'UPI_ID' ? '💳 UPI ID' : '📱 QR Code'}
                    </p>
                    {pm.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full shadow-sm">
                        <Check className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  {pm.type === 'UPI_ID' && pm.upi_id && (
                    <p className="text-xs font-mono bg-gray-100 px-2 py-1.5 rounded border border-gray-200 mt-2">
                      {pm.upi_id.slice(0, 4)}
                      {'●'.repeat(Math.max(0, pm.upi_id.length - 8))}
                      {pm.upi_id.slice(-4)}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div> */}
    </>
  );
}

/**
 * ProfilePage — user profile, payment methods & personal reimbursement summary.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { User, Mail, Briefcase, CreditCard, Clock, TrendingUp, Wallet, FileText, Upload, GitBranch, ChevronRight } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import {
  listMyPaymentMethodsApi,
  createPaymentMethodApi,
  setDefaultPaymentMethodApi,
  deletePaymentMethodApi,
} from '../utils/paymentMethodApi';
import { uploadAttachmentApi } from '../utils/attachmentApi';
import { listMyReimbursementsApi } from '../utils/reimbursementApi';
import type { PaymentMethod, PaymentMethodCreateRequest } from '../types/paymentMethod';
import type { ReimbursementListItem } from '../types/reimbursement';

// ── helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', manager: 'Manager', senior_manager: 'Senior Manager',
  employee: 'Employee', ca: 'CA', intern: 'Intern',
};
const ROLE_COLORS: Record<string, string> = {
  owner:          'bg-amber-100 text-amber-800 border border-amber-300',
  ca:             'bg-purple-100 text-purple-800 border border-purple-300',
  senior_manager: 'bg-blue-100 text-blue-800 border border-blue-300',
  manager:        'bg-indigo-100 text-indigo-800 border border-indigo-300',
  employee:       'bg-green-100 text-green-800 border border-green-300',
  intern:         'bg-gray-100 text-gray-700 border border-gray-300',
};
const PAID_STATUSES = new Set(['PAID', 'PAYMENT_ACKNOWLEDGED', 'CLOSED']);
const PENDING_STATUSES = new Set(['SUBMITTED', 'IN_REVIEW', 'QUERY_RAISED', 'PRIVATE_ASK', 'REAPPLIED', 'OWNER_APPROVED', 'CA_PENDING', 'CA_QUERY', 'CA_REAPPLIED']);

function fmtAmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { objUser } = useAuth();
  const [lsPaymentMethods, setLsPaymentMethods] = useState<PaymentMethod[]>([]);
  const [lsReimbs, setLsReimbs] = useState<ReimbursementListItem[]>([]);
  const [bShowAddForm, setBShowAddForm] = useState<boolean>(false);
  const [strType, setStrType] = useState<'UPI_ID' | 'QR_CODE'>('UPI_ID');
  const [strUpiId, setStrUpiId] = useState<string>('');
  const [strQrAttachmentId, setStrQrAttachmentId] = useState<string>('');
  const [strQrFileName, setStrQrFileName] = useState<string>('');
  const [bQrUploading, setBQrUploading] = useState<boolean>(false);
  const refQrInput = useRef<HTMLInputElement>(null);
  const [bIsDefault, setBIsDefault] = useState<boolean>(false);
  const [bIsLoading, setBIsLoading] = useState<boolean>(false);
  const [strError, setStrError] = useState<string>('');


  useEffect(() => {
    fetchPaymentMethods();
    listMyReimbursementsApi().then(setLsReimbs).catch(() => {});
  }, []);

  async function fetchPaymentMethods() {
    try {
      const lsData = await listMyPaymentMethodsApi();
      setLsPaymentMethods(lsData);
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Failed to load payment methods');
    }
  }

  async function handleQrUpload(objFile: File) {
    setBQrUploading(true);
    setStrError('');
    try {
      const objResp = await uploadAttachmentApi(objFile);
      setStrQrAttachmentId(objResp.attachment_id);
      setStrQrFileName(objResp.file_name);
    } catch {
      setStrError('Failed to upload QR image.');
    } finally {
      setBQrUploading(false);
    }
  }

  async function handleCreate() {
    setBIsLoading(true);
    setStrError('');
    try {
      const objPayload: PaymentMethodCreateRequest = {
        type: strType,
        upi_id: strType === 'UPI_ID' ? strUpiId : undefined,
        qr_image_url: strType === 'QR_CODE' ? strQrAttachmentId : undefined,
        is_default: bIsDefault,
      };
      await createPaymentMethodApi(objPayload);
      setBShowAddForm(false);
      setStrUpiId('');
      setStrQrAttachmentId('');
      setStrQrFileName('');
      setBIsDefault(false);
      await fetchPaymentMethods();
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Failed to create payment method');
    } finally {
      setBIsLoading(false);
    }
  }

  async function handleSetDefault(strId: string) {
    try {
      await setDefaultPaymentMethodApi(strId);
      await fetchPaymentMethods();
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Failed to set default');
    }
  }

  async function handleDelete(strId: string) {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    try {
      await deletePaymentMethodApi(strId);
      await fetchPaymentMethods();
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Failed to delete payment method');
    }
  }

  // ── derived data ──────────────────────────────────────────────────────────
  const fTotalPaid    = useMemo(() => lsReimbs.filter(r => PAID_STATUSES.has(r.status)).reduce((s, r) => s + r.total_amount, 0), [lsReimbs]);
  const fTotalPending = useMemo(() => lsReimbs.filter(r => PENDING_STATUSES.has(r.status)).reduce((s, r) => s + r.total_amount, 0), [lsReimbs]);
  const iTotalCount   = lsReimbs.filter(r => r.status !== 'DRAFT').length;
  const iPaidCount    = lsReimbs.filter(r => PAID_STATUSES.has(r.status)).length;

  const lsDepts = objUser?.departments ?? [];

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-5xl mx-auto">

          {/* ── Page title ── */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00703C]/10 text-[#00703C] flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 cursor-default">My Profile</h2>
              <p className="text-xs text-gray-500 cursor-default">Account information and reimbursement summary</p>
            </div>
          </div>

          {strError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm cursor-default">{strError}</div>
          )}

          {/* ── Top row: User info + KPI tiles ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

            {/* User card */}
            <div className="lg:col-span-1 bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 cursor-default">User Information</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#00703C]/10 text-[#00703C] flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {objUser?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 truncate cursor-default">{objUser?.name}</p>
                  {objUser?.employee_id && <p className="text-xs text-gray-400 cursor-default">#{objUser.employee_id}</p>}
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-700 cursor-default">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{objUser?.email}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700 cursor-default">
                  <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1.5">
                    {lsDepts.length === 0 && <span className="text-gray-400 italic">No role assigned</span>}
                    {lsDepts.map((d, i) => (
                      <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[d.role] ?? 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[d.role] ?? d.role}
                        {d.department_name ? ` · ${d.department_name}` : ''}
                        {d.is_primary ? ' ★' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* KPI tiles */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider cursor-default">Total Received</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 cursor-default">{fmtAmt(fTotalPaid)}</p>
                <p className="text-xs text-gray-500 cursor-default">{iPaidCount} reimbursement{iPaidCount !== 1 ? 's' : ''} paid</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-600">
                  <Clock className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider cursor-default">Pending Amount</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 cursor-default">{fmtAmt(fTotalPending)}</p>
                <p className="text-xs text-gray-500 cursor-default">Awaiting approval / payment</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-blue-600">
                  <FileText className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider cursor-default">Total Filed</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 cursor-default">{iTotalCount}</p>
                <p className="text-xs text-gray-500 cursor-default">Submitted reimbursements</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-teal-600">
                  <Wallet className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider cursor-default">Success Rate</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 cursor-default">
                  {iTotalCount === 0 ? '—' : `${Math.round((iPaidCount / iTotalCount) * 100)}%`}
                </p>
                <p className="text-xs text-gray-500 cursor-default">Paid out of total filed</p>
              </div>
            </div>
          </div>

          {/* ── Payment Methods ── */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#00703C]" />
                <h3 className="text-base font-bold text-gray-900 cursor-default">Payment Methods</h3>
              </div>
              <button
                onClick={() => setBShowAddForm(!bShowAddForm)}
                className="px-3 py-1.5 bg-[#00703C] text-white rounded-lg hover:bg-[#005a30] text-sm font-semibold cursor-pointer transition-colors"
              >
                {bShowAddForm ? 'Cancel' : 'Add New'}
              </button>
            </div>

            {bShowAddForm && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2 cursor-default">Type</label>
                <select
                  value={strType}
                  onChange={(e) => setStrType(e.target.value as 'UPI_ID' | 'QR_CODE')}
                  className="w-full border-b-2 border-gray-300 bg-amber-50 px-3 py-2 mb-3 focus:outline-none focus:border-[#00703C]"
                >
                  <option value="UPI_ID">UPI ID</option>
                  <option value="QR_CODE">QR Code</option>
                </select>

                {strType === 'UPI_ID' && (
                  <>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 cursor-default">UPI ID</label>
                    <input
                      type="text"
                      value={strUpiId}
                      onChange={(e) => setStrUpiId(e.target.value)}
                      placeholder="user@paytm"
                      className="w-full border-b-2 border-gray-300 bg-amber-50 px-3 py-2 mb-3 focus:outline-none focus:border-[#00703C]"
                    />
                  </>
                )}

                {strType === 'QR_CODE' && (
                  <>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 cursor-default">QR Code Image</label>
                    <input
                      ref={refQrInput}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleQrUpload(f); }}
                    />
                    {strQrAttachmentId ? (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <span className="text-xs text-green-700 font-medium flex-1 truncate">{strQrFileName}</span>
                        <button type="button" onClick={() => { setStrQrAttachmentId(''); setStrQrFileName(''); }} className="text-xs text-red-500 hover:text-red-700 cursor-pointer">Remove</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={bQrUploading}
                        onClick={() => refQrInput.current?.click()}
                        className="flex items-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-lg px-3 py-4 mb-3 text-sm text-gray-500 hover:border-[#00703C] hover:text-[#00703C] cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {bQrUploading ? 'Uploading…' : 'Click to upload QR image (PNG, JPG)'}
                      </button>
                    )}
                  </>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-700 mb-3 cursor-pointer">
                  <input type="checkbox" checked={bIsDefault} onChange={(e) => setBIsDefault(e.target.checked)} className="cursor-pointer" />
                  Set as default
                </label>

                <button
                  onClick={handleCreate}
                  disabled={bIsLoading}
                  className="w-full px-3 py-2 bg-[#00703C] text-white rounded-lg hover:bg-[#005a30] disabled:opacity-50 font-semibold cursor-pointer transition-colors"
                >
                  {bIsLoading ? 'Creating…' : 'Create'}
                </button>
              </div>
            )}

            {lsPaymentMethods.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-xl px-4 py-6 text-center">
                <p className="text-sm text-gray-500 cursor-default">No payment methods added yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lsPaymentMethods.map((objPm) => (
                  <div key={objPm.payment_method_id} className="flex items-start justify-between border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors cursor-default">
                    <div className="flex items-start gap-3 min-w-0">
                      <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {objPm.type === 'UPI_ID' ? `UPI: ${objPm.upi_id}` : 'QR Code'}
                        </p>
                        {objPm.created_at && (
                          <p className="text-xs text-gray-400 mt-0.5">Added {new Date(objPm.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        )}
                      </div>
                      {objPm.is_default && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold ml-1 shrink-0">Default</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      {!objPm.is_default && (
                        <button onClick={() => handleSetDefault(objPm.payment_method_id)} className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer transition-colors">
                          Set Default
                        </button>
                      )}
                      <button onClick={() => handleDelete(objPm.payment_method_id)} className="text-xs text-red-600 hover:text-red-800 font-semibold cursor-pointer transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Approval Chain ── */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="w-5 h-5 text-[#00703C]" />
              <h3 className="text-base font-bold text-gray-900 cursor-default">Approval Chain</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 cursor-default">
              Your reimbursements follow this approval path. The highlighted manager reviews your requests first.
            </p>
            
            <div className="flex flex-col gap-2">
              {/* Current user node */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#00703C]/10 to-emerald-50 border-2 border-[#00703C] rounded-xl shadow-sm">
                <div className="w-10 h-10 rounded-full bg-[#00703C] text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">
                  {objUser?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    {objUser?.name} <span className="px-2 py-0.5 bg-[#00703C] text-white text-xs rounded-full ml-1">You</span>
                  </p>
                  <p className="text-xs text-gray-600">{objUser?.email}</p>
                  {objUser?.departments && objUser.departments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {objUser.departments.map((d, idx) => (
                        <span 
                          key={idx}
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[d.role] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {ROLE_LABELS[d.role] || d.role}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Manager(s) */}
              {(objUser?.managers ?? []).length > 0 ? (
                <>
                  <div className="flex items-center gap-2 py-1 pl-4">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase">Reporting Managers</span>
                  </div>
                  
                  {/* Show multiple managers side by side if more than one */}
                  {(objUser?.managers ?? []).length === 1 ? (
                    [...(objUser?.managers ?? [])].sort((a, b) => a.priority - b.priority).map((m, i) => (
                      <div key={m.manager_id} className="flex flex-col gap-1">
                        <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border-2 border-yellow-400 rounded-xl shadow-md">
                          <div className="w-10 h-10 rounded-full bg-yellow-200 text-yellow-800 flex items-center justify-center text-sm font-bold flex-shrink-0 border-2 border-yellow-400">
                            {(m.manager_name || 'M')?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900">
                              {m.manager_name ?? 'Manager'}
                              <span className="ml-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-bold rounded-full uppercase border border-yellow-400">
                                {m.approval_type}
                              </span>
                            </p>
                            <p className="text-xs text-gray-600">Priority {m.priority} · Manager</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex gap-3 pl-4">
                      {[...(objUser?.managers ?? [])].sort((a, b) => a.priority - b.priority).map((m, i) => (
                        <div key={m.manager_id} className="flex-1 min-w-0">
                          <div className={`flex flex-col gap-2 px-3 py-3 rounded-xl shadow-md ${
                            i === 0 
                              ? 'bg-yellow-50 border-2 border-yellow-400' 
                              : 'bg-blue-50 border-2 border-blue-300'
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                i === 0
                                  ? 'bg-yellow-200 text-yellow-800 border-2 border-yellow-400'
                                  : 'bg-blue-200 text-blue-800 border-2 border-blue-400'
                              }`}>
                                {(m.manager_name || 'M')?.[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{m.manager_name ?? 'Manager'}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 text-xs font-bold rounded-full uppercase text-center ${
                                i === 0 
                                  ? 'bg-yellow-200 text-yellow-800 border border-yellow-400' 
                                  : 'bg-blue-200 text-blue-800 border border-blue-400'
                              }`}>
                                {m.approval_type}
                              </span>
                              <p className="text-xs text-gray-600 text-center">Priority {m.priority}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="px-4 py-2 text-xs text-gray-400 text-center border border-dashed border-gray-300 rounded-lg">
                  No managers assigned
                </div>
              )}

              {/* Owner */}
              <div className="flex items-center gap-2 py-1 pl-4">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase">Next Level</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-2 border-amber-300 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-sm font-bold flex-shrink-0 border-2 border-amber-400">
                  O
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    Owner
                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase border border-red-300">
                      Mandatory
                    </span>
                  </p>
                  <p className="text-xs text-gray-600">Final departmental approval</p>
                </div>
              </div>

              {/* CA */}
              <div className="flex items-center gap-2 py-1 pl-4">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase">Payment Processing</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border-2 border-purple-300 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-sm font-bold flex-shrink-0 border-2 border-purple-400">
                  CA
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    Chartered Accountant
                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase border border-red-300">
                      Mandatory
                    </span>
                  </p>
                  <p className="text-xs text-gray-600">Payment verification & processing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

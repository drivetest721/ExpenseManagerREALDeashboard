/**
 * HolidaysPanel — Google Calendar–style view with a mini calendar on the left
 * and a holiday list on the right.  Click any date to add a holiday; past dates
 * and weekends are visually muted.
 */
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Trash2, CalendarDays, X, Check, Repeat2 } from 'lucide-react';
import { listHolidaysApi, createHolidayApi, deleteHolidayApi } from '../../utils/holidayApi';
import type { Holiday } from '../../utils/holidayApi';

// ── date helpers ──────────────────────────────────────────────────────────────
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtDmy(strYmd: string): string {
  const [y, m, d] = strYmd.split('-');
  return `${d}/${m}/${y}`;
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── Component ─────────────────────────────────────────────────────────────────
export default function HolidaysPanel() {
  const [lsHolidays, setLsHolidays] = useState<Holiday[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [strError, setStrError] = useState('');
  const [strSuccess, setStrSuccess] = useState('');

  // calendar nav
  const today = new Date();
  const [iYear, setIYear] = useState<number>(today.getFullYear());
  const [iMonth, setIMonth] = useState<number>(today.getMonth());

  // create dialog
  const [strPickedDate, setStrPickedDate] = useState<string>('');
  const [strName, setStrName] = useState<string>('');
  const [strRecurrence, setStrRecurrence] = useState<'once' | 'annual'>('once');
  const [bSaving, setBSaving] = useState(false);

  const load = useCallback(async () => {
    setBLoading(true); setStrError('');
    try { setLsHolidays(await listHolidaysApi()); }
    catch { setStrError('Failed to load holidays.'); }
    finally { setBLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg: string) { setStrSuccess(msg); setTimeout(() => setStrSuccess(''), 3000); }

  function openCreate(strYmd: string) {
    setStrPickedDate(strYmd);
    setStrName('');
    setStrRecurrence('once');
    setStrError('');
  }
  function closeDialog() { setStrPickedDate(''); }

  async function handleAdd() {
    if (!strName.trim()) { setStrError('Holiday name is required.'); return; }
    setBSaving(true); setStrError('');
    try {
      await createHolidayApi({ date: strPickedDate, name: strName.trim() });
      if (strRecurrence === 'annual') {
        const [y, m, d] = strPickedDate.split('-');
        const strNextYear = `${parseInt(y) + 1}-${m}-${d}`;
        await createHolidayApi({ date: strNextYear, name: strName.trim() });
      }
      flash('Holiday added.');
      closeDialog();
      await load();
    } catch (e: any) { setStrError(e.response?.data?.detail || 'Failed to add holiday.'); }
    finally { setBSaving(false); }
  }

  async function handleDelete(h: Holiday) {
    if (!confirm(`Remove holiday "${h.name}" (${fmtDmy(h.date)})?`)) return;
    setStrError('');
    try { await deleteHolidayApi(h.holiday_id); flash('Holiday removed.'); await load(); }
    catch (e: any) { setStrError(e.response?.data?.detail || 'Failed to delete holiday.'); }
  }

  // ── Calendar build ──────────────────────────────────────────────────────────
  const strTodayYmd = toYmd(today);
  const setHolidayDates = new Set(lsHolidays.map(h => h.date));
  const iDays = daysInMonth(iYear, iMonth);
  const iFirstDow = firstDayOfMonth(iYear, iMonth);

  const lsCells: Array<{ day: number; strYmd: string } | null> = [];
  for (let i = 0; i < iFirstDow; i++) lsCells.push(null);
  for (let d = 1; d <= iDays; d++) {
    const m = String(iMonth + 1).padStart(2, '0');
    const ds = String(d).padStart(2, '0');
    lsCells.push({ day: d, strYmd: `${iYear}-${m}-${ds}` });
  }

  function prevMonth() {
    if (iMonth === 0) { setIYear(y => y - 1); setIMonth(11); }
    else setIMonth(m => m - 1);
  }
  function nextMonth() {
    if (iMonth === 11) { setIYear(y => y + 1); setIMonth(0); }
    else setIMonth(m => m + 1);
  }

  // ── sorted holiday list ─────────────────────────────────────────────────────
  const lsSorted = [...lsHolidays].sort((a, b) => a.date.localeCompare(b.date));
  const lsUpcoming = lsSorted.filter(h => h.date >= strTodayYmd);
  const lsPast     = lsSorted.filter(h => h.date <  strTodayYmd);

  const strInput = "w-full h-10 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C]/30 focus:border-[#00703C]";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 cursor-default">Holidays are excluded from business-day SLA calculations. Click any date on the calendar to add a holiday.</p>

      {strError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">{strError}</div>}
      {strSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-3 py-2 text-sm">✅ {strSuccess}</div>}

      {/* ── Create dialog ── */}
      {strPickedDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-900">Add Holiday · {fmtDmy(strPickedDate)}</h4>
              <button onClick={closeDialog} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Holiday Name <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  className={strInput}
                  value={strName}
                  onChange={e => setStrName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder="e.g. Republic Day"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recurrence</label>
                <div className="flex gap-3">
                  {(['once', 'annual'] as const).map(r => (
                    <label key={r} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                      strRecurrence === r ? 'border-[#00703C] bg-[#00703C]/5 text-[#00703C]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="recurrence" value={r} checked={strRecurrence === r} onChange={() => setStrRecurrence(r)} className="sr-only" />
                      {r === 'annual' && <Repeat2 className="w-4 h-4" />}
                      <span className="text-sm font-medium">{r === 'once' ? 'This Day Only' : 'Annually'}</span>
                    </label>
                  ))}
                </div>
                {strRecurrence === 'annual' && (
                  <p className="text-xs text-gray-500 mt-2">Will create the holiday for {strPickedDate.slice(0,4)} and {parseInt(strPickedDate.slice(0,4)) + 1}.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeDialog} className="inline-flex items-center gap-1.5 px-4 h-10 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleAdd} disabled={bSaving}
                className="inline-flex items-center gap-1.5 px-4 h-10 text-sm bg-[#00703C] text-white rounded-md hover:bg-[#005a30] disabled:opacity-50 cursor-pointer shadow-sm">
                <Check className="w-4 h-4" /> {bSaving ? 'Adding…' : 'Add Holiday'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Two-column: calendar + list ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">

        {/* ── Calendar ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden self-start">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-gray-800 cursor-default">{MONTHS[iMonth]} {iYear}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DOW.map((d, i) => (
              <div key={d} className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 p-2 gap-0.5">
            {lsCells.map((cell, idx) => {
              if (!cell) return <div key={`e${idx}`} />;
              const dow = (iFirstDow + cell.day - 1) % 7;
              const bWeekend = dow === 0 || dow === 6;
              const bPast = cell.strYmd < strTodayYmd;
              const bToday = cell.strYmd === strTodayYmd;
              const bHoliday = setHolidayDates.has(cell.strYmd);
              const strHolidayName = bHoliday ? lsHolidays.find(h => h.date === cell.strYmd)?.name : undefined;
              return (
                <button
                  key={cell.strYmd}
                  onClick={() => openCreate(cell.strYmd)}
                  title={strHolidayName ?? `Add holiday — ${fmtDmy(cell.strYmd)}`}
                  className={`relative flex flex-col items-center justify-center h-10 w-full rounded-lg text-sm font-medium transition-colors cursor-pointer
                    ${bToday ? 'ring-2 ring-[#00703C] text-[#00703C] bg-[#00703C]/5 hover:bg-[#00703C]/10' :
                      bHoliday ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                      (bWeekend || bPast) ? 'text-gray-300 hover:bg-gray-50' :
                                            'text-gray-700 hover:bg-gray-100'}`}
                >
                  {cell.day}
                  {bHoliday && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </button>
              );
            })}
          </div>

          <div className="px-3 pb-3 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Holiday</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded ring-2 ring-[#00703C] inline-block" /> Today</span>
          </div>
        </div>

        {/* ── Holiday list ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden self-start">
          {bLoading && (
            <p className="text-sm text-gray-500 py-8 text-center cursor-default">Loading holidays…</p>
          )}
          {!bLoading && lsHolidays.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm cursor-default">No holidays yet. Click a date on the calendar to add one.</p>
            </div>
          )}
          {!bLoading && lsHolidays.length > 0 && (
            <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto custom-scrollbar">
              {/* Upcoming & today */}
              {lsUpcoming.map(h => {
                const bIsToday = h.date === strTodayYmd;
                const dt = new Date(h.date + 'T00:00:00');
                return (
                  <div key={h.holiday_id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${bIsToday ? 'bg-[#00703C]/5' : ''}`}>
                    <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-lg flex-shrink-0 cursor-default ${bIsToday ? 'bg-[#00703C] text-white' : 'bg-amber-50 text-amber-700'}`}>
                      <span className="text-[10px] uppercase font-semibold leading-none">{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-base font-bold leading-tight">{String(dt.getDate()).padStart(2,'0')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${bIsToday ? 'text-[#00703C]' : 'text-gray-900'}`}>{h.name}</p>
                      <p className="text-xs text-gray-500 cursor-default">{dt.toLocaleDateString('en-US', { weekday: 'long' })} · {fmtDmy(h.date)}</p>
                    </div>
                    <button onClick={() => handleDelete(h)} title="Remove" className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {/* Past — muted */}
              {lsPast.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-default">Past Holidays</span>
                  </div>
                  {lsPast.slice().reverse().map(h => {
                    const dt = new Date(h.date + 'T00:00:00');
                    return (
                      <div key={h.holiday_id} className="flex items-center gap-3 px-4 py-2.5 opacity-50 hover:opacity-75 transition-opacity">
                        <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex-shrink-0 cursor-default">
                          <span className="text-[9px] uppercase font-semibold leading-none">{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="text-sm font-bold leading-tight">{String(dt.getDate()).padStart(2,'0')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 truncate text-sm">{h.name}</p>
                          <p className="text-xs text-gray-400 cursor-default">{fmtDmy(h.date)}</p>
                        </div>
                        <button onClick={() => handleDelete(h)} title="Remove" className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
          {!bLoading && lsHolidays.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 cursor-default">{lsUpcoming.length} upcoming · {lsPast.length} past</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

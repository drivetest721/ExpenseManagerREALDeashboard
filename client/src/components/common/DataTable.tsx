/**
 * DataTable — Generic, reusable table component with configurable columns, sorting, pagination
 * Supports Sr. Number, alternate row colors, dynamic data, and custom styling
 */
import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface TableColumn<T> {
  key: string;
  label: string;
  width?: string; // e.g., 'w-32', 'w-20'
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
  headerBgColor?: string; // e.g., 'bg-blue-100'
  headerTextColor?: string; // e.g., 'text-blue-700'
  cellBgColor?: string; // individual cell styling
  cellTextColor?: string;
}

export interface DataTableConfig<T> {
  columns: TableColumn<T>[];
  data: T[];
  pageSize?: number;
  pageSizeOptions?: number[];
  showSerialNumber?: boolean;
  alternateRowColor?: boolean;
  rowBgColor?: string; // primary row bg
  altRowBgColor?: string; // alternate row bg
  hoverBgColor?: string;
  headerBgColor?: string; // default header bg
  headerTextColor?: string; // default header text
  headerBorderColor?: string;
  rowBorderColor?: string;
  onRowClick?: (item: T, index: number) => void;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  emptyMessage?: string;
  showTopPagination?: boolean;
  rowScrollable?: boolean;
  scrollHeight?: string; // e.g. '40vh' or '400px'
}

interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export default function DataTable<T extends { id?: string; [key: string]: any }>({
  columns,
  data,
  pageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  showSerialNumber = true,
  alternateRowColor = true,
  rowBgColor = 'bg-white',
  altRowBgColor = 'bg-gray-50',
  hoverBgColor = 'hover:bg-blue-50/30',
  headerBgColor = 'bg-white',
  headerTextColor = 'text-gray-700 font-semibold',
  headerBorderColor = 'border-gray-200',
  rowBorderColor = 'border-gray-100',
  onRowClick,
  defaultSortKey = '',
  defaultSortDir = 'asc',
  emptyMessage = 'No data available',
  showTopPagination = false,
  rowScrollable = true,
  scrollHeight = '40vh',
}: DataTableConfig<T>) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize_internal, setPageSize_internal] = useState(pageSize);
  const [sortState, setSortState] = useState<SortState>({
    key: defaultSortKey || (columns[0]?.key ?? ''),
    dir: defaultSortDir,
  });

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortState.key) return [...data];

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortState.key];
      const bVal = b[sortState.key];

      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return sortState.dir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [data, sortState]);

  // Paginate
  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize_internal));
  const pagedData = useMemo(
    () => sortedData.slice(pageIndex * pageSize_internal, (pageIndex + 1) * pageSize_internal),
    [sortedData, pageIndex, pageSize_internal],
  );

  // Reset page index if needed
  if (pageIndex >= pageCount && pageCount > 0) {
    setPageIndex(Math.max(0, pageCount - 1));
  }

  function toggleSort(key: string) {
    setSortState((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }

  function getSortIcon(key: string) {
    if (sortState.key !== key) {
      return (
        <span className="inline-flex flex-col -space-y-1.5 opacity-20">
          <ChevronUp className="w-2.5 h-2.5 text-gray-500" />
          <ChevronDown className="w-2.5 h-2.5 text-gray-500" />
        </span>
      );
    }
    return sortState.dir === 'asc'
      ? <ChevronUp className="w-2.5 h-2.5 text-[#00703C]" />
      : <ChevronDown className="w-2.5 h-2.5 text-[#00703C]" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table container with scrollable body and sticky header */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div style={rowScrollable ? { maxHeight: scrollHeight, overflowY: 'auto' } : undefined}>
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className={`${headerBgColor} text-left text-xs uppercase tracking-[0.12em] ${headerTextColor} border-b ${headerBorderColor}`}>
                {showSerialNumber && (
                  <th className="w-16 border-r border-gray-200 px-4 py-3 sticky top-0 z-20">Sr. No.</th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.width ?? 'flex-1'} border-r ${headerBorderColor} px-4 py-3 sticky top-0 z-20 cursor-pointer select-none hover:bg-gray-200/20 transition-colors group ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                    onClick={() => col.sortable !== false && toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center justify-start gap-2">
                      {col.label}
                      {col.sortable !== false && getSortIcon(col.key)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedData.map((item, index) => {
                const globalIndex = pageIndex * pageSize_internal + index;
                const isAlternate = alternateRowColor && globalIndex % 2 !== 0;
                const rowBg = isAlternate ? altRowBgColor : rowBgColor;

                return (
                  <tr
                    key={item.id ?? index}
                    onClick={() => onRowClick?.(item, globalIndex)}
                    className={`${rowBg} ${onRowClick ? 'cursor-pointer' : ''} ${hoverBgColor} transition-colors duration-150 border-b ${rowBorderColor}`}
                  >
                    {showSerialNumber && (
                      <td className="border-r border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 truncate">
                        {globalIndex + 1}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={`${item.id ?? index}-${col.key}`}
                        className={`border-r border-gray-100 px-4 py-3 text-sm truncate ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        } ${col.cellTextColor ?? 'text-gray-700'}`}
                      >
                        <div className="max-w-full">
                          {col.render ? col.render(item, globalIndex) : String(item[col.key] ?? '—')}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls - Bottom only */}
      {sortedData.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              disabled={pageIndex === 0}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 min-w-max">
              <span className="text-sm font-semibold text-gray-700">Page</span>
              <span className="inline-flex items-center justify-center rounded-md bg-[#00703C] w-8 h-8 text-white text-sm font-bold">
                {pageIndex + 1}
              </span>
              <span className="text-sm text-gray-600">of {pageCount}</span>
            </div>
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.min(prev + 1, pageCount - 1))}
              disabled={pageIndex >= pageCount - 1}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
            >
              Next →
            </button>

            {/* rows-per-page if top pagination hidden */}
            {!showTopPagination && (
              <div className="ml-4 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Rows per page:</label>
                <select
                  value={pageSize_internal}
                  onChange={(e) => {
                    setPageSize_internal(Number(e.target.value));
                    setPageIndex(0);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00703C]/30 transition-colors"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-700 font-medium">
            <span className="text-[#00703C] font-bold">{sortedData.length}</span> total{' '}
            {sortedData.length === 1 ? 'item' : 'items'}
          </p>
        </div>
      )}
    </div>
  );
}

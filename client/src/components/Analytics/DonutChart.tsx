/**
 * DonutChart — minimal SVG donut for status distribution.
 */
type Slice = { label: string; value: number; color: string };

interface IProps {
  lsSlices: Slice[];
  strCenterLabel?: string;
  strCenterValue?: string;
}

export default function DonutChart({ lsSlices, strCenterLabel, strCenterValue }: IProps) {
  const numTotal = lsSlices.reduce((acc, s) => acc + s.value, 0);
  if (numTotal === 0) {
    return <p className="text-sm text-gray-500 text-center py-6 cursor-default">No data yet.</p>;
  }
  const numRadius = 60;
  const numCircumference = 2 * Math.PI * numRadius;
  let numOffset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
        <circle cx="80" cy="80" r={numRadius} stroke="#f3f4f6" strokeWidth="20" fill="none" />
        {lsSlices.map((objSlice, i) => {
          const numLen = (objSlice.value / numTotal) * numCircumference;
          const objEl = (
            <circle
              key={`${objSlice.label}-${i}`}
              cx="80"
              cy="80"
              r={numRadius}
              stroke={objSlice.color}
              strokeWidth="20"
              fill="none"
              strokeDasharray={`${numLen} ${numCircumference - numLen}`}
              strokeDashoffset={-numOffset}
            >
              <title>{`${objSlice.label}: ${objSlice.value}`}</title>
            </circle>
          );
          numOffset += numLen;
          return objEl;
        })}
      </svg>
      {(strCenterLabel || strCenterValue) && (
        <div className="-mt-24 mb-12 text-center pointer-events-none">
          <div className="text-lg font-semibold text-gray-900 cursor-default tabular-nums">{strCenterValue}</div>
          {strCenterLabel && (
            <div className="text-xs text-gray-500 cursor-default">{strCenterLabel}</div>
          )}
        </div>
      )}
      <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {lsSlices.map((objSlice, i) => (
          <div key={`legend-${i}`} className="flex items-center gap-2 cursor-default">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: objSlice.color }} />
            <span className="text-gray-700 truncate" title={objSlice.label}>{objSlice.label}</span>
            <span className="text-gray-900 font-semibold tabular-nums ml-auto">{objSlice.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

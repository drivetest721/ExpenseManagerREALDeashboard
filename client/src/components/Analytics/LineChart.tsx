/**
 * LineChart — monthly trend line + soft area fill (inline SVG).
 */
type Point = { label: string; value: number };

interface IProps {
  lsPoints: Point[];
  strColor?: string;
  fnFormat?: (n: number) => string;
  iHeight?: number;
}

export default function LineChart({
  lsPoints,
  strColor = '#00703C',
  fnFormat = (n) => n.toLocaleString(),
  iHeight = 200,
}: IProps) {
  if (!lsPoints || lsPoints.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-6 cursor-default">No data yet.</p>;
  }
  const iWidth = 600;
  const iPadL = 50;
  const iPadR = 16;
  const iPadT = 16;
  const iPadB = 28;
  const numMax = Math.max(...lsPoints.map((p) => p.value), 1);
  const numPlotW = iWidth - iPadL - iPadR;
  const numPlotH = iHeight - iPadT - iPadB;
  const iCount = lsPoints.length;
  const numStep = iCount > 1 ? numPlotW / (iCount - 1) : 0;

  const fnXY = (i: number, v: number): [number, number] => {
    const x = iPadL + i * numStep;
    const y = iPadT + numPlotH - (v / numMax) * numPlotH;
    return [x, y];
  };

  const strPath = lsPoints
    .map((p, i) => {
      const [x, y] = fnXY(i, p.value);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const strArea =
    `${strPath} L${(iPadL + (iCount - 1) * numStep).toFixed(1)},${(iPadT + numPlotH).toFixed(1)} ` +
    `L${iPadL.toFixed(1)},${(iPadT + numPlotH).toFixed(1)} Z`;

  const lsTicks = [0, 0.5, 1].map((f) => ({
    y: iPadT + numPlotH - f * numPlotH,
    label: fnFormat(numMax * f),
  }));

  return (
    <svg viewBox={`0 0 ${iWidth} ${iHeight}`} className="w-full h-auto">
      {lsTicks.map((t, i) => (
        <g key={`tick-${i}`}>
          <line x1={iPadL} x2={iWidth - iPadR} y1={t.y} y2={t.y} stroke="#e5e7eb" strokeDasharray="3,3" />
          <text x={iPadL - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="#6b7280">{t.label}</text>
        </g>
      ))}
      <path d={strArea} fill={strColor} opacity="0.12" />
      <path d={strPath} fill="none" stroke={strColor} strokeWidth="2" />
      {lsPoints.map((p, i) => {
        const [x, y] = fnXY(i, p.value);
        return (
          <g key={`pt-${i}`}>
            <circle cx={x} cy={y} r="3.5" fill="#fff" stroke={strColor} strokeWidth="2">
              <title>{`${p.label}: ${fnFormat(p.value)}`}</title>
            </circle>
            <text x={x} y={iHeight - 10} textAnchor="middle" fontSize="10" fill="#6b7280">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

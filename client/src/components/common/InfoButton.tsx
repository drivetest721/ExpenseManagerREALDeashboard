/**
 * InfoButton — small circular "i" icon that reveals a tooltip on hover/click.
 * Click toggles for touch devices; mouseenter/leave handles desktop hover.
 * Drop into any heading row to provide contextual help.
 */
import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

interface InfoButtonProps {
  text: string;
  strLabel?: string;
  strPlacement?: 'top' | 'bottom' | 'left' | 'right';
  strSize?: 'sm' | 'md';
}

export function InfoButton({
  text,
  strLabel = 'More info',
  strPlacement = 'bottom',
  strSize = 'sm',
}: InfoButtonProps) {
  const [bOpen, setBOpen] = useState<boolean>(false);
  const refWrap = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    function fnClick(objEvt: MouseEvent) {
      if (refWrap.current && !refWrap.current.contains(objEvt.target as Node)) {
        setBOpen(false);
      }
    }
    if (bOpen) document.addEventListener('mousedown', fnClick);
    return () => document.removeEventListener('mousedown', fnClick);
  }, [bOpen]);

  const strBtn =
    strSize === 'md' ? 'w-6 h-6' : 'w-4 h-4';
  const strIcon =
    strSize === 'md' ? 'w-4 h-4' : 'w-3 h-3';

  const lsPos: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span ref={refWrap} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={strLabel}
        onClick={(e) => { e.stopPropagation(); setBOpen((b) => !b); }}
        onMouseEnter={() => setBOpen(true)}
        onMouseLeave={() => setBOpen(false)}
        className={`${strBtn} rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 inline-flex items-center justify-center border border-blue-200 cursor-pointer transition-colors`}
      >
        <Info className={strIcon} />
      </button>
      {bOpen && (
        <span
          role="tooltip"
          className={`absolute ${lsPos[strPlacement]} z-50 w-64 max-w-[calc(100vw-2rem)] bg-gray-900 text-white text-xs rounded-md shadow-lg px-3 py-2 pointer-events-none whitespace-normal leading-relaxed`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

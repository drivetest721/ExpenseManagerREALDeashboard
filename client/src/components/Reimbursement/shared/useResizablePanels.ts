/**
 * useResizablePanels — Shared left/center/right resizable panel widths,
 * collapse state, and divider mouse handlers.
 */
import { useEffect, useRef, useState } from 'react';

export function useResizablePanels(
  iInitialLeft = 45,
  iInitialCenter = 30,
) {
  const [iLeftWidth, setILeftWidth] = useState(iInitialLeft);
  const [iCenterWidth, setICenterWidth] = useState(iInitialCenter);
  const [bLeftCollapsed, setBLeftCollapsed] = useState(false);
  const [bRightCollapsed, setBRightCollapsed] = useState(false);
  const [bResizing, setBResizing] = useState<'left' | 'right' | null>(null);
  const refContainer = useRef<HTMLDivElement>(null);

  const handleMouseDown = (divider: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    setBResizing(divider);
  };

  useEffect(() => {
    if (!bResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!refContainer.current) return;
      const rect = refContainer.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const percentage = (offsetX / rect.width) * 100;

      if (bResizing === 'left') {
        setILeftWidth(Math.max(30, Math.min(60, percentage)));
      } else {
        setICenterWidth(Math.max(20, Math.min(50, percentage - iLeftWidth)));
      }
    };
    const handleMouseUp = () => setBResizing(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [bResizing, iLeftWidth]);

  const getActualLeftWidth = () => {
    if (bLeftCollapsed) return 0;
    if (bRightCollapsed) return 100 - iCenterWidth;
    return iLeftWidth;
  };
  const getActualCenterWidth = () => {
    if (bLeftCollapsed && bRightCollapsed) return 100;
    if (bLeftCollapsed) return iLeftWidth + iCenterWidth;
    if (bRightCollapsed) return 100 - iLeftWidth;
    return iCenterWidth;
  };
  const getActualRightWidth = () => {
    if (bRightCollapsed) return 0;
    if (bLeftCollapsed) return 100 - iCenterWidth;
    return 100 - iLeftWidth - iCenterWidth;
  };

  return {
    refContainer,
    bResizing,
    bLeftCollapsed,
    bRightCollapsed,
    toggleLeftCollapse: () => setBLeftCollapsed(v => !v),
    toggleRightCollapse: () => setBRightCollapsed(v => !v),
    handleMouseDown,
    getActualLeftWidth,
    getActualCenterWidth,
    getActualRightWidth,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function CustomScrollArea({
  children,
  className = "",
  viewportClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollThumb, setScrollThumb] = useState({
    visible: false,
    height: 0,
    top: 0,
  });

  const updateScrollThumb = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    if (scrollHeight <= clientHeight + 1) {
      setScrollThumb({ visible: false, height: 0, top: 0 });
      return;
    }

    const inset = 8;
    const trackHeight = clientHeight - inset * 2;
    const thumbHeight = Math.max(32, (clientHeight / scrollHeight) * trackHeight);
    const maxTop = Math.max(0, trackHeight - thumbHeight);
    const top =
      maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop;

    setScrollThumb({ visible: true, height: thumbHeight, top });
  }, []);

  useEffect(() => {
    updateScrollThumb();
    window.addEventListener("resize", updateScrollThumb);
    return () => window.removeEventListener("resize", updateScrollThumb);
  }, [children, updateScrollThumb]);

  return (
    <div className={`flex min-h-0 ${className}`}>
      <div
        ref={viewportRef}
        onScroll={updateScrollThumb}
        className={`hide-scrollbar min-w-0 flex-1 overflow-y-auto overscroll-contain ${viewportClassName}`}
      >
        {children}
      </div>
      <div className="relative w-5 shrink-0 py-2 pr-2">
        {scrollThumb.visible ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-2 w-1.5 rounded-full bg-accent-soft/80"
          >
            <div
              className="absolute w-full rounded-full bg-accent"
              style={{
                height: scrollThumb.height,
                top: scrollThumb.top,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

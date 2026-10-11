import { cn } from "cn";
import { Children, isValidElement, useCallback, useEffect, useRef } from "react";

interface RailProps {
  children: React.ReactNode;
  /** Width of each item, as Tailwind basis classes (e.g. "basis-28 sm:basis-32") */
  itemClassName: string;
  /** Room above and to the right for stickers that overlap a card's corner */
  overhang?: boolean;
  className?: string;
}

/** A pointer that moved further than this is a drag, and the click at its end is swallowed */
const DRAG_SLOP = 5;
/** Width of the fade on an edge with more content behind it */
const FADE = 72;
/** Scroll distance over which a fade grows from nothing to full, so it eases in */
const RAMP = 120;

/**
 * A mask fading out the edges with more content behind them. Each side's strength follows
 * how much is hidden there (0 at the very edge, 1 once RAMP pixels are hidden), so the fade
 * eases in and out with the scroll instead of switching on.
 */
const edgeMask = (left: number, right: number) => {
  if (!left && !right) return "";
  const l = `rgba(0,0,0,${(1 - left).toFixed(3)})`;
  const r = `rgba(0,0,0,${(1 - right).toFixed(3)})`;
  return `linear-gradient(to right, ${l} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${r} 100%)`;
};

/**
 * A horizontal row of cards or media on the browser's own scrolling: touch swipe and trackpad
 * gestures as the system does them, stopping wherever they stop, and no rubber band past the
 * ends. Mouse users get drag-to-scroll. An edge with more content behind it fades out.
 */
export function Rail({ children, itemClassName, overhang = false, className }: RailProps) {
  const items = Children.toArray(children).filter(isValidElement);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  // Written straight to the element on every scroll frame, no re-render
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const hiddenLeft = el.scrollLeft;
    const hiddenRight = el.scrollWidth - el.clientWidth - el.scrollLeft;
    const mask = edgeMask(
      Math.min(1, Math.max(0, hiddenLeft / RAMP)),
      Math.min(1, Math.max(0, hiddenRight / RAMP)),
    );
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, items.length]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        onScroll={update}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0 || !ref.current) return;
          drag.current = { x: event.clientX, left: ref.current.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          const el = ref.current;
          if (!state || !el) return;
          const dx = event.clientX - state.x;
          if (!state.moved && Math.abs(dx) < DRAG_SLOP) return;
          if (!state.moved) {
            state.moved = true;
            el.setPointerCapture(event.pointerId);
          }
          el.scrollLeft = state.left - dx;
        }}
        onPointerUp={() => {
          swallowClick.current = !!drag.current?.moved;
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onClickCapture={(event) => {
          // The mouse-up that ends a drag is not a click on the card under it
          if (swallowClick.current) {
            event.preventDefault();
            event.stopPropagation();
            swallowClick.current = false;
          }
        }}
        // No text selection and no image or link drag ghosts while dragging the row
        onDragStartCapture={(event) => event.preventDefault()}
        className={cn(
          "no-scrollbar flex gap-3 overflow-x-auto overscroll-x-none select-none",
          overhang && "-mx-3 -mt-3 px-3 pt-3 pb-1",
        )}
      >
        {items.map((child) => (
          <div key={child.key} className={cn("min-w-0 shrink-0", itemClassName)}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

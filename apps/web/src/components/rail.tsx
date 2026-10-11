import { cn } from "cn";
import { Children, isValidElement, useCallback, useEffect, useRef, useState } from "react";

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
/** Width of the fade on an edge that has more content behind it */
const FADE = "48px";

/** A mask that fades out the edges with more content behind them */
const edgeMask = (left: boolean, right: boolean) =>
  left || right
    ? `linear-gradient(to right, ${left ? "transparent" : "#000"} 0, #000 ${left ? FADE : "0px"}, #000 calc(100% - ${right ? FADE : "0px"}), ${right ? "transparent" : "#000"} 100%)`
    : undefined;

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
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, items.length]);

  const mask = edgeMask(edges.left, edges.right);
  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        onScroll={update}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
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

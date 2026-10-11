import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { cn } from "cn";
import { Children, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

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

const ARROW =
  "absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 border-border bg-background/90 text-foreground backdrop-blur hover:bg-card md:inline-flex";

/**
 * A horizontal row of cards or media on the browser's own scrolling: touch swipe and trackpad
 * gestures as the system does them, stopping wherever they stop, and no rubber band past the
 * ends. Mouse users get drag-to-scroll and prev/next arrows that page by what is visible and
 * hide at the ends.
 */
export function Rail({ children, itemClassName, overhang = false, className }: RailProps) {
  const { t } = useTranslation();
  const items = Children.toArray(children).filter(isValidElement);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, items.length]);

  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

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
      {canPrev && (
        <Button
          variant="outline"
          size="icon"
          aria-label={t("rail.previous")}
          onClick={() => page(-1)}
          className={cn(ARROW, "left-2")}
        >
          <ArrowLeftIcon />
        </Button>
      )}
      {canNext && (
        <Button
          variant="outline"
          size="icon"
          aria-label={t("rail.next")}
          onClick={() => page(1)}
          className={cn(ARROW, "right-2")}
        >
          <ArrowRightIcon />
        </Button>
      )}
    </div>
  );
}

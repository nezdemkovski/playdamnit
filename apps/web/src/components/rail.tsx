import { cn } from "cn";
import { Children, isValidElement } from "react";
import { useTranslation } from "react-i18next";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface RailProps {
  children: React.ReactNode;
  /** Width of each item, as Tailwind basis classes (e.g. "basis-28 sm:basis-32") */
  itemClassName: string;
  /** Room above and to the right for stickers that overlap a card's corner */
  overhang?: boolean;
  className?: string;
}

// Created once: Embla re-initialises when the plugins array changes identity
const WHEEL = [WheelGesturesPlugin()];

const ARROW =
  "top-1/2 hidden size-9 -translate-y-1/2 border-border bg-background/90 text-foreground backdrop-blur hover:bg-card disabled:pointer-events-none disabled:opacity-0 md:inline-flex";

/**
 * A horizontal row of cards or media (Embla through shadcn's Carousel): swipe on touch, the
 * trackpad and mouse drag on desktop, arrow buttons and arrow keys. Pages by what is visible
 * and always settles on a card edge; the arrows hide at the ends.
 */
export function Rail({ children, itemClassName, overhang = false, className }: RailProps) {
  const { t } = useTranslation();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <Carousel
      // Snaps to the left edge of a card, also at the end (no half-cut card on the left, a gap
      // on the right instead); no free drag that stops mid-card. The plugin adds horizontal
      // trackpad and wheel swipes, which Embla does not handle on its own
      opts={{ align: "start", slidesToScroll: "auto", containScroll: false }}
      plugins={WHEEL}
      // Dragging the row must not select text or pick up an image or link as a drag ghost
      onDragStartCapture={(event) => event.preventDefault()}
      className={cn("select-none", overhang && "-mx-3 -mt-3", className)}
    >
      <CarouselContent className={overhang ? "ml-0 pt-3 pr-3 pb-1" : "-ml-3"}>
        {items.map((child) => (
          <CarouselItem key={child.key} className={cn("pl-3", itemClassName)}>
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious
        variant="outline"
        aria-label={t("rail.previous")}
        className={cn(ARROW, overhang ? "left-5" : "left-2")}
      />
      <CarouselNext
        variant="outline"
        aria-label={t("rail.next")}
        className={cn(ARROW, overhang ? "right-5" : "right-2")}
      />
    </Carousel>
  );
}

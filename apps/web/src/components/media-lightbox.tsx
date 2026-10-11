import { PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Lightbox, type GenericSlide, type Slide } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import { MediaSlideType } from "@/lib/enums";
import { youtubeThumbnail } from "@/lib/image";

declare module "yet-another-react-lightbox" {
  interface YoutubeSlide extends GenericSlide {
    type: MediaSlideType.Youtube;
    videoId: string;
    title?: string;
  }
  interface SlideTypes {
    youtube: YoutubeSlide;
  }
}

export type MediaSlide = Slide;

const isYoutube = (slide: Slide): slide is Extract<Slide, { type: MediaSlideType.Youtube }> =>
  slide.type === MediaSlideType.Youtube;

/** The YouTube player, sized 16:9 inside the slide; only the current slide gets a live player */
function YoutubeSlideView({
  videoId,
  title,
  current,
  rect,
}: {
  videoId: string;
  title?: string;
  current: boolean;
  rect: { width: number; height: number };
}) {
  const width = Math.min(rect.width, (rect.height * 16) / 9);
  const height = (width * 9) / 16;
  return (
    <div style={{ width, height }} className="bg-black">
      {current ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title ?? ""}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      ) : (
        <img src={youtubeThumbnail(videoId)} alt="" className="size-full object-cover opacity-60" />
      )}
    </div>
  );
}

/**
 * Full-screen viewer for a game's screenshots, videos and covers: swipe and arrow keys,
 * pinch and wheel zoom on images, a thumbnail strip, captions and a counter. YouTube videos
 * play in place and stop when you move on.
 */
export function MediaLightbox({
  slides,
  index,
  onClose,
}: {
  slides: MediaSlide[];
  /** The slide to open at; -1 keeps it closed */
  index: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Lightbox
      open={index >= 0}
      index={Math.max(0, index)}
      close={onClose}
      slides={slides}
      plugins={[Thumbnails, Zoom, Captions, Counter, Fullscreen]}
      className="media-lightbox"
      carousel={{ finite: false, padding: "16px", spacing: "8%" }}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
      zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
      thumbnails={{
        width: 112,
        height: 63,
        border: 1,
        borderRadius: 0,
        padding: 0,
        gap: 8,
        imageFit: "cover",
        vignette: true,
      }}
      captions={{ descriptionTextAlign: "center" }}
      counter={{ container: { style: { top: 0, left: "50%", transform: "translateX(-50%)" } } }}
      labels={{
        Previous: t("lightbox.previous"),
        Next: t("lightbox.next"),
        Close: t("lightbox.close"),
        Lightbox: t("lightbox.label"),
        "Photo gallery": t("lightbox.gallery"),
        "{index} of {total}": t("lightbox.position"),
      }}
      render={{
        slide: ({ slide, offset, rect }) =>
          isYoutube(slide) ? (
            <YoutubeSlideView
              videoId={slide.videoId}
              title={slide.title}
              current={offset === 0}
              rect={rect}
            />
          ) : undefined,
        thumbnail: ({ slide }) =>
          isYoutube(slide) ? (
            <span className="relative block size-full">
              <img
                src={youtubeThumbnail(slide.videoId)}
                alt=""
                className="size-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <PlayIcon className="size-4 fill-white text-white" />
              </span>
            </span>
          ) : undefined,
      }}
    />
  );
}

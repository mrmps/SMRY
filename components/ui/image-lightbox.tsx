"use client";

import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "@/components/ui/icons";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ImageLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  const [visible, setVisible] = useState(false);
  const touchStartRef = useRef<number | null>(null);

  // Animate in when opened, animate out when closed
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    // Double rAF: first ensures the closed state paints, second triggers the transition
    let innerId: number | undefined;
    const id = requestAnimationFrame(() => {
      innerId = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(id);
      if (innerId !== undefined) cancelAnimationFrame(innerId);
      setVisible(false);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0)
        onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < images.length - 1)
        onNavigate(currentIndex + 1);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

  if (!mounted || images.length === 0) return null;

  const image = images[currentIndex];
  const hasMultiple = images.length > 1;

  // The portal is ALWAYS rendered (no mount/unmount dance).
  // CSS pointer-events controls interactivity; opacity handles visibility.
  return createPortal(
    <div
      className={`lightbox-overlay${visible ? " lightbox-visible" : ""}`}
      data-open={isOpen || undefined}
      onPointerDown={(e) => {
        // Only close if open and clicking the backdrop itself
        if (isOpen && e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        touchStartRef.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartRef.current === null || !hasMultiple) return;
        const diff = touchStartRef.current - e.changedTouches[0].clientX;
        touchStartRef.current = null;
        if (Math.abs(diff) > 60) {
          if (diff > 0 && currentIndex < images.length - 1)
            onNavigate(currentIndex + 1);
          else if (diff < 0 && currentIndex > 0)
            onNavigate(currentIndex - 1);
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {image && (
        <>
          <button
            className="lightbox-btn lightbox-close"
            onPointerDown={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {hasMultiple && (
            <span className="lightbox-counter">
              {currentIndex + 1} / {images.length}
            </span>
          )}

          {hasMultiple && currentIndex > 0 && (
            <button
              className="lightbox-btn lightbox-prev"
              onPointerDown={(e) => {
                e.stopPropagation();
                onNavigate(currentIndex - 1);
              }}
              aria-label="Previous image"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {hasMultiple && currentIndex < images.length - 1 && (
            <button
              className="lightbox-btn lightbox-next"
              onPointerDown={(e) => {
                e.stopPropagation();
                onNavigate(currentIndex + 1);
              }}
              aria-label="Next image"
            >
              <ChevronRight size={28} />
            </button>
          )}

          <figure
            className="lightbox-figure"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              className="lightbox-img"
              draggable={false}
            />
            {(image.caption || image.alt) && (
              <figcaption className="lightbox-caption">
                {image.caption || image.alt}
              </figcaption>
            )}
          </figure>
        </>
      )}
    </div>,
    document.body,
  );
}

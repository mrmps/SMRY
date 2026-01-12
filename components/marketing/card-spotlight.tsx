import { ReactNode, useRef, useState } from "react";

interface CardSpotlightProps {
  heading: string;
  body: string;
  icon: ReactNode;
}

export const CardSpotlight = ({ heading, body, icon }: CardSpotlightProps) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || isFocused) return;

    const div = divRef.current;
    const rect = div.getBoundingClientRect();

    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(1);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative max-w-xs rounded-lg border border-border/50 bg-surface-2 p-8 shadow-sm"
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-lg transition duration-500"
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, oklch(from var(--foreground) l c h / 0.12), transparent 40%)`,
        }}
      />
      <div className="flex flex-row gap-3">
      <div className="mb-4">
      <div className="rounded-md border border-border bg-surface-3 p-2">
        {icon}
        </div>
      </div>
      <h3 className="mt-1 font-medium tracking-tight text-foreground">
        {heading}
      </h3>
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
};

import { LockClosedIcon } from "@radix-ui/react-icons";
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
      className="relative max-w-xs rounded-lg border-[.5px] shadow-md border-zinc-200 bg-white p-8"
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-lg transition duration-500"
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, rgba(0, 0, 0, .25), transparent 40%)`,
        }}
      />
      <div className="flex flex-row gap-3">
      <div className="mb-4">
      <div className="p-2 bg-zinc-100 rounded-md border-stone-200 border">
        {icon} {/* Render the passed icon here */}
        </div>
      </div>
      <h3 className="mt-1 font-medium tracking-tight text-neutral-800">
        {heading}
      </h3>
      </div>
      <p className="text-sm text-neutral-600">{body}</p>
    </div>
  );
};

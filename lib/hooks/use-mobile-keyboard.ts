import { useEffect, useState } from "react";

interface KeyboardState {
  isOpen: boolean;
  height: number;
  viewportHeight: number;
}

export function useMobileKeyboard(): KeyboardState {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isOpen: false,
    height: 0,
    viewportHeight: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;
    const windowHeight = window.innerHeight;

    const updateKeyboardState = () => {
      const currentHeight = viewport.height;
      const heightDiff = windowHeight - currentHeight;
      
      const isOpen = heightDiff > 150;
      const height = isOpen ? heightDiff : 0;

      setKeyboardState({ 
        isOpen, 
        height,
        viewportHeight: currentHeight,
      });
    };

    updateKeyboardState();

    viewport.addEventListener("resize", updateKeyboardState);
    viewport.addEventListener("scroll", updateKeyboardState);

    return () => {
      viewport.removeEventListener("resize", updateKeyboardState);
      viewport.removeEventListener("scroll", updateKeyboardState);
    };
  }, []);

  return keyboardState;
}

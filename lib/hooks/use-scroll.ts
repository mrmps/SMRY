"use client"

import { useCallback, useEffect, useState, useRef } from 'react';

export default function useScroll() {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  const onScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const lastY = lastScrollY.current;

    if (currentScrollY > lastY && currentScrollY > 10) {
      setVisible(false); // Hide when scrolling down
    } else if (currentScrollY < lastY) {
      setVisible(true); // Show when scrolling up
    }
    
    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  return visible;
}

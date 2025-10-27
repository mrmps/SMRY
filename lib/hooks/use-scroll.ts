"use client"

import { useCallback, useEffect, useState } from 'react';

export default function useScroll() {
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const onScroll = useCallback(() => {
    const currentScrollY = window.scrollY;

    if (currentScrollY > lastScrollY) {
      setVisible(false); // Hide when scrolling down
    } else {
      setVisible(true); // Show when scrolling up
    }
    
    setLastScrollY(currentScrollY);
  }, [lastScrollY]);

  useEffect(() => {
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  return visible;
}

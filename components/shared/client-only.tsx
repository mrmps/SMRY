"use client"

import { ReactNode, useEffect, useState } from "react";

export const ClientOnly = ({ children }: { children: ReactNode }) => {
  const [clientReady, setClientReady] = useState<boolean>(false);

  useEffect(() => {
    // Use a timeout to avoid setting state synchronously
    const timer = setTimeout(() => {
      setClientReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return clientReady ? <>{children}</> : null;
};
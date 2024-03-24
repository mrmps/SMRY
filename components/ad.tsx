"use client";
import { track } from '@vercel/analytics';

import React from "react";
import { XIcon } from "lucide-react";

const Ad = () => {
  const [showAd, setShowAd] = React.useState(true);
  return (
    showAd ? (
      <div className="fixed bottom-0 right-0 z-50" id="ad">
        <div className="mr-4 md:mr-12 px-4 py-2 md:pr-8 bg-stone-100 rounded-lg rounded-b-none border border-stone-300 text-stone-600 text-sm relative">
          <button 
            onClick={() => {
              track('ad click');
              setShowAd(false);
            }} 
            className="absolute top-[8px] right-1"
          >
            <XIcon size={16} />
          </button>
          <h1 className="font-bold">
            smry.ai -{" "}
            <span className="font-normal">Never get stuck writing again. Checkout{" "}
            <a
              className="font-bold underline"
              href="https://myjotbot.com/?aff=smry"
              target="_blank"
              rel="noopener noreferrer"
            >
              Jotbot, an AI writing assistant
            </a>
            </span>
          </h1>
        </div>
      </div>
    ) : null
  );
};

export default Ad;
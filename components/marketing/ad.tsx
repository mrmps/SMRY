"use client";

import React from "react";
import { XIcon } from "lucide-react";

interface AdProps {
  link: string;
  adStart: string;
  adEnd: string;
}

const Ad: React.FC<AdProps> = ({ link, adStart, adEnd }) => {
  const [showAd, setShowAd] = React.useState(true);
  return (
    showAd ? (
      <div className="fixed bottom-0 right-0 z-50" id="ad">
        <div className="relative mr-4 rounded-lg rounded-b-none border border-stone-300 bg-stone-100 px-4 py-2 text-sm text-stone-600 md:mr-12 md:pr-8">
          <button
            onClick={() => setShowAd(false)}
            className="absolute right-1 top-[8px]"
          >
            <XIcon size={16} />
          </button>
          <h1 className="font-bold">
            smry.ai -{" "}
            <span className="font-normal">{adStart}{" "}
            <a
              className="font-bold underline"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {adEnd}
            </a>
            </span>
          </h1>
        </div>
      </div>
    ) : null
  );
};

export default Ad;
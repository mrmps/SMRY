"use client";

import React, { useEffect, useState } from "react";
import { Source } from "@/lib/data";

interface ArticleLengthProps {
  url: string;
  source: Source;
}

export const ArticleLength = ({ url, source }: ArticleLengthProps) => {
  const [length, setLength] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchArticleLength = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/article?url=${encodeURIComponent(url)}&source=${source}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        setLength(data.article?.length || 0);
      } catch (err) {
        console.error(err);
        setLength(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticleLength();
  }, [url, source]);

  if (isLoading) {
    return <span> · loading...</span>;
  }

  return <span> · {length || 0} words</span>;
};

export default ArticleLength;

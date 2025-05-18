"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { fetchArticleContent, fetchArticleLength } from '@/lib/proxy-api';
import { Article, ArticleLength } from '@/lib/types';

interface ProxyContextType {
  activeSource: string;
  setActiveSource: (source: string) => void;
  sources: string[];
  articleData: Record<string, Article | null>;
  articleLengths: Record<string, ArticleLength | null>;
  loading: Record<string, boolean>;
  error: Record<string, Error | null>;
  fetchArticleForSource: (source: string, url: string) => Promise<void>;
}

const ProxyContext = createContext<ProxyContextType | null>(null);

export const useProxyContext = () => {
  const context = useContext(ProxyContext);
  if (!context) {
    throw new Error('useProxyContext must be used within a ProxyProvider');
  }
  return context;
};

interface ProxyProviderProps {
  children: React.ReactNode;
  availableSources: string[];
  initialUrl?: string;
}

export const ProxyProvider: React.FC<ProxyProviderProps> = ({ 
  children, 
  availableSources,
  initialUrl 
}) => {
  const [activeSource, setActiveSource] = useState<string>(availableSources[0]);
  const [articleData, setArticleData] = useState<Record<string, Article | null>>({});
  const [articleLengths, setArticleLengths] = useState<Record<string, ArticleLength | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, Error | null>>({});
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);

  // Fetch article content and length for a specific source
  const fetchArticleForSource = useCallback(async (source: string, url: string) => {
    if (!url) return;
    
    // Skip if already loaded for this url
    if (articleData[source] && lastFetchedUrl === url) return;
    
    // Set loading state for this source
    setLoading(prev => ({ ...prev, [source]: true }));
    setError(prev => ({ ...prev, [source]: null }));
    
    try {
      // Fetch article content
      const contentPromise = fetchArticleContent(url, source);
      // Fetch article length
      const lengthPromise = fetchArticleLength(url, source);
      
      // Wait for both fetches to complete
      const [content, length] = await Promise.all([contentPromise, lengthPromise]);
      
      // Update states
      setArticleData(prev => ({ ...prev, [source]: content }));
      setArticleLengths(prev => ({ ...prev, [source]: length }));
      setLastFetchedUrl(url);
    } catch (err) {
      console.error(`Error fetching from ${source}:`, err);
      setError(prev => ({ ...prev, [source]: err as Error }));
    } finally {
      setLoading(prev => ({ ...prev, [source]: false }));
    }
  }, [articleData, lastFetchedUrl]);

  // Fetch initial data if URL is provided
  React.useEffect(() => {
    if (initialUrl) {
      availableSources.forEach(source => {
        fetchArticleForSource(source, initialUrl);
      });
    }
  }, [initialUrl, availableSources, fetchArticleForSource]);

  // Create memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    activeSource,
    setActiveSource,
    sources: availableSources,
    articleData,
    articleLengths,
    loading,
    error,
    fetchArticleForSource,
  }), [
    activeSource, 
    availableSources,
    articleData,
    articleLengths,
    loading,
    error,
    fetchArticleForSource
  ]);

  return (
    <ProxyContext.Provider value={contextValue}>
      {children}
    </ProxyContext.Provider>
  );
}; 
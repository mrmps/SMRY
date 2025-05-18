"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ErrorBoundary from "@/components/error";
import { ResponsiveDrawer } from "@/components/responsiveDrawer";
import Ad from "@/components/ad";
import SummaryForm from "@/components/summary-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Main page component
export default function Page() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || "";
  const [ip, setIp] = useState("default_ip");
  const [showAd, setShowAd] = useState(false);
  const [adData, setAdData] = useState(adCopies[0]);
  const [activeTab, setActiveTab] = useState("smry");
  
  // Data states for all sources
  const [articleData, setArticleData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({
    direct: true,
    archive: true,
    wayback: true,
    "jina.ai": true
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  
  // Define sources and their display names
  const sources = useMemo(() => ["smry", "archive", "wayback", "jina.ai"], []);
  const sourceMapping = useMemo(() => ({
    smry: "direct",
    archive: "archive",
    wayback: "wayback",
    "jina.ai": "jina.ai"
  }), []);
  // Handle tab changes
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);
  
  // Fetch article data for all sources simultaneously
  useEffect(() => {
    if (!url) return;
    
    // Set client IP
    setIp("client_ip");
    
    // Select random ad
    const adSelection = Math.floor(Math.random() * adCopies.length);
    setAdData(adCopies[adSelection]);
    setShowAd(true);
    
    // Fetch data for all sources
    const fetchAllSources = async () => {
      // Create fetch promises for all sources
      const fetchPromises = sources.map(source => {
        const apiSource = sourceMapping[source as keyof typeof sourceMapping];
        return fetch(`/api/article?url=${encodeURIComponent(url)}&source=${apiSource}`)
          .then(response => {
            if (!response.ok) {
              // Instead of throwing an error, handle it gracefully
              return { error: `HTTP error! Status: ${response.status}` };
            }
            return response.json();
          })
          .then(data => {
            // Check if we have an error object
            if (data.error) {
              setErrors(prev => ({
                ...prev,
                [apiSource]: data.error
              }));
              setIsLoading(prev => ({
                ...prev,
                [apiSource]: false
              }));
              return;
            }
            
            // Store data for this source
            setArticleData(prev => ({
              ...prev,
              [apiSource]: data
            }));
            setIsLoading(prev => ({
              ...prev,
              [apiSource]: false
            }));
          })
          .catch(err => {
            console.error(`Error fetching from ${apiSource}:`, err);
            setErrors(prev => ({
              ...prev,
              [apiSource]: err.message || "Failed to load content"
            }));
            setIsLoading(prev => ({
              ...prev,
              [apiSource]: false
            }));
          });
      });
      
      // Execute all fetches in parallel
      await Promise.allSettled(fetchPromises);
    };
    
    fetchAllSources();
  }, [url, sources, sourceMapping]);
  
  // Early return for invalid URL
  if (!url) {
    return <div className="mt-20">URL parameter is missing or invalid</div>;
  }

  // Blocked sites
  if (url.includes("orlandosentinel.com")) {
    return <div className="mt-20">Sorry, articles from the orlando sentinel are not available</div>;
  }

  // Function to get display name for the source
  const getSourceDisplayName = (source: string): string => {
    if (source === 'archive') return 'archive (slow)';
    return source;
  };

  // Function to render article content for a source
  const renderArticleContent = (source: string) => {
    const apiSource = sourceMapping[source as keyof typeof sourceMapping];
    const content = articleData[apiSource];
    
    if (isLoading[apiSource]) {
      return <Skeleton className="h-40 rounded-lg animate-pulse bg-zinc-200" />;
    }
    if (errors[apiSource] || !content) {
      return (
        <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
          <p className="font-medium mb-1">Unable to load content</p>
          <p className="text-sm">{errors[apiSource] || "Content unavailable for this source"}</p>
          <p className="text-xs mt-2">Try another source or refresh the page</p>
        </div>
      );
    }
    return (
      <div className="mt-4">
        <article>
          {content.article?.title && <h1>{content.article.title}</h1>}
          {content.article?.content ? (
            <div
              className="max-w-full overflow-wrap break-words mt-4"
              dangerouslySetInnerHTML={{ __html: content.article.content }}
            />
          ) : (
            <div className="mt-4">Content not available.</div>
          )}
        </article>
      </div>
    );
  };
  
  // Function to render article length for a source
  const renderArticleLength = (source: string) => {
    const apiSource = sourceMapping[source as keyof typeof sourceMapping];
    const content = articleData[apiSource];
    
    if (isLoading[apiSource]) {
      return <span> · loading...</span>;
    }
    
    return <span> · {content?.article?.length || 0} words</span>;
  };

  return (
    <div className="mt-20">
      {showAd && (
        <Ad
          link={adData.link}
          onClickTrack={adData.onClickTrack}
          adStart={adData.adStart}
          adEnd={adData.adEnd}
        />
      )}

      <div className="px-4 py-8 md:py-12 mt-20">
        <div className="mx-auto space-y-10 max-w-prose">
          <main className="prose">
            <div className="flex items-center justify-between bg-[#FBF8FB] p-2 rounded-lg shadow-sm mb-4 border-zinc-100 border">
              <h2 className="ml-4 mt-0 mb-0 text-sm font-semibold text-gray-600">
                Get AI-powered key points
              </h2>
              <ResponsiveDrawer>
                <div className="remove-all">
                  <SummaryForm urlProp={url} ipProp={ip} />
                </div>
              </ResponsiveDrawer>
            </div>

            <ErrorBoundary fallback={<div>Error loading content. Please refresh the page.</div>}>
              <Tabs 
                value={activeTab} 
                onValueChange={handleTabChange} 
                className="w-full"
              >
                <div className="border border-zinc-200 rounded-md shadow-sm p-1 mb-2">
                  <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${sources.length}, 1fr)` }}>
                    {sources.map((source) => (
                      <TabsTrigger key={source} value={source} className="whitespace-nowrap">
                        {getSourceDisplayName(source)}
                        {renderArticleLength(source)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                
                {sources.map((source) => (
                  <TabsContent key={source} value={source}>
                    {renderArticleContent(source)}
                  </TabsContent>
                ))}
              </Tabs>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}

// Ad selection
const adCopies = [
  {
    onClickTrack: "Enjoy the freedom of reading without barriers, buy me a coffee! click",
    adStart: "Enjoy the freedom of reading without barriers, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Love instant summaries? Keep us going with a coffee! click",
    adStart: "Love instant summaries? ",
    adEnd: "Keep us going with a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Unlock premium content effortlessly, buy me a coffee! click",
    adStart: "Unlock premium content effortlessly, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Support our ad-free experience, buy me a coffee! click",
    adStart: "Support our ad-free experience, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack:
      "Keep enjoying clutter-free summaries, buy me a coffee! click",
    adStart: "Keep enjoying clutter-free summaries, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Enjoy ad-free summaries? Buy me a coffee! click",
    adStart: "Enjoy ad-free summaries? ",
    adEnd: "Buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
];

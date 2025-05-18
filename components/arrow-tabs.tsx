"use client";

import React, { memo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SimplifiedTabsProps {
  sources: string[];
  contentComponents: Record<string, React.ReactNode>;
  lengthComponents: Record<string, React.ReactNode>;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

/**
 * A simplified tabs component that uses standard UI tabs without complex scrolling logic
 */
const SimplifiedTabs: React.FC<SimplifiedTabsProps> = ({ 
  sources, 
  contentComponents,
  lengthComponents,
  activeTab,
  onTabChange
}) => {
  // Use either controlled or uncontrolled mode
  const actualActiveTab = activeTab || sources[0];
  const handleTabChange = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Function to get display name for the source
  const getSourceDisplayName = (source: string): string => {
    if (source === 'archive') return 'archive (slow)';
    return source;
  };

  return (
    <Tabs 
      value={actualActiveTab} 
      onValueChange={handleTabChange} 
      className="w-full"
    >
      <div className="border border-zinc-200 rounded-md shadow-sm p-1 mb-2">
        <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${sources.length}, 1fr)` }}>
          {sources.map((source) => (
            <TabsTrigger key={source} value={source} className="whitespace-nowrap">
              {getSourceDisplayName(source)}
              {lengthComponents[source]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      
      {sources.map((source) => (
        <TabsContent key={source} value={source}>
          {contentComponents[source]}
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default memo(SimplifiedTabs);

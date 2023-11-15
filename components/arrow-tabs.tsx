"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const EnhancedTabsList: React.FC<{
  sources: TabProps["sources"];
  activeTabIndex: number;
  setActiveTabIndex: (tabIndex: number) => void;
}> = ({ sources, activeTabIndex, setActiveTabIndex }) => {
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToActiveTab = useCallback(() => {
    if (tabsContainerRef.current) {
      const allTabs: NodeListOf<HTMLElement> =
        tabsContainerRef.current.querySelectorAll('[role="tab"]');
      const activeTab = allTabs[activeTabIndex];

      if (activeTab) {
        let cumulativeWidth = 0;

        // Calculate the cumulative width of all tabs before the active tab
        for (let i = 0; i < activeTabIndex; i++) {
          cumulativeWidth += allTabs[i].offsetWidth;
        }

        // Adjust by the desired offset (40 in this case) if it's not the first tab
        const desiredScrollPosition =
          cumulativeWidth - (activeTabIndex > 0 ? 40 : 0);

        // Set the scroll position
        tabsContainerRef.current.scrollTo({
          left: desiredScrollPosition,
          behavior: "smooth",
        });
      }
    }
  }, [activeTabIndex, tabsContainerRef]);

  useEffect(() => {
    scrollToActiveTab();
  }, [activeTabIndex, scrollToActiveTab]);

  const handleScrollAndSwitch = (direction: "left" | "right") => {
    if (tabsContainerRef.current) {

      const newIndex =
        direction === "right" ? activeTabIndex + 1 : activeTabIndex - 1;

      if (newIndex >= 0 && newIndex < sources.length) {
        setActiveTabIndex(newIndex);
        scrollToActiveTab();
        console.log("Switched to tab with index:", newIndex);
      } else {
        console.log("New index out of bounds:", newIndex);
      }
    }
  };

  return (
    <div className="relative border border-zinc-200 rounded-md shadow-sm p-1">
      {activeTabIndex > 0 && ( // Only display the left button if it's not the first tab
        <button
          onClick={() => handleScrollAndSwitch("left")}
          style={{
            appearance: "auto",
            backgroundAttachment: "scroll",
            backgroundClip: "border-box",
            backgroundColor: "rgba(0, 0, 0, 0)",
            backgroundImage:
              "linear-gradient(to right, rgb(245, 244, 244) 0%, rgba(245, 244, 244, 0) 100%)",
            backgroundOrigin: "padding-box",
            backgroundPosition: "0% 0%",
            backgroundRepeat: "repeat",
            backgroundSize: "auto",
            border: "none",
            boxSizing: "border-box",
            color: "#000",
            cursor: "pointer",
            fontSize: "18px",
            height: "30px",
            left: "4px",
            lineHeight: "normal",
            padding: "0",
            position: "absolute",
            top: "8px",
            width: "65px",
            zIndex: 10,
          }}
          aria-label="Scroll left"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <motion.div
        ref={tabsContainerRef}
        className="overflow-x-auto whitespace-nowrap scrollbar-hide"
      >
        <TabsList>
          {sources.map((source, index) => (
            <TabsTrigger key={index} value={index.toString()}>
             <span>
                {source}
             </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </motion.div>

      {activeTabIndex < sources.length - 1 && ( // Only display the right button if it's not the last tab
        <button
          onClick={() => handleScrollAndSwitch("right")}
          className="absolute right-1"
          style={{
            appearance: "auto",
            backgroundAttachment: "scroll",
            backgroundClip: "border-box",
            backgroundColor: "rgba(0, 0, 0, 0)",
            backgroundImage:
              "linear-gradient(to left, rgb(245, 244, 244) 0%, rgba(245, 244, 244, 0) 100%)",
            backgroundOrigin: "padding-box",
            backgroundPosition: "0% 0%",
            backgroundRepeat: "repeat",
            backgroundSize: "auto",
            border: "none",
            boxSizing: "border-box",
            color: "#000",
            cursor: "pointer",
            fontSize: "18px",
            height: "30px",
            lineHeight: "normal",
            padding: "0",
            position: "absolute",
            top: "8px",
            width: "65px",
            zIndex: 10,
          }}
          aria-label="Scroll right"
        >
          <ChevronRight size={24} className="float-right" />
        </button>
      )}
    </div>
  );
};

interface TabProps {
  sources: string[];
  innerHTML: React.ReactNode[];
}

const ArrowTabs: React.FC<TabProps> = ({ sources, innerHTML }) => {
  const initialTabIndex = 0;
  const [activeTabIndex, setActiveTabIndex] = useState(initialTabIndex);

  return (
    <Tabs
      defaultValue={initialTabIndex.toString()}
      value={JSON.stringify(activeTabIndex)}
      onValueChange={(value: string) => setActiveTabIndex(parseInt(value))}
    >
      <EnhancedTabsList
        sources={sources}
        activeTabIndex={activeTabIndex}
        setActiveTabIndex={setActiveTabIndex}
      />

      {sources.map((_, index) => (
        <TabsContent key={index} value={index.toString()}>
          <Suspense fallback={<div>Loading...</div>}>
            {/* Ensure that the content you are rendering here is capable of being suspended */}
            {innerHTML[activeTabIndex]}
          </Suspense>
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default ArrowTabs;

"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Download,
  Copy,
  Check,
  FileText,
  X,
} from "@/components/ui/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer as DrawerPrimitive } from "vaul-base";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import type { Highlight, ArticleHighlights } from "@/lib/hooks/use-highlights";
import { useAnalytics } from "@/lib/hooks/use-analytics";

// Icons for each export target
function NotionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 2.03c-.42-.326-.98-.7-2.055-.607L3.01 2.75c-.467.046-.56.28-.374.466l1.823.992zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933l3.222-.187zM2.874.048L16.72-.933c1.682-.14 2.1.047 2.8.56l3.876 2.75c.513.374.7.7.7 1.167v17.29c0 1.074-.374 1.681-1.682 1.775l-15.457.933c-.98.047-1.448-.093-1.962-.747L1.06 17.79c-.56-.747-.793-1.307-.793-1.961V1.775C.267.748.641.141 2.874.048z"/>
    </svg>
  );
}

function ObsidianIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.003.586a1.5 1.5 0 0 0-1.236.39l-9.063 7.99a1.5 1.5 0 0 0-.45 1.625l3.525 9.854a1.5 1.5 0 0 0 1.174.969l10.12 1.567a1.5 1.5 0 0 0 1.48-.593l5.752-7.99a1.5 1.5 0 0 0-.155-1.938L13.52.97a1.5 1.5 0 0 0-1.517-.384z"/>
    </svg>
  );
}

function RoamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  );
}

type ExportFormat = "notion" | "obsidian" | "roam" | "markdown" | "json";

interface ExportHighlightsProps {
  highlights: Highlight[];
  articleUrl?: string;
  articleTitle?: string;
  allHighlights?: ArticleHighlights[];
}

export function ExportHighlights({
  highlights,
  articleUrl,
  articleTitle,
  allHighlights,
}: ExportHighlightsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<ExportFormat | null>(null);
  const isDesktop = useIsDesktop();
  const { track, markFeatureUsed } = useAnalytics();

  const highlightsToExport = useMemo(() => {
    if (allHighlights) return allHighlights;
    if (highlights.length > 0) {
      return [{
        articleUrl: articleUrl || "",
        articleTitle,
        highlights,
        updatedAt: new Date().toISOString(),
      }];
    }
    return [];
  }, [allHighlights, highlights, articleUrl, articleTitle]);

  const totalHighlights = highlightsToExport.reduce(
    (sum, a) => sum + a.highlights.length,
    0
  );

  const generateNotionMarkdown = useCallback((): string => {
    const lines: string[] = [];
    for (const article of highlightsToExport) {
      if (article.highlights.length === 0) continue;
      lines.push(`## ${article.articleTitle || "Untitled Article"}`);
      lines.push(`Source: ${article.articleUrl}`);
      lines.push("");
      for (const hl of article.highlights) {
        lines.push(`> ${hl.text}`);
        if (hl.note) { lines.push(`> `); lines.push(`> **Note:** ${hl.note}`); }
        lines.push("");
      }
      lines.push("---"); lines.push("");
    }
    return lines.join("\n");
  }, [highlightsToExport]);

  const generateObsidianMarkdown = useCallback((): string => {
    const lines: string[] = [];
    for (const article of highlightsToExport) {
      if (article.highlights.length === 0) continue;
      lines.push("---");
      lines.push(`title: "${(article.articleTitle || "Untitled").replace(/"/g, '\\"')}"`);
      lines.push(`source: "${article.articleUrl}"`);
      lines.push(`type: highlight`);
      lines.push(`date: ${new Date().toISOString().split("T")[0]}`);
      lines.push("tags:"); lines.push("  - highlights"); lines.push("  - smry");
      lines.push("---"); lines.push("");
      lines.push(`# ${article.articleTitle || "Untitled Article"}`); lines.push("");
      lines.push(`[Original Source](${article.articleUrl})`); lines.push("");
      lines.push("## Highlights"); lines.push("");
      for (const hl of article.highlights) {
        lines.push(`> [!quote] #highlight/${hl.color}`);
        lines.push(`> ${hl.text}`);
        if (hl.note) { lines.push(`>`); lines.push(`> **Note:** ${hl.note}`); }
        lines.push("");
      }
      lines.push("---"); lines.push("");
    }
    return lines.join("\n");
  }, [highlightsToExport]);

  const generateRoamMarkdown = useCallback((): string => {
    const lines: string[] = [];
    for (const article of highlightsToExport) {
      if (article.highlights.length === 0) continue;
      lines.push(`- [[${article.articleTitle || "Untitled Article"}]]`);
      lines.push(`  - Source:: ${article.articleUrl}`);
      lines.push(`  - Type:: [[highlight]]`);
      lines.push(`  - Date:: [[${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}]]`);
      lines.push(`  - Highlights::`);
      for (const hl of article.highlights) {
        lines.push(`    - "${hl.text}" #[[${hl.color}]]`);
        if (hl.note) lines.push(`      - Note:: ${hl.note}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }, [highlightsToExport]);

  const generateMarkdown = useCallback((): string => {
    const lines: string[] = [];
    lines.push("# Highlights from smry.ai"); lines.push("");
    lines.push(`Exported on ${new Date().toLocaleDateString()}`); lines.push("");
    for (const article of highlightsToExport) {
      if (article.highlights.length === 0) continue;
      lines.push(`## ${article.articleTitle || "Untitled Article"}`);
      lines.push(`[${article.articleUrl}](${article.articleUrl})`); lines.push("");
      for (const hl of article.highlights) {
        lines.push(`> ${hl.text}`);
        if (hl.note) { lines.push(`> `); lines.push(`> *${hl.note}*`); }
        lines.push("");
      }
      lines.push("---"); lines.push("");
    }
    return lines.join("\n");
  }, [highlightsToExport]);

  const generateJSON = useCallback((): string => {
    return JSON.stringify(highlightsToExport, null, 2);
  }, [highlightsToExport]);

  const handleCopy = useCallback(async (format: ExportFormat) => {
    let content: string;
    switch (format) {
      case "notion": content = generateNotionMarkdown(); break;
      case "obsidian": content = generateObsidianMarkdown(); break;
      case "roam": content = generateRoamMarkdown(); break;
      case "markdown": content = generateMarkdown(); break;
      case "json": content = generateJSON(); break;
    }
    try {
      await navigator.clipboard.writeText(content);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
      toast.success("Copied to clipboard");
      track("highlights_exported", { format, method: "copy", highlight_count: totalHighlights });
      markFeatureUsed("export_highlights");
    } catch {
      toast.error("Failed to copy");
    }
  }, [generateNotionMarkdown, generateObsidianMarkdown, generateRoamMarkdown, generateMarkdown, generateJSON, track, markFeatureUsed, totalHighlights]);

  const handleDownload = useCallback((format: ExportFormat) => {
    let content: string;
    let filename: string;
    let mimeType: string;
    const baseName = articleTitle
      ? articleTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 50)
      : "highlights";
    switch (format) {
      case "notion": content = generateNotionMarkdown(); filename = `${baseName}-notion.md`; mimeType = "text/markdown"; break;
      case "obsidian": content = generateObsidianMarkdown(); filename = `${baseName}.md`; mimeType = "text/markdown"; break;
      case "roam": content = generateRoamMarkdown(); filename = `${baseName}-roam.md`; mimeType = "text/markdown"; break;
      case "markdown": content = generateMarkdown(); filename = `${baseName}.md`; mimeType = "text/markdown"; break;
      case "json": content = generateJSON(); filename = `${baseName}.json`; mimeType = "application/json"; break;
    }
    const blob = new Blob([content], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(blobUrl);
    track("highlights_exported", { format, method: "download", highlight_count: totalHighlights });
    markFeatureUsed("export_highlights");
  }, [articleTitle, generateNotionMarkdown, generateObsidianMarkdown, generateRoamMarkdown, generateMarkdown, generateJSON, track, markFeatureUsed, totalHighlights]);

  const exportOptions: { format: ExportFormat; name: string; icon: React.ReactNode; description: string; }[] = [
    { format: "notion", name: "Notion", icon: <NotionIcon className="size-5" />, description: "Paste directly into Notion" },
    { format: "obsidian", name: "Obsidian", icon: <ObsidianIcon className="size-5" />, description: "With frontmatter and callouts" },
    { format: "roam", name: "Roam Research", icon: <RoamIcon className="size-5" />, description: "With [[page links]] format" },
    { format: "markdown", name: "Markdown", icon: <FileText className="size-5" />, description: "Standard markdown format" },
  ];

  if (totalHighlights === 0) return null;

  const triggerButton = (
    <button
      onClick={() => setOpen(true)}
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
    >
      <Download className="size-4" />
      Export
    </button>
  );

  const exportContent = (
    <div className="space-y-2 px-4 pb-4">
      {exportOptions.map((option) => (
        <div
          key={option.format}
          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground">{option.icon}</div>
            <div>
              <p className="font-medium text-sm">{option.name}</p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => handleCopy(option.format)} className="h-8 px-2">
              {copied === option.format ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDownload(option.format)} className="h-8 px-2">
              <Download className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <div className="pt-2 border-t">
        <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground" onClick={() => handleDownload("json")}>
          <span className="text-xs">Export as JSON (for developers)</span>
          <Download className="size-3" />
        </Button>
      </div>
    </div>
  );

  // Mobile: Vaul bottom drawer with drag handle
  if (isDesktop === false) {
    return (
      <>
        {triggerButton}
        <DrawerPrimitive.Root open={open} onOpenChange={setOpen} direction="bottom" shouldScaleBackground={false} modal={true}>
          <DrawerPrimitive.Portal>
            <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
            <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background border-t border-border rounded-t-2xl max-h-[85dvh]">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 shrink-0" data-vaul-no-drag>
                <div>
                  <h2 className="text-[15px] font-semibold">Export Highlights</h2>
                  <p className="text-[13px] text-muted-foreground">
                    {totalHighlights} highlight{totalHighlights !== 1 ? "s" : ""} from{" "}
                    {highlightsToExport.length} article{highlightsToExport.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="size-10 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted transition-colors -mr-1"
                  aria-label="Close"
                >
                  <X className="size-4.5" />
                </button>
              </div>

              <div className="h-px bg-border/30 mx-4 shrink-0" />

              {/* Scrollable content */}
              <div className="overflow-y-auto pt-3" data-vaul-no-drag style={{ touchAction: "pan-y", paddingBottom: "max(env(safe-area-inset-bottom, 12px), 12px)" }}>
                {exportContent}
              </div>
            </DrawerPrimitive.Content>
          </DrawerPrimitive.Portal>
        </DrawerPrimitive.Root>
      </>
    );
  }

  // Desktop / SSR fallback: uncontrolled Dialog
  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3">
        <Download className="size-4" />
        Export
      </DialogTrigger>
      <DialogPopup className="sm:max-w-md max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle>Export Highlights</DialogTitle>
          <DialogDescription>
            {totalHighlights} highlight{totalHighlights !== 1 ? "s" : ""} from{" "}
            {highlightsToExport.length} article{highlightsToExport.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>
        {exportContent}
      </DialogPopup>
    </Dialog>
  );
}

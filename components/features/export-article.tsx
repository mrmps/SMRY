"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Download,
  Copy,
  Check,
  FileText,
} from "@/components/ui/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

export interface ArticleExportData {
  title?: string;
  url: string;
  byline?: string;
  textContent?: string;
  content?: string;
  siteName?: string;
  publishedTime?: string;
  lang?: string;
}

/**
 * Standalone export content panel (no dialog/drawer wrapper).
 * Embeds in Share popover/drawer as an inline view.
 */
export function ExportArticleContent({ data }: { data: ArticleExportData }) {
  const [copied, setCopied] = useState<ExportFormat | null>(null);

  const title = data.title || "Untitled Article";

  const generateNotionMarkdown = useCallback((): string => {
    const lines: string[] = [];
    lines.push(`## ${title}`);
    lines.push(`Source: ${data.url}`);
    if (data.byline) lines.push(`Author: ${data.byline}`);
    lines.push("");
    if (data.textContent) {
      lines.push(data.textContent);
      lines.push("");
    }
    return lines.join("\n");
  }, [title, data.url, data.byline, data.textContent]);

  const generateObsidianMarkdown = useCallback((): string => {
    const lines: string[] = [];
    lines.push("---");
    lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
    lines.push(`source: "${data.url}"`);
    if (data.byline) lines.push(`author: "${data.byline.replace(/"/g, '\\"')}"`);
    if (data.siteName) lines.push(`site: "${data.siteName.replace(/"/g, '\\"')}"`);
    if (data.publishedTime) lines.push(`date: ${data.publishedTime.split("T")[0]}`);
    if (data.lang) lines.push(`lang: ${data.lang}`);
    lines.push("tags:"); lines.push("  - article"); lines.push("  - smry");
    lines.push("---"); lines.push("");
    lines.push(`# ${title}`); lines.push("");
    if (data.textContent) {
      lines.push(data.textContent);
      lines.push("");
    }
    return lines.join("\n");
  }, [title, data.url, data.byline, data.siteName, data.publishedTime, data.lang, data.textContent]);

  const generateRoamMarkdown = useCallback((): string => {
    const lines: string[] = [];
    lines.push(`- [[${title}]]`);
    lines.push(`  - Source:: ${data.url}`);
    if (data.byline) lines.push(`  - Author:: ${data.byline}`);
    if (data.publishedTime) lines.push(`  - Date:: [[${new Date(data.publishedTime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}]]`);
    if (data.textContent) {
      lines.push(`  - Content::`);
      lines.push(`    - ${data.textContent}`);
    }
    lines.push("");
    return lines.join("\n");
  }, [title, data.url, data.byline, data.publishedTime, data.textContent]);

  const generateMarkdown = useCallback((): string => {
    const lines: string[] = [];
    lines.push(`# ${title}`); lines.push("");
    lines.push(`[${data.url}](${data.url})`); lines.push("");
    const meta: string[] = [];
    if (data.byline) meta.push(`**Author:** ${data.byline}`);
    if (data.publishedTime) meta.push(`**Date:** ${data.publishedTime.split("T")[0]}`);
    if (meta.length > 0) {
      lines.push(meta.join(" · ")); lines.push("");
    }
    lines.push("---"); lines.push("");
    if (data.textContent) {
      lines.push(data.textContent);
      lines.push("");
    }
    return lines.join("\n");
  }, [title, data.url, data.byline, data.publishedTime, data.textContent]);

  const generateJSON = useCallback((): string => {
    return JSON.stringify({
      title,
      url: data.url,
      byline: data.byline || null,
      siteName: data.siteName || null,
      publishedTime: data.publishedTime || null,
      lang: data.lang || null,
      textContent: data.textContent || null,
      content: data.content || null,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }, [title, data]);

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
    } catch {
      toast.error("Failed to copy");
    }
  }, [generateNotionMarkdown, generateObsidianMarkdown, generateRoamMarkdown, generateMarkdown, generateJSON]);

  const baseName = useMemo(() => {
    return data.title
      ? data.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 50)
      : "article";
  }, [data.title]);

  const handleDownload = useCallback((format: ExportFormat) => {
    let content: string;
    let filename: string;
    let mimeType: string;
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
  }, [baseName, generateNotionMarkdown, generateObsidianMarkdown, generateRoamMarkdown, generateMarkdown, generateJSON]);

  const exportOptions: { format: ExportFormat; name: string; icon: React.ReactNode; description: string; }[] = [
    { format: "notion", name: "Notion", icon: <NotionIcon className="size-5" />, description: "Full article with metadata" },
    { format: "obsidian", name: "Obsidian", icon: <ObsidianIcon className="size-5" />, description: "YAML frontmatter + full text" },
    { format: "roam", name: "Roam Research", icon: <RoamIcon className="size-5" />, description: "[[Page links]] + attributes" },
    { format: "markdown", name: "Markdown", icon: <FileText className="size-5" />, description: "Full article as markdown" },
  ];

  return (
    <div className="space-y-2">
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
}

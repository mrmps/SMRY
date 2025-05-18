'use client'

import React, { useState } from "react"
import { z } from "zod"
import { getUrlWithSource } from "@/lib/get-url-with-source"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "./ui/button";

const FormSchema = z.object({
  url: z.string(),
  ip: z.string(),
  source: z.string(),
  summary: z.string(),
});

export default function SummaryForm({ urlProp, ipProp }: { urlProp: string, ipProp: string }) {
  const [source, setSource] = useState("direct");
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const url = getUrlWithSource(source, urlProp);
      
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          ip: ipProp,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col space-y-4">
          <label htmlFor="url" className="text-sm font-semibold text-gray-600">
            Choose Source:
          </label>
          <Select onValueChange={value => setSource(value)} value={source}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Direct (fastest)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="archive">Archive (best but slow)</SelectItem>
              <SelectItem value="wayback">Wayback</SelectItem>
              <SelectItem value="direct">Direct (fastest)</SelectItem>
              <SelectItem value="jina.ai">Jina.ai</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Generating Summary...' : 'Generate Summary'}
          </Button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      )}

      {summary && (
        <div className="mt-10 p-4 bg-gray-100 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-800">Summary:</h2>
          <div className="mt-2 text-gray-700">
            {summary}
          </div>
        </div>
      )}
    </div>
  );
}

'use client'

import React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { getSummaryWithSource } from '@/app/actions/get-summary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "./ui/button";

const FormSchema = z.object({
  url: z.string(),
  ip: z.string(),
  source: z.string(),
  summary: z.string(),
});

export default function SummaryForm({ urlProp, ipProp }: { urlProp: string, ipProp: string }) {
  const [source, setSource] = React.useState("direct");
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      // url: getUrlWithSource(urlProp, "direct"),
      url: "https://www.nytimes.com/live/2024/06/10/world/israel-gaza-war-hamas",
      ip: ipProp,
      source: "direct",
      summary: "",
    },
  });

  const initialState = null;
  // Using useActionState with server action
  const [state, formAction, isPending] = React.useActionState(getSummaryWithSource, initialState);

  return (
    <div className="mt-2">
      <form action={formAction}>
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="originalUrl" value={urlProp} />
        <input type="hidden" name="ip" value={ipProp} />
        <div className="flex flex-col space-y-4">
          <label htmlFor="url" className="text-sm font-semibold text-gray-600">
            Choose Source:
          </label>
          <Select onValueChange={value => setSource(value)} value={source}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Direct (fastest)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wayback">Wayback</SelectItem>
              <SelectItem value="direct">Direct (fastest)</SelectItem>
              <SelectItem value="jina.ai">Jina.ai</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={form.formState.isSubmitting || isPending}>
            {form.formState.isSubmitting || isPending ? 'Generating Summary...' : 'Generate Summary'}
          </Button>
        </div>
      </form>
      {(state !== null && state !== undefined) && (
        <div className="mt-10 p-4 bg-gray-100 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-800">Summary:</h2>
          <div className="mt-2 text-gray-700">
            {typeof state === 'object' ? JSON.stringify(state) : state}
            {state === null || state === '' || state === undefined ? "No Summary Available" : null}
          </div>
        </div>
      )}
    </div>
  );
}

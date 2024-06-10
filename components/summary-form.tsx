'use client'

import React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useFormState } from "react-dom"
import { z } from "zod"
import { getSummary } from '@/app/actions/get-summary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "./ui/button";
import { getUrlWithSource } from "@/lib/get-url-with-source"

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
  // Using useFormState correctly
  const [state, formAction, isPending] = useFormState(async (state: string | null, formData: FormData) => {
    console.log("Form data:", formData);
    console.log("urlProp:", urlProp);
    console.log("source:", source);
    const url = getUrlWithSource(source ?? "direct", urlProp);
    formData.set("url", url);
    formData.set("ip", ipProp);

    const result = await getSummary(formData);
    form
    return result;
  }, initialState);

  return (
    <div className="mt-2">
      <form action={formAction} method="POST">
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
          <Button type="submit" disabled={form.formState.isSubmitting || isPending}>
            {form.formState.isSubmitting || isPending ? 'Generating Summary...' : 'Generate Summary'}
          </Button>
        </div>
      </form>
      {state  && (
        <div className="mt-10 p-4 bg-gray-100 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-800">Summary:</h2>
          <div className="mt-2 text-gray-700">{typeof state === 'object' ? JSON.stringify(state) : state || "No Summary Available"}</div>
        </div>
      )}
    </div>
  );
}

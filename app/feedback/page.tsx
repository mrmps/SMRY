"use client";

import { useState } from "react";
import { sendEmail } from "../actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/top-bar";
import { ClientOnly } from "@/components/client-only";

export default function Page() {
  const [emailData, setEmailData] = useState({
    from: "",
    subject: "",
    message: "",
  });

  const handleChange = (e: { target: { name: any; value: any } }) => {
    setEmailData({ ...emailData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const response = await sendEmail(emailData);
    if (response.success) {
      alert("Email sent successfully!");
    } else {
      alert(response.error || "Failed to send email");
    }
  };

  return (
    // This is a hack
    <ClientOnly>
      <div className="bg-zinc-50">
        <TopBar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">I value your feedback</h2>
                <p className="text-zinc-700 dark:text-zinc-400">
                  Hey there! I&apos;m Mike.
                  I&apos;d love to hear what you think—every little bit counts! Want
                  a full-page view instead of snippets? Clearer info on where
                  the info comes from? Maybe some cool AI tricks or just a more
                  reliable experience? Tell me what&apos;s on your mind; it all makes
                  a difference!
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email (Optional. Only if you need a response)
                  </Label>
                  <Input
                    id="email"
                    name="from"
                    placeholder="Enter your email (optional)"
                    type="email"
                    value={emailData.from}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="Enter the subject"
                    value={emailData.subject}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    className="min-h-[100px]"
                    id="message"
                    name="message"
                    placeholder="Enter your message"
                    value={emailData.message}
                    onChange={handleChange}
                  />
                </div>
                <Button className="w-full" type="submit">
                  Submit
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}

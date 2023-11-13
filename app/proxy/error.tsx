"use client";

import { useState } from "react";
import { Resend } from "resend";
import { sendEmail } from "../actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/top-bar";
import { Link } from "lucide-react";
import UnderlineLink from "@/components/underline-link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
    <div className="bg-zinc-50">
      <TopBar />
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800">
          <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center dark:bg-zinc-900">
            <h2
              id="error-title"
              className="mb-4 text-xl font-semibold tracking-tight text-zinc-800 dark:text-zinc-100"
            >
              Oops, something went wrong
            </h2>
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              We&apos;ve logged the issue and are working on it. Click{" "}
              <button
                className={`cursor-pointer underline decoration-from-font underline-offset-2 hover:opacity-80`}
                onClick={() => reset()}
              >
                here
              </button>{" "}
              to try again, or{" "}
              <UnderlineLink href="/" text="read something else" />.
            </p>
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300 mt-3">
              Some providers still do not work with smry.ai. We are improving
              every day, but if the site you are trying to read is protected by
              a{" "}
              <UnderlineLink
                href="https://www.zuora.com/guides/what-is-a-hard-paywall/"
                text="hard paywall"
              />{" "}
              there is nothing we can do.
            </p>
            <p className="mt-6 text-sm leading-7 text-zinc-800 dark:text-zinc-100">
              Questions?{" "}
              <UnderlineLink href="/feedback" text="send us feedback" />.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

{
  /* <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md">
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">We value your feedback</h2>
                <p className="text-red-500 dark:text-zinc-400">
                  You have encountered an error! Please provide your valuable
                  feedback to help us improve. What happened??
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="from"
                    placeholder="Enter your email"
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
              <Button className="mt-10" onClick={() => reset()}>Try again</Button>
            </div>
          </div> */
}

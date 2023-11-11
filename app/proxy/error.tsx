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
    <html>
      <TopBar />
      <body className="bg-gray-100">
        <div className="flex items-center justify-center min-h-screen">
          <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md">
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
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

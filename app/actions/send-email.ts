"use server";

import { Resend } from "resend";

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(formData: {
  from: string;
  subject: string;
  message: string;
}) {
  try {
    await resend.emails.send({
      //   from: "Acme <contect@smry.ai>",
      //   to: ["contact@smry.ai"],
      from: "Acme <onboarding@resend.dev>",
      to: [process.env.EMAIL_TO_ADDRESS as string],
      subject: 'Subject: ' + formData.subject,
      html: 'Message: ' + formData.message + " from " + formData.from,
    });
    console.log("success")

    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: "Failed to send email" };
  }
}

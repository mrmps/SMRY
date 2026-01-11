/**
 * Email Templates and Sending
 *
 * Uses inbound.new to send transactional emails to users.
 * Currently handles:
 * - Welcome emails for new paid subscribers
 * - Alert emails for error rate spikes
 */

import Inbound from "inboundemail";
import { env } from "../server/env";

// Initialize inbound.new client
const inbound = new Inbound({ apiKey: env.INBOUND_API_KEY });

// Email configuration
const FROM_EMAIL = "michael@smry.ai";
const FROM_NAME = "Michael from Smry";
const FORWARD_REPLIES_TO = "miryaboy@gmail.com";

interface SendWelcomeEmailParams {
  to: string;
  firstName?: string;
}

interface SendAlertEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Generate the welcome email HTML for paid subscribers
 */
function generateWelcomeEmailHtml(firstName?: string): string {
  const greeting = firstName ? `Hey ${firstName}` : "Hey there";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Smry</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <div style="font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 8px;">
                smry
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                ${greeting},
              </p>

              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                I'm Michael, and I created Smry to help people get past paywalls and have a better experience reading content on the internet.
              </p>

              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                Thank you for subscribing - it genuinely means a lot that you believe in what we're building.
              </p>

              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                I'm constantly working to make the service better. If you have any ideas - no matter how crazy - I'd love to hear them. Just reply directly to this email and let me know what you think.
              </p>

              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                I read every message and do my best to implement suggestions that make Smry better for everyone.
              </p>

              <p style="font-size: 16px; color: #374151; margin: 0;">
                Thanks again for your support,<br>
                <strong>Michael</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                <a href="https://smry.ai" style="color: #6b7280; text-decoration: none;">smry.ai</a> · Read any article, anywhere
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate the welcome email plain text for paid subscribers
 */
function generateWelcomeEmailText(firstName?: string): string {
  const greeting = firstName ? `Hey ${firstName}` : "Hey there";

  return `
${greeting},

I'm Michael, and I created Smry to help people get past paywalls and have a better experience reading content on the internet.

Thank you for subscribing - it genuinely means a lot that you believe in what we're building.

I'm constantly working to make the service better. If you have any ideas - no matter how crazy - I'd love to hear them. Just reply directly to this email and let me know what you think.

I read every message and do my best to implement suggestions that make Smry better for everyone.

Thanks again for your support,
Michael

---
smry.ai · Read any article, anywhere
  `.trim();
}

/**
 * Send welcome email to new paid subscribers
 */
export async function sendWelcomeEmail({
  to,
  firstName,
}: SendWelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await inbound.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: "Welcome to Smry - thank you for subscribing!",
      html: generateWelcomeEmailHtml(firstName),
      text: generateWelcomeEmailText(firstName),
    });

    console.log(`[emails] Welcome email sent to ${to} (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending welcome email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send alert email (for error rate spikes, etc.)
 */
export async function sendAlertEmail({
  to,
  subject,
  text,
  html,
}: SendAlertEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await inbound.emails.send({
      from: `Smry Alerts <alerts@smry.ai>`,
      to,
      subject,
      html,
      text,
    });

    console.log(`[emails] Alert email sent to ${to} (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending alert email:", message);
    return { success: false, error: message };
  }
}

/**
 * Forward an inbound email reply to the configured forwarding address
 */
export async function forwardEmailReply({
  originalFrom,
  originalSubject,
  body,
  html,
}: {
  originalFrom: string;
  originalSubject: string;
  body: string;
  html?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await inbound.emails.send({
      from: `Smry Forwarded <forwarded@smry.ai>`,
      to: FORWARD_REPLIES_TO,
      subject: `Fwd: ${originalSubject} (from ${originalFrom})`,
      text: `
---------- Forwarded message ----------
From: ${originalFrom}
Subject: ${originalSubject}

${body}
      `.trim(),
      html: html || `
<p><strong>---------- Forwarded message ----------</strong></p>
<p><strong>From:</strong> ${originalFrom}<br/>
<strong>Subject:</strong> ${originalSubject}</p>
<hr/>
<p>${body.replace(/\n/g, "<br/>")}</p>
      `.trim(),
    });

    console.log(`[emails] Forwarded reply from ${originalFrom} to ${FORWARD_REPLIES_TO} (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error forwarding email:", message);
    return { success: false, error: message };
  }
}

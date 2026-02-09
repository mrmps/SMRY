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
const OWNER_EMAIL = "miryaboy@gmail.com";

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

/**
 * Send notification to owner when someone completes checkout
 */
export async function sendCheckoutNotification({
  customerEmail,
  customerName,
  plan,
}: {
  customerEmail: string;
  customerName?: string;
  plan?: string;
}): Promise<{ success: boolean; error?: string }> {
  const displayName = customerName || "Unknown";
  const planName = plan || "Premium";
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });

  try {
    const result = await inbound.emails.send({
      from: `Smry Notifications <notifications@smry.ai>`,
      to: OWNER_EMAIL,
      subject: `💰 New subscriber: ${displayName}`,
      text: `
New paid subscriber!

Customer: ${displayName}
Email: ${customerEmail}
Plan: ${planName}
Time: ${timestamp}

---
Smry Notifications
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 16px 0; color: #10b981;">💰 New Subscriber!</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 80px;">Customer</td>
        <td style="padding: 8px 0; font-weight: 500;">${displayName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Email</td>
        <td style="padding: 8px 0;"><a href="mailto:${customerEmail}" style="color: #3b82f6;">${customerEmail}</a></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Plan</td>
        <td style="padding: 8px 0;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Time</td>
        <td style="padding: 8px 0;">${timestamp}</td>
      </tr>
    </table>
  </div>
</body>
</html>
      `.trim(),
    });

    console.log(`[emails] Checkout notification sent (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending checkout notification:", message);
    return { success: false, error: message };
  }
}

/**
 * Send notification to owner when someone clicks the buy button
 */
export async function sendBuyClickNotification({
  userEmail,
  userName,
  plan,
  isSignedIn,
  deviceType,
  browser,
  os,
  referrer,
  page,
}: {
  userEmail?: string;
  userName?: string;
  plan: "monthly" | "annual";
  isSignedIn: boolean;
  deviceType?: string;
  browser?: string;
  os?: string;
  referrer?: string;
  page?: string;
}): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const userInfo = isSignedIn
    ? `${userName || "Unknown"} (${userEmail || "no email"})`
    : "Anonymous visitor";

  try {
    const result = await inbound.emails.send({
      from: `Smry Notifications <notifications@smry.ai>`,
      to: OWNER_EMAIL,
      subject: `🛒 Buy button clicked: ${plan}`,
      text: `
Someone clicked the buy button!

User: ${userInfo}
Plan: ${plan}
Signed in: ${isSignedIn ? "Yes" : "No"}
Device: ${deviceType || "Unknown"} (${browser || "Unknown"} on ${os || "Unknown"})
Page: ${page || "Unknown"}${referrer ? `\nReferrer: ${referrer}` : ""}
Time: ${timestamp}

---
Smry Notifications
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 16px 0; color: #3b82f6;">🛒 Buy Button Clicked</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 80px;">User</td>
        <td style="padding: 8px 0; font-weight: 500;">${userInfo}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Plan</td>
        <td style="padding: 8px 0;">${plan}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Signed in</td>
        <td style="padding: 8px 0;">${isSignedIn ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Device</td>
        <td style="padding: 8px 0;">${deviceType || "Unknown"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Browser</td>
        <td style="padding: 8px 0;">${browser || "Unknown"} on ${os || "Unknown"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Page</td>
        <td style="padding: 8px 0;">${page || "Unknown"}</td>
      </tr>${referrer && /^https?:\/\//i.test(referrer) ? `
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Referrer</td>
        <td style="padding: 8px 0;"><a href="${referrer}" style="color: #3b82f6;">${referrer}</a></td>
      </tr>` : referrer ? `
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Referrer</td>
        <td style="padding: 8px 0;">${referrer}</td>
      </tr>` : ""}
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Time</td>
        <td style="padding: 8px 0;">${timestamp}</td>
      </tr>
    </table>
  </div>
</body>
</html>
      `.trim(),
    });

    console.log(`[emails] Buy click notification sent (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending buy click notification:", message);
    return { success: false, error: message };
  }
}

/**
 * Send notification to owner when a new user signs up (free)
 */
export async function sendSignupNotification({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });

  try {
    const result = await inbound.emails.send({
      from: `Smry Notifications <notifications@smry.ai>`,
      to: OWNER_EMAIL,
      subject: `👋 New signup: ${userName || userEmail}`,
      text: `
New user signed up!

Name: ${userName || "Not provided"}
Email: ${userEmail}
Time: ${timestamp}

---
Smry Notifications
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 16px 0; color: #8b5cf6;">👋 New Signup</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 80px;">Name</td>
        <td style="padding: 8px 0; font-weight: 500;">${userName || "Not provided"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Email</td>
        <td style="padding: 8px 0;"><a href="mailto:${userEmail}" style="color: #3b82f6;">${userEmail}</a></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Time</td>
        <td style="padding: 8px 0;">${timestamp}</td>
      </tr>
    </table>
  </div>
</body>
</html>
      `.trim(),
    });

    console.log(`[emails] Signup notification sent (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending signup notification:", message);
    return { success: false, error: message };
  }
}

/**
 * Send email when free trial is ending soon
 * Psychology: Loss aversion (what they'll lose), endowment effect (they already "own" it)
 */
export async function sendTrialEndingSoonEmail({
  to,
  firstName,
}: {
  to: string;
  firstName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const greeting = firstName ? `Hey ${firstName}` : "Hey";
  const safeGreeting = firstName ? `Hey ${escapeHtml(firstName)}` : "Hey";

  const text = `${greeting},

Quick heads up - your Smry free trial is ending soon.

After that, you'll lose access to:
- Unlimited article reading
- AI chat with any article
- Full archive of your reading history

If Smry has been useful to you, subscribing takes about 30 seconds:
https://smry.ai/pricing

And if it hasn't been useful - I'd genuinely love to know why. Just reply to this email.

- Michael

---
smry.ai · Read any article, anywhere`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <div style="font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 8px;">smry</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">${safeGreeting},</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">Quick heads up - your Smry free trial is <strong>ending soon</strong>.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 12px 0;">After that, you'll lose access to:</p>
              <ul style="font-size: 16px; color: #374151; margin: 0 0 20px 0; padding-left: 20px;">
                <li style="margin-bottom: 6px;">Unlimited article reading</li>
                <li style="margin-bottom: 6px;">AI chat with any article</li>
                <li style="margin-bottom: 6px;">Full archive of your reading history</li>
              </ul>
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://smry.ai/pricing" style="display: inline-block; padding: 12px 28px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">Keep My Access</a>
              </div>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">And if Smry hasn't been useful - I'd genuinely love to know why. Just reply to this email.</p>
              <p style="font-size: 16px; color: #374151; margin: 0;">- Michael</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                <a href="https://smry.ai" style="color: #6b7280; text-decoration: none;">smry.ai</a> &middot; Read any article, anywhere
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const result = await inbound.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: "Your Smry trial is ending soon",
      html,
      text,
    });
    console.log(`[emails] Trial ending soon email sent to ${to} (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending trial ending email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send personal founder email when subscription is canceled, asking what we can do better
 * Psychology: Pratfall effect (admit imperfection), reciprocity (ask genuinely)
 */
export async function sendCancellationFeedbackEmail({
  to,
  firstName,
}: {
  to: string;
  firstName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const greeting = firstName ? `Hey ${firstName}` : "Hey";
  const safeGreeting = firstName ? `Hey ${escapeHtml(firstName)}` : "Hey";

  const text = `${greeting},

It's Michael from Smry. I noticed your subscription ended, and I wanted to reach out personally.

I'm not going to pretend Smry is perfect - we're still figuring a lot of things out. But I do care about making it better, and the best way I know how is to ask directly.

Would you mind sharing what made you decide not to continue? Even a one-line reply would be incredibly helpful.

Some things I'm curious about:
- Was there a feature you expected that was missing?
- Did something not work the way you wanted?
- Was the price not worth it for how you use it?
- Or did you just not need it anymore?

No hard feelings either way. I just want to build something genuinely useful.

Thanks for giving Smry a try.

- Michael
michael@smry.ai

---
smry.ai · Read any article, anywhere`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">${safeGreeting},</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">It's Michael from Smry. I noticed your subscription ended, and I wanted to reach out personally.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">I'm not going to pretend Smry is perfect - we're still figuring a lot of things out. But I do care about making it better, and the best way I know how is to ask directly.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;"><strong>Would you mind sharing what made you decide not to continue?</strong> Even a one-line reply would be incredibly helpful.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 8px 0;">Some things I'm curious about:</p>
              <ul style="font-size: 16px; color: #6b7280; margin: 0 0 20px 0; padding-left: 20px;">
                <li style="margin-bottom: 6px;">Was there a feature you expected that was missing?</li>
                <li style="margin-bottom: 6px;">Did something not work the way you wanted?</li>
                <li style="margin-bottom: 6px;">Was the price not worth it for how you use it?</li>
                <li style="margin-bottom: 6px;">Or did you just not need it anymore?</li>
              </ul>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">No hard feelings either way. I just want to build something genuinely useful.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 4px 0;">Thanks for giving Smry a try.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 4px 0;">- Michael</p>
              <p style="font-size: 14px; color: #6b7280; margin: 0;">michael@smry.ai</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const result = await inbound.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: "Quick question from Michael at Smry",
      html,
      text,
    });
    console.log(`[emails] Cancellation feedback email sent to ${to} (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending cancellation feedback email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send email when subscription has fully ended (after billing period)
 * Psychology: Loss aversion (remind what they're missing), easy re-entry
 */
export async function sendSubscriptionEndedEmail({
  to,
  firstName,
}: {
  to: string;
  firstName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const greeting = firstName ? `Hey ${firstName}` : "Hey";
  const safeGreeting = firstName ? `Hey ${escapeHtml(firstName)}` : "Hey";

  const text = `${greeting},

Just wanted to let you know your Smry subscription has now ended.

Your account is still here if you ever want to come back - all it takes is picking a plan: https://smry.ai/pricing

In the meantime, I hope you found Smry useful while you were here. If there's anything I can do to improve the experience, I'm always listening.

- Michael

---
smry.ai · Read any article, anywhere`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">${safeGreeting},</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">Just wanted to let you know your Smry subscription has now ended.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">Your account is still here if you ever want to come back - all it takes is picking a plan.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://smry.ai/pricing" style="display: inline-block; padding: 12px 28px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">Resubscribe</a>
              </div>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">In the meantime, I hope you found Smry useful while you were here. If there's anything I can do to improve, I'm always listening.</p>
              <p style="font-size: 16px; color: #374151; margin: 0;">- Michael</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const result = await inbound.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: "Your Smry subscription has ended",
      html,
      text,
    });
    console.log(`[emails] Subscription ended email sent to ${to} (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending subscription ended email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send email when checkout was started but not completed
 * Psychology: Zeigarnik effect (unfinished task), friction reduction (direct link back)
 */
export async function sendAbandonedCheckoutEmail({
  to,
  firstName,
}: {
  to: string;
  firstName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const greeting = firstName ? `Hey ${firstName}` : "Hey";
  const safeGreeting = firstName ? `Hey ${escapeHtml(firstName)}` : "Hey";

  const text = `${greeting},

Looks like you started signing up for Smry but didn't finish. Totally understand - sometimes things come up.

If you ran into any issues during checkout, just reply and I'll help sort it out.

Otherwise, you can pick up right where you left off: https://smry.ai/pricing

- Michael

---
smry.ai · Read any article, anywhere`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">${safeGreeting},</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">Looks like you started signing up for Smry but didn't finish. Totally understand - sometimes things come up.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">If you ran into any issues during checkout, just reply and I'll help sort it out.</p>
              <p style="font-size: 16px; color: #374151; margin: 0 0 4px 0;">Otherwise, you can pick up right where you left off:</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://smry.ai/pricing" style="display: inline-block; padding: 12px 28px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">Complete Signup</a>
              </div>
              <p style="font-size: 16px; color: #374151; margin: 0;">- Michael</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const result = await inbound.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: "Finish setting up Smry?",
      html,
      text,
    });
    console.log(`[emails] Abandoned checkout email sent to ${to} (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending abandoned checkout email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send notification to owner about subscription lifecycle events
 */
export async function sendSubscriptionEventNotification({
  eventType,
  customerEmail,
  customerName,
}: {
  eventType: string;
  customerEmail: string;
  customerName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const displayName = customerName || "Unknown";
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const eventLabels: Record<string, { emoji: string; label: string }> = {
    "subscriptionItem.freeTrialEnding": { emoji: "⏰", label: "Trial Ending Soon" },
    "subscriptionItem.canceled": { emoji: "❌", label: "Subscription Canceled" },
    "subscriptionItem.ended": { emoji: "👋", label: "Subscription Ended" },
    "subscriptionItem.incomplete": { emoji: "🛒", label: "Abandoned Checkout" },
  };

  const { emoji, label } = eventLabels[eventType] || { emoji: "📋", label: eventType };
  const safeDisplayName = escapeHtml(displayName);
  const safeEmail = escapeHtml(customerEmail);

  try {
    const result = await inbound.emails.send({
      from: `Smry Notifications <notifications@smry.ai>`,
      to: OWNER_EMAIL,
      subject: `${emoji} ${label}: ${displayName}`,
      text: `${label}\n\nCustomer: ${displayName}\nEmail: ${customerEmail}\nEvent: ${eventType}\nTime: ${timestamp}\n\n---\nSmry Notifications`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 16px 0;">${emoji} ${label}</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #6b7280; width: 80px;">Customer</td><td style="padding: 8px 0; font-weight: 500;">${safeDisplayName}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #3b82f6;">${safeEmail}</a></td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Event</td><td style="padding: 8px 0;">${eventType}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Time</td><td style="padding: 8px 0;">${timestamp}</td></tr>
    </table>
  </div>
</body>
</html>`.trim(),
    });

    console.log(`[emails] Subscription event notification sent (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[emails] Error sending subscription event notification:", message);
    return { success: false, error: message };
  }
}

/**
 * Send changelog/product update email to a user
 */
interface SendChangelogEmailParams {
  to: string;
  firstName?: string;
}

export async function sendChangelogEmail({
  to,
  firstName,
}: SendChangelogEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const greeting = firstName ? `Hey ${firstName}` : "Hey there";

    const result = await inbound.emails.send({
      from: `${FROM_NAME} <${OWNER_EMAIL}>`,
      to,
      subject: "What's new in Smry - Smart Auto-Fetch & More",
      text: `${greeting},

Quick update on what's new in Smry:

SMART AUTO-FETCH
Articles are now automatically fetched from the best available source. The system races multiple sources and picks the one with the most complete content.

OPTIMISTIC CONTENT UPDATES
Content may be updated in real-time when a longer, more complete version is found from another source.

BETTER LOADING EXPERIENCE
New richer loading skeleton and compact error display with streamlined retry options.

CLEANER READING INTERFACE
Manual source selector is now hidden when auto-fetch is used. Mid-article and footer ad slots for less intrusive placement.

MOBILE IMPROVEMENTS
Fixed horizontal scrolling issues on mobile devices. Cards and ads now scale properly on all screen sizes.

See the full changelog: https://smry.ai/changelog

As always, just reply to this email if you have any questions or feedback.

Thanks,
Michael
`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>What's New in Smry</title>
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
              <div style="font-size: 14px; color: #6b7280;">
                Product Update · Feb 2026
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                ${greeting},
              </p>

              <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0;">
                Quick update on what's new in Smry:
              </p>

              <!-- Feature 1 -->
              <div style="margin-bottom: 20px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                  ⚡ Smart Auto-Fetch
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  Articles are now automatically fetched from the best available source. The system races multiple sources and picks the most complete content.
                </div>
              </div>

              <!-- Feature 2 -->
              <div style="margin-bottom: 20px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                  🔄 Optimistic Content Updates
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  Content may be updated in real-time when a longer, more complete version is found.
                </div>
              </div>

              <!-- Feature 3 -->
              <div style="margin-bottom: 20px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                  ✨ Better Loading & Cleaner UI
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  New loading skeleton, compact error display, and hidden source selector for a cleaner reading experience.
                </div>
              </div>

              <!-- Feature 4 -->
              <div style="margin-bottom: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                  📱 Mobile Improvements
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  Fixed horizontal scrolling issues. Cards and ads now scale properly on all screen sizes.
                </div>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="https://smry.ai/changelog" style="display: inline-block; padding: 12px 24px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                  View Full Changelog →
                </a>
              </div>

              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                As always, just reply to this email if you have any questions or feedback.
              </p>

              <p style="font-size: 16px; color: #374151; margin: 0;">
                Thanks,<br>
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
      `.trim(),
    });

    console.log(`[emails] Changelog email sent to ${to} (id: ${result.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[emails] Error sending changelog email to ${to}:`, message);
    return { success: false, error: message };
  }
}

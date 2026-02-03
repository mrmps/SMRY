/**
 * Send Changelog Email to All Users
 *
 * This script fetches all users from Clerk and sends them the changelog email.
 *
 * Usage:
 *   bun run scripts/send-changelog-email.ts [--dry-run] [--limit=N] [--emails=a@b.com,c@d.com]
 *
 * Options:
 *   --dry-run        Preview what would be sent without actually sending emails
 *   --limit=N        Only send to first N users (useful for testing)
 *   --emails=LIST    Send only to specific emails (comma-separated)
 *
 * Required environment variables:
 *   CLERK_SECRET_KEY - Your Clerk secret key
 *   INBOUND_API_KEY  - Your inbound.new API key
 */

import { createClerkClient } from "@clerk/backend";
import Inbound from "inboundemail";

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
const emailsArg = args.find((arg) => arg.startsWith("--emails="));
const specificEmails = emailsArg ? emailsArg.split("=")[1].split(",").map(e => e.trim()) : null;

// Validate environment
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const INBOUND_API_KEY = process.env.INBOUND_API_KEY;

if (!CLERK_SECRET_KEY) {
  console.error("❌ CLERK_SECRET_KEY environment variable is required");
  process.exit(1);
}

if (!INBOUND_API_KEY && !isDryRun) {
  console.error("❌ INBOUND_API_KEY environment variable is required (unless using --dry-run)");
  process.exit(1);
}

// Initialize clients
const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const inbound = INBOUND_API_KEY ? new Inbound({ apiKey: INBOUND_API_KEY }) : null;

// Email configuration
const FROM_EMAIL = "michael@smry.ai";
const FROM_NAME = "Michael from Smry";
// const OWNER_EMAIL = "miryaboy@gmail.com";

interface UserInfo {
  id: string;
  email: string;
  firstName?: string;
}

async function getAllUsers(): Promise<UserInfo[]> {
  const users: UserInfo[] = [];
  let offset = 0;
  const pageSize = 100;

  console.log("📥 Fetching users from Clerk...\n");

  while (true) {
    const response = await clerkClient.users.getUserList({
      limit: pageSize,
      offset,
    });

    for (const user of response.data) {
      const primaryEmail = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      );

      if (primaryEmail?.emailAddress) {
        users.push({
          id: user.id,
          email: primaryEmail.emailAddress,
          firstName: user.firstName || undefined,
        });
      }
    }

    console.log(`  Fetched ${users.length} users so far...`);

    // Check if we've reached the limit or end of users
    if (response.data.length < pageSize) {
      break;
    }

    // Check if we've hit our optional limit
    if (limit && users.length >= limit) {
      break;
    }

    offset += pageSize;
  }

  return limit ? users.slice(0, limit) : users;
}

function generateEmailHtml(firstName?: string): string {
  const greeting = firstName ? `Hey ${firstName}` : "Hey there";

  return `
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
                Product Update - Feb 2026
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
                Big update: <strong>AI Chat is here.</strong> Instead of just getting a summary, you can now have a conversation with any article.
              </p>

              <!-- Feature 1 -->
              <div style="margin-bottom: 20px; padding: 16px; background-color: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                  Ask AI About Any Article
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  Ask questions, request explanations, and dive deeper into any topic. It's like having a research assistant for everything you read.
                </div>
              </div>

              <!-- Feature 2 -->
              <div style="margin-bottom: 20px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                  Conversations That Remember
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  Your chat history syncs automatically. Sign in to access your conversations from any device.
                </div>
              </div>

              <!-- Feature 3 -->
              <div style="margin-bottom: 20px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                  Real-Time Streaming
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  Watch AI responses appear word by word. No more waiting for the full answer.
                </div>
              </div>

              <!-- Feature 4 -->
              <div style="margin-bottom: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
                  Smart Suggestions
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  Not sure what to ask? Start with one-tap suggestions like "Summarize this" or "What are the key points?"
                </div>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="https://smry.ai" style="display: inline-block; padding: 12px 24px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                  Try AI Chat Now
                </a>
              </div>

              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                Check out the <a href="https://smry.ai/changelog" style="color: #0ea5e9; text-decoration: none;">full changelog</a> for more details.
              </p>

              <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                As always, reply to this email if you have feedback.
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
                <a href="https://smry.ai" style="color: #6b7280; text-decoration: none;">smry.ai</a> - Read any article, anywhere
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

function generateEmailText(firstName?: string): string {
  const greeting = firstName ? `Hey ${firstName}` : "Hey there";

  return `${greeting},

Big update: AI Chat is here. Instead of just getting a summary, you can now have a conversation with any article.

ASK AI ABOUT ANY ARTICLE
Ask questions, request explanations, and dive deeper into any topic. It's like having a research assistant for everything you read.

CONVERSATIONS THAT REMEMBER
Your chat history syncs automatically. Sign in to access your conversations from any device.

REAL-TIME STREAMING
Watch AI responses appear word by word. No more waiting for the full answer.

SMART SUGGESTIONS
Not sure what to ask? Start with one-tap suggestions like "Summarize this" or "What are the key points?"

Try it now: https://smry.ai

Check out the full changelog for more details: https://smry.ai/changelog

As always, reply to this email if you have feedback.

Thanks,
Michael
`;
}

async function sendEmail(to: string, firstName?: string, retries = 3): Promise<{ success: boolean; error?: string; emailId?: string }> {
  if (!inbound) {
    return { success: false, error: "Inbound client not initialized" };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await inbound.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject: "New: Ask AI about any article on Smry",
        text: generateEmailText(firstName),
        html: generateEmailHtml(firstName),
      });

      return { success: true, emailId: result.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      // If it's a 401 error and we have retries left, wait and retry
      if (message.includes("401") && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }

      return { success: false, error: message };
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SMRY Changelog Email Sender");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No emails will be sent\n");
  }

  if (limit) {
    console.log(`📊 Limiting to first ${limit} users\n`);
  }

  if (specificEmails) {
    console.log(`📧 Sending to specific emails: ${specificEmails.length} addresses\n`);
  }

  try {
    // Get users - either from specific list or fetch from Clerk
    let users: UserInfo[];

    if (specificEmails) {
      // Use specific emails provided via --emails flag
      users = specificEmails.map(email => ({
        id: "manual",
        email,
        firstName: undefined,
      }));
      console.log(`✅ Using ${users.length} specified email addresses\n`);
    } else {
      // Fetch all users from Clerk
      users = await getAllUsers();
      console.log(`\n✅ Found ${users.length} users with email addresses\n`);
    }

    if (users.length === 0) {
      console.log("No users to email. Exiting.");
      return;
    }

    // Preview first few users
    console.log("Preview of recipients:");
    console.log("─────────────────────────────────────────────────────────");
    users.slice(0, 5).forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.email} (${user.firstName || "No name"})`);
    });
    if (users.length > 5) {
      console.log(`  ... and ${users.length - 5} more`);
    }
    console.log("");

    if (isDryRun) {
      console.log("─────────────────────────────────────────────────────────");
      console.log("🔍 DRY RUN COMPLETE");
      console.log(`   Would send to: ${users.length} users`);
      console.log("─────────────────────────────────────────────────────────");
      return;
    }

    // Confirm before sending
    console.log("─────────────────────────────────────────────────────────");
    console.log(`⚠️  About to send ${users.length} emails!`);
    console.log("   Press Ctrl+C within 5 seconds to cancel...");
    console.log("─────────────────────────────────────────────────────────");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("\n📧 Sending emails...\n");

    let sent = 0;
    let failed = 0;
    const errors: { email: string; error: string }[] = [];
    const successfulSends: { email: string; emailId: string }[] = [];

    for (const user of users) {
      const result = await sendEmail(user.email, user.firstName);

      if (result.success) {
        sent++;
        successfulSends.push({ email: user.email, emailId: result.emailId || "unknown" });
        console.log(`  ✅ ${user.email} (ID: ${result.emailId})`);
      } else {
        failed++;
        errors.push({ email: user.email, error: result.error || "Unknown" });
        console.log(`  ❌ ${user.email}: ${result.error}`);
      }

      // Rate limiting: wait 250ms between emails to avoid auth issues
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  COMPLETE");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  ✅ Sent: ${sent}`);
    console.log(`  ❌ Failed: ${failed}`);

    if (successfulSends.length > 0) {
      console.log(`\n  📋 Email IDs (proof of delivery):`);
      successfulSends.slice(0, 5).forEach((s) => {
        console.log(`    - ${s.email}: ${s.emailId}`);
      });
      if (successfulSends.length > 5) {
        console.log(`    ... and ${successfulSends.length - 5} more`);
      }
    }

    if (errors.length > 0 && errors.length <= 10) {
      console.log("\n  Failed emails:");
      errors.forEach((e) => {
        console.log(`    - ${e.email}: ${e.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n  First 10 failed emails:`);
      errors.slice(0, 10).forEach((e) => {
        console.log(`    - ${e.email}: ${e.error}`);
      });
      console.log(`    ... and ${errors.length - 10} more`);
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();

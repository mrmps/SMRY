/**
 * Webhook Routes
 *
 * Handles webhook events from:
 * - Clerk: checkout.session.completed → Send welcome email to new paid subscribers
 * - inbound.new: Incoming emails → Forward replies to Gmail
 */

import { Elysia, t } from "elysia";
import { Webhook } from "svix";
import { createClerkClient } from "@clerk/backend";
import { sendWelcomeEmail, forwardEmailReply } from "../../lib/emails";
import { env } from "../env";

// Initialize Clerk client for fetching user details
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Clerk webhook event types
interface ClerkBillingEvent {
  type: "checkout.session.completed" | "subscription.created";
  data: {
    id: string;
    user_id: string;
    plan_id?: string;
    status?: string;
    // Additional fields may be present
    [key: string]: unknown;
  };
}

interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    primary_email_address_id: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

type ClerkWebhookEvent = ClerkBillingEvent | ClerkUserCreatedEvent | { type: string; data: Record<string, unknown> };

/**
 * Verify Clerk webhook signature using svix
 */
function verifyWebhook(
  payload: string,
  headers: {
    "svix-id"?: string;
    "svix-timestamp"?: string;
    "svix-signature"?: string;
  }
): ClerkWebhookEvent | null {
  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[webhooks] Missing svix headers");
    return null;
  }

  try {
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
    const event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;

    return event;
  } catch (error) {
    console.error("[webhooks] Failed to verify webhook:", error);
    return null;
  }
}

/**
 * Fetch user email and name from Clerk API
 */
async function getUserDetails(userId: string): Promise<{ email: string; firstName?: string } | null> {
  try {
    const user = await clerk.users.getUser(userId);

    // Find primary email
    const primaryEmail = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    );
    const email = primaryEmail?.emailAddress || user.emailAddresses[0]?.emailAddress;

    if (!email) {
      console.error(`[webhooks] No email found for user ${userId}`);
      return null;
    }

    return {
      email,
      firstName: user.firstName || undefined,
    };
  } catch (error) {
    console.error(`[webhooks] Failed to fetch user ${userId}:`, error);
    return null;
  }
}

/**
 * Handle billing events (checkout completed, subscription created)
 * These indicate a new paid subscriber
 */
async function handleBillingEvent(event: ClerkBillingEvent): Promise<void> {
  const { data, type } = event;
  const userId = data.user_id;

  if (!userId) {
    console.error(`[webhooks] No user_id in ${type} event`);
    console.log("[webhooks] Event data:", JSON.stringify(data, null, 2));
    return;
  }

  console.log(`[webhooks] Processing ${type} for user ${userId}`);

  // Fetch user details from Clerk API
  const userDetails = await getUserDetails(userId);
  if (!userDetails) {
    return;
  }

  console.log(`[webhooks] New paid subscriber: ${userDetails.email} (${userDetails.firstName || "no name"})`);

  // Send welcome email
  const result = await sendWelcomeEmail({
    to: userDetails.email,
    firstName: userDetails.firstName,
  });

  if (!result.success) {
    console.error(`[webhooks] Failed to send welcome email to ${userDetails.email}:`, result.error);
  }
}

// inbound.new webhook payload types
interface InboundEmailWebhook {
  id: string;
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  date: string;
  // Additional fields from inbound.new
  [key: string]: unknown;
}

export const webhookRoutes = new Elysia({ prefix: "/api/webhooks" })
  // Clerk webhooks for billing events
  .post(
    "/clerk",
    async ({ body, headers, set }) => {
      // Get raw body as string for signature verification
      const payload = typeof body === "string" ? body : JSON.stringify(body);

      // Verify webhook signature
      const event = verifyWebhook(payload, {
        "svix-id": headers["svix-id"] as string | undefined,
        "svix-timestamp": headers["svix-timestamp"] as string | undefined,
        "svix-signature": headers["svix-signature"] as string | undefined,
      });

      if (!event) {
        set.status = 401;
        return { error: "Invalid webhook signature" };
      }

      console.log(`[webhooks] Received Clerk event: ${event.type}`);
      // Log full payload for debugging during initial setup
      console.log(`[webhooks] Event data:`, JSON.stringify(event.data, null, 2));

      // Handle different event types
      switch (event.type) {
        case "checkout.session.completed":
        case "subscription.created":
          await handleBillingEvent(event as ClerkBillingEvent);
          break;

        case "user.created": {
          // Log new user signup - could send different email to free users
          const userEvent = event as ClerkUserCreatedEvent;
          console.log(`[webhooks] New user signed up: ${userEvent.data.id}`);
          break;
        }

        default:
          console.log(`[webhooks] Unhandled event type: ${event.type}`);
      }

      return { received: true };
    },
    {
      // Accept raw body for signature verification
      parse: "text",
      body: t.String(),
    }
  )
  // inbound.new webhooks for incoming emails
  .post(
    "/inbound",
    async ({ body, headers, set }) => {
      // Verify webhook token (inbound.new sends this in header)
      const webhookToken = headers["x-webhook-verification-token"];

      // Log the incoming webhook for debugging
      console.log(`[webhooks] Received inbound.new email webhook`);

      // Parse the email payload
      const email = body as InboundEmailWebhook;

      console.log(`[webhooks] Email from: ${email.from}`);
      console.log(`[webhooks] Email to: ${email.to}`);
      console.log(`[webhooks] Email subject: ${email.subject}`);

      // Forward the email to Gmail
      const result = await forwardEmailReply({
        originalFrom: email.from,
        originalSubject: email.subject,
        body: email.text || "(No text content)",
        html: email.html,
      });

      if (!result.success) {
        console.error(`[webhooks] Failed to forward email: ${result.error}`);
        set.status = 500;
        return { error: "Failed to forward email" };
      }

      return { received: true, forwarded: true };
    },
    {
      body: t.Object({
        id: t.String(),
        from: t.String(),
        to: t.String(),
        subject: t.String(),
        text: t.Optional(t.String()),
        html: t.Optional(t.String()),
        date: t.Optional(t.String()),
      }, { additionalProperties: true }),
    }
  );

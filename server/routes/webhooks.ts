/**
 * Webhook Routes
 *
 * Handles webhook events from:
 * - Clerk billing: checkout.session.completed, subscription.created → Welcome email
 * - Clerk lifecycle: subscriptionItem.freeTrialEnding → Trial ending soon email
 *                    subscriptionItem.canceled → Founder feedback request email
 *                    subscriptionItem.ended → Subscription ended email
 *                    subscriptionItem.incomplete → Abandoned checkout email
 * - Clerk auth: user.created → Signup notification to owner
 * - inbound.new: Incoming emails → Forward replies to Gmail
 */

import { Elysia, t } from "elysia";
import { Webhook } from "svix";
import { createClerkClient } from "@clerk/backend";
import {
  sendWelcomeEmail,
  forwardEmailReply,
  sendCheckoutNotification,
  sendSignupNotification,
  sendBuyClickNotification,
  sendTrialEndingSoonEmail,
  sendCancellationFeedbackEmail,
  sendSubscriptionEndedEmail,
  sendAbandonedCheckoutEmail,
  sendSubscriptionEventNotification,
} from "../../lib/emails";
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
    [key: string]: unknown;
  };
}

interface ClerkSubscriptionItemEvent {
  type:
    | "subscriptionItem.freeTrialEnding"
    | "subscriptionItem.canceled"
    | "subscriptionItem.ended"
    | "subscriptionItem.incomplete";
  data: {
    id: string;
    // Clerk Backend API uses camelCase (payerId), webhook payloads use snake_case (payer_id)
    // We check both to be safe
    payer_id?: string;
    payerId?: string;
    status?: string;
    plan_id?: string;
    planId?: string;
    plan_period?: string;
    is_free_trial?: boolean;
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

type ClerkWebhookEvent =
  | ClerkBillingEvent
  | ClerkSubscriptionItemEvent
  | ClerkUserCreatedEvent
  | { type: string; data: Record<string, unknown> };

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

  // Send welcome email to customer
  const welcomeResult = await sendWelcomeEmail({
    to: userDetails.email,
    firstName: userDetails.firstName,
  });

  if (!welcomeResult.success) {
    console.error(`[webhooks] Failed to send welcome email to ${userDetails.email}:`, welcomeResult.error);
  }

  // Send notification to owner
  const notifyResult = await sendCheckoutNotification({
    customerEmail: userDetails.email,
    customerName: userDetails.firstName,
    plan: "Premium",
  });

  if (!notifyResult.success) {
    console.error(`[webhooks] Failed to send checkout notification:`, notifyResult.error);
  }
}

/**
 * Handle subscription item lifecycle events (trial ending, canceled, ended, incomplete)
 * These trigger user-facing emails + owner notifications
 */
async function handleSubscriptionItemEvent(event: ClerkSubscriptionItemEvent): Promise<void> {
  const { data, type } = event;
  // Clerk webhook payloads use snake_case (payer_id), Backend API uses camelCase (payerId)
  const userId = data.payer_id || data.payerId;

  if (!userId) {
    console.error(`[webhooks] No payer_id/payerId in ${type} event`);
    console.log("[webhooks] Event data:", JSON.stringify(data, null, 2));
    return;
  }

  console.log(`[webhooks] Processing ${type} for user ${userId}`);

  const userDetails = await getUserDetails(userId);
  if (!userDetails) {
    return;
  }

  console.log(`[webhooks] Subscription event ${type} for: ${userDetails.email}`);

  // Send user-facing email based on event type
  let emailResult: { success: boolean; error?: string };

  switch (type) {
    case "subscriptionItem.freeTrialEnding":
      emailResult = await sendTrialEndingSoonEmail({
        to: userDetails.email,
        firstName: userDetails.firstName,
      });
      break;

    case "subscriptionItem.canceled":
      emailResult = await sendCancellationFeedbackEmail({
        to: userDetails.email,
        firstName: userDetails.firstName,
      });
      break;

    case "subscriptionItem.ended":
      emailResult = await sendSubscriptionEndedEmail({
        to: userDetails.email,
        firstName: userDetails.firstName,
      });
      break;

    case "subscriptionItem.incomplete":
      emailResult = await sendAbandonedCheckoutEmail({
        to: userDetails.email,
        firstName: userDetails.firstName,
      });
      break;

    default:
      console.log(`[webhooks] No email template for ${type}`);
      return;
  }

  if (!emailResult.success) {
    console.error(`[webhooks] Failed to send ${type} email to ${userDetails.email}:`, emailResult.error);
  }

  // Also notify owner about the event
  const notifyResult = await sendSubscriptionEventNotification({
    eventType: type,
    customerEmail: userDetails.email,
    customerName: userDetails.firstName,
  });

  if (!notifyResult.success) {
    console.error(`[webhooks] Failed to send ${type} notification:`, notifyResult.error);
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

        case "subscriptionItem.freeTrialEnding":
        case "subscriptionItem.canceled":
        case "subscriptionItem.ended":
        case "subscriptionItem.incomplete":
          await handleSubscriptionItemEvent(event as ClerkSubscriptionItemEvent);
          break;

        case "user.created": {
          // Send signup notification to owner
          const userEvent = event as ClerkUserCreatedEvent;
          const primaryEmailId = userEvent.data.primary_email_address_id;
          const primaryEmail = userEvent.data.email_addresses.find(
            (e) => e.id === primaryEmailId
          );
          const email = primaryEmail?.email_address || userEvent.data.email_addresses[0]?.email_address;

          if (email) {
            const fullName = [userEvent.data.first_name, userEvent.data.last_name]
              .filter(Boolean)
              .join(" ") || undefined;

            console.log(`[webhooks] New user signed up: ${email}`);

            const signupResult = await sendSignupNotification({
              userEmail: email,
              userName: fullName,
            });

            if (!signupResult.success) {
              console.error(`[webhooks] Failed to send signup notification:`, signupResult.error);
            }
          }
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
      if (env.INBOUND_WEBHOOK_TOKEN) {
        const webhookToken = headers["x-webhook-verification-token"];
        if (!webhookToken || webhookToken !== env.INBOUND_WEBHOOK_TOKEN) {
          console.warn(`[webhooks] Invalid or missing webhook token for inbound email`);
          set.status = 401;
          return { error: "Invalid webhook token" };
        }
      } else if (env.NODE_ENV === "production") {
        console.error(`[webhooks] INBOUND_WEBHOOK_TOKEN not configured in production!`);
        set.status = 500;
        return { error: "Webhook verification not configured" };
      } else {
        console.warn(`[webhooks] INBOUND_WEBHOOK_TOKEN not set - skipping verification in dev`);
      }

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
  )
  // Track buy button clicks
  .post(
    "/track/buy-click",
    async ({ body }) => {
      const { plan, userEmail, userName, isSignedIn, deviceType, browser, os, referrer, page } = body;

      console.log(`[webhooks] Buy button clicked: ${plan} (signed in: ${isSignedIn}, device: ${deviceType})`);

      // Send notification email (fire and forget)
      sendBuyClickNotification({
        plan: plan as "monthly" | "annual",
        userEmail,
        userName,
        isSignedIn,
        deviceType,
        browser,
        os,
        referrer,
        page,
      }).catch((error) => {
        console.error(`[webhooks] Failed to send buy click notification:`, error);
      });

      return { tracked: true };
    },
    {
      body: t.Object({
        plan: t.String(),
        userEmail: t.Optional(t.String()),
        userName: t.Optional(t.String()),
        isSignedIn: t.Boolean(),
        deviceType: t.Optional(t.String()),
        browser: t.Optional(t.String()),
        os: t.Optional(t.String()),
        referrer: t.Optional(t.String()),
        page: t.Optional(t.String()),
      }),
    }
  );

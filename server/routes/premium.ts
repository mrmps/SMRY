/**
 * Premium Status Route
 * Simple endpoint to check if user has premium subscription
 */

import { Elysia } from "elysia";
import { getAuthInfo } from "../middleware/auth";

export const premiumRoutes = new Elysia()
  .get("/premium", async ({ request }) => {
    const { isPremium, userId } = await getAuthInfo(request);
    return { isPremium, userId: userId ? true : false }; // Don't expose actual userId
  });

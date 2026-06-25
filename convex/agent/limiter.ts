import { DAY, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { Id } from "../_generated/dataModel";

export const PRO_DAILY_MESSAGE_LIMIT = 50;

export const aiRateLimiter = new RateLimiter(components.rateLimiter, {
  aiMessagesDaily: {
    kind: "fixed window",
    rate: PRO_DAILY_MESSAGE_LIMIT,
    period: DAY,
  },
});

export function aiMessageKey(
  orgId: Id<"organizations">,
  userId: Id<"users">
): string {
  return `${orgId}:${userId}`;
}

export function threadUserKey(
  orgId: Id<"organizations">,
  userId: Id<"users">
): string {
  return `${orgId}:${userId}`;
}

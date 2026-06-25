import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { getAuthContext, getCurrentUser } from "./auth";


export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { user };
  })
);

export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { user };
  })
);

export const orgQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    return await getAuthContext(ctx);
  })
);

export const orgMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    return await getAuthContext(ctx);
  })
);

/** Org-scoped mutation restricted to org admins. */
export const orgAdminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);
    if (auth.membership.role !== "admin") {
      throw new Error("Admin access required");
    }
    return auth;
  })
);

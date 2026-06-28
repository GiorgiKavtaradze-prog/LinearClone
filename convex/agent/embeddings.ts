import { embed, embedMany } from "ai";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { orgMutation } from "../lib/customFunctions";
import { hasAiAccess } from "../lib/limits";
import { embeddingModel, isAiConfigured } from "./models";

const BACKFILL_BATCH_SIZE = 16;

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text.slice(0, 8000),
  });
  return embedding;
}

export const embedIssue = internalAction({
  args: { issueId: v.id("issues") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!isAiConfigured()) {
      console.warn("Skipping issue embedding: OPENAI_API_KEY is not set");
      return null;
    }
    const source = await ctx.runQuery(
      internal.agent.data.issueEmbeddingSource,
      { issueId: args.issueId }
    );
    if (!source) {
      return null;
    }
    const embedding = await embedText(source.text);
    await ctx.runMutation(internal.agent.data.saveIssueEmbeddings, {
      orgId: source.orgId,
      items: [{ issueId: args.issueId, embedding }],
    });
    return null;
  },
});

export const backfillOrgEmbeddings = internalAction({
  args: { orgId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!isAiConfigured()) {
      console.warn("Skipping embedding backfill: OPENAI_API_KEY is not set");
      return null;
    }
    const batch = await ctx.runQuery(
      internal.agent.data.issuesMissingEmbeddings,
      { orgId: args.orgId, limit: BACKFILL_BATCH_SIZE }
    );
    if (batch.length === 0) {
      return null;
    }
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch.map((item) => item.text.slice(0, 8000)),
    });
    await ctx.runMutation(internal.agent.data.saveIssueEmbeddings, {
      orgId: args.orgId,
      items: batch.map((item, index) => ({
        issueId: item.issueId,
        embedding: embeddings[index],
      })),
    });
    if (batch.length === BACKFILL_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.agent.embeddings.backfillOrgEmbeddings,
        { orgId: args.orgId }
      );
    }
    return null;
  },
});

export const ensureOrgEmbeddings = orgMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    if (!hasAiAccess(ctx.org)) {
      return null;
    }
    const missing = await ctx.db
      .query("issues")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.org._id))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field("embedding"), undefined))
      .take(1);
    if (missing.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.agent.embeddings.backfillOrgEmbeddings,
        { orgId: ctx.org._id }
      );
    }
    return null;
  },
});

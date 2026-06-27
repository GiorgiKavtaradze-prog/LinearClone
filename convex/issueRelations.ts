import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { getOrgIssue } from "./issues";
import { logActivity } from "./lib/activity";
import { orgMutation, orgQuery } from "./lib/customFunctions";
import {
  issuePriorityValidator,
  issueRelationTypeValidator,
  issueStatusValidator,
} from "./schema";

const displayRelationTypeValidator = v.union(
  v.literal("blocks"),
  v.literal("blocked_by"),
  v.literal("related"),
  v.literal("duplicate_of"),
  v.literal("duplicated_by")
);

const issueSummaryValidator = v.object({
  _id: v.id("issues"),
  identifier: v.string(),
  title: v.string(),
  status: issueStatusValidator,
  priority: issuePriorityValidator,
  assigneeId: v.optional(v.id("users")),
});

type IssueSummary = {
  _id: Id<"issues">;
  identifier: string;
  title: string;
  status: Doc<"issues">["status"];
  priority: Doc<"issues">["priority"];
  assigneeId?: Id<"users">;
};

type TeamCache = Map<Id<"teams">, Doc<"teams"> | null>;

async function summarizeIssue(
  ctx: { db: QueryCtx["db"] },
  issue: Doc<"issues">,
  teamCache: TeamCache
): Promise<IssueSummary> {
  if (!teamCache.has(issue.teamId)) {
    teamCache.set(issue.teamId, await ctx.db.get(issue.teamId));
  }
  const team = teamCache.get(issue.teamId) ?? null;
  return {
    _id: issue._id,
    identifier: `${team?.key ?? "?"}-${issue.number}`,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    assigneeId: issue.assigneeId,
  };
}

async function issueIdentifier(
  ctx: { db: QueryCtx["db"] },
  issue: Doc<"issues">,
  teamCache: TeamCache
): Promise<string> {
  return (await summarizeIssue(ctx, issue, teamCache)).identifier;
}

type StoredRelationType = Doc<"issueRelations">["type"];
type DisplayRelationType = StoredRelationType | "duplicated_by";
const INVERSE: Record<StoredRelationType, DisplayRelationType> = {
  blocks: "blocked_by",
  blocked_by: "blocks",
  related: "related",
  duplicate_of: "duplicated_by",
};

export const listForIssue = orgQuery({
  args: { issueId: v.id("issues") },
  returns: v.array(
    v.object({
      relationId: v.id("issueRelations"),
      type: displayRelationTypeValidator,
      issue: issueSummaryValidator,
    })
  ),
  handler: async (ctx, args) => {
    await getOrgIssue(ctx, ctx.org._id, args.issueId);
    const teamCache: TeamCache = new Map();

    const outgoing = await ctx.db
      .query("issueRelations")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .collect();
    const incoming = await ctx.db
      .query("issueRelations")
      .withIndex("by_related", (q) => q.eq("relatedIssueId", args.issueId))
      .collect();

    const result = [];
    for (const relation of outgoing) {
      const other = await ctx.db.get(relation.relatedIssueId);
      if (!other || other.orgId !== ctx.org._id) {
        continue;
      }
      result.push({
        relationId: relation._id,
        type: relation.type as DisplayRelationType,
        issue: await summarizeIssue(ctx, other, teamCache),
      });
    }
    for (const relation of incoming) {
      const other = await ctx.db.get(relation.issueId);
      if (!other || other.orgId !== ctx.org._id) {
        continue;
      }
      result.push({
        relationId: relation._id,
        type: INVERSE[relation.type],
        issue: await summarizeIssue(ctx, other, teamCache),
      });
    }
    return result;
  },
});

export const create = orgMutation({
  args: {
    issueId: v.id("issues"),
    relatedIssueId: v.id("issues"),
    type: issueRelationTypeValidator,
  },
  returns: v.id("issueRelations"),
  handler: async (ctx, args) => {
    if (args.issueId === args.relatedIssueId) {
      throw new Error("An issue cannot be related to itself");
    }
    const issue = await getOrgIssue(ctx, ctx.org._id, args.issueId);
    const related = await getOrgIssue(ctx, ctx.org._id, args.relatedIssueId);
    let fromIssue = issue;
    let toIssue = related;
    let type: StoredRelationType = args.type;
    if (type === "blocked_by") {
      fromIssue = related;
      toIssue = issue;
      type = "blocks";
    }

    const existingOutgoing = await ctx.db
      .query("issueRelations")
      .withIndex("by_issue", (q) => q.eq("issueId", issue._id))
      .collect();
    const existingIncoming = await ctx.db
      .query("issueRelations")
      .withIndex("by_related", (q) => q.eq("relatedIssueId", issue._id))
      .collect();
    const alreadyLinked =
      existingOutgoing.some((r) => r.relatedIssueId === related._id) ||
      existingIncoming.some((r) => r.issueId === related._id);
    if (alreadyLinked) {
      throw new Error("These issues are already linked");
    }

    const relationId = await ctx.db.insert("issueRelations", {
      issueId: fromIssue._id,
      relatedIssueId: toIssue._id,
      type,
    });

    const teamCache: TeamCache = new Map();
    const fromIdentifier = await issueIdentifier(ctx, fromIssue, teamCache);
    const toIdentifier = await issueIdentifier(ctx, toIssue, teamCache);
    await logActivity(ctx, {
      orgId: ctx.org._id,
      issueId: fromIssue._id,
      actorId: ctx.user._id,
      type: "relation_added",
      field: type,
      newValue: toIdentifier,
    });
    await logActivity(ctx, {
      orgId: ctx.org._id,
      issueId: toIssue._id,
      actorId: ctx.user._id,
      type: "relation_added",
      field: INVERSE[type],
      newValue: fromIdentifier,
    });

    return relationId;
  },
});

export const remove = orgMutation({
  args: { relationId: v.id("issueRelations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const relation = await ctx.db.get(args.relationId);
    if (!relation) {
      throw new Error("Relation not found");
    }
    const fromIssue = await getOrgIssue(ctx, ctx.org._id, relation.issueId);
    const toIssue = await getOrgIssue(
      ctx,
      ctx.org._id,
      relation.relatedIssueId
    );

    await ctx.db.delete(relation._id);

    const teamCache: TeamCache = new Map();
    const fromIdentifier = await issueIdentifier(ctx, fromIssue, teamCache);
    const toIdentifier = await issueIdentifier(ctx, toIssue, teamCache);
    await logActivity(ctx, {
      orgId: ctx.org._id,
      issueId: fromIssue._id,
      actorId: ctx.user._id,
      type: "relation_removed",
      field: relation.type,
      oldValue: toIdentifier,
    });
    await logActivity(ctx, {
      orgId: ctx.org._id,
      issueId: toIssue._id,
      actorId: ctx.user._id,
      type: "relation_removed",
      field: INVERSE[relation.type],
      oldValue: fromIdentifier,
    });
    return null;
  },
});

export const hierarchy = orgQuery({
  args: { issueId: v.id("issues") },
  returns: v.object({
    parent: v.union(issueSummaryValidator, v.null()),
    subIssues: v.array(issueSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const issue = await getOrgIssue(ctx, ctx.org._id, args.issueId);
    const teamCache: TeamCache = new Map();

    let parent: IssueSummary | null = null;
    if (issue.parentIssueId) {
      const parentIssue = await ctx.db.get(issue.parentIssueId);
      if (parentIssue && parentIssue.orgId === ctx.org._id) {
        parent = await summarizeIssue(ctx, parentIssue, teamCache);
      }
    }

    const children = await ctx.db
      .query("issues")
      .withIndex("by_parent", (q) => q.eq("parentIssueId", issue._id))
      .collect();
    children.sort((a, b) => a.number - b.number);

    const subIssues = [];
    for (const child of children) {
      if (child.orgId !== ctx.org._id) {
        continue;
      }
      subIssues.push(await summarizeIssue(ctx, child, teamCache));
    }
    return { parent, subIssues };
  },
});

export const setParent = orgMutation({
  args: {
    issueId: v.id("issues"),
    parentIssueId: v.union(v.id("issues"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const issue = await getOrgIssue(ctx, ctx.org._id, args.issueId);
    if ((issue.parentIssueId ?? null) === args.parentIssueId) {
      return null;
    }
    const teamCache: TeamCache = new Map();

    let newParentIdentifier: string | undefined;
    if (args.parentIssueId !== null) {
      if (args.parentIssueId === issue._id) {
        throw new Error("An issue cannot be its own parent");
      }
      const parent = await getOrgIssue(ctx, ctx.org._id, args.parentIssueId);

      let ancestorId: Id<"issues"> | undefined = parent.parentIssueId;
      for (let depth = 0; ancestorId && depth < 100; depth++) {
        if (ancestorId === issue._id) {
          throw new Error(
            "Cannot set a sub-issue of this issue as its parent"
          );
        }
        const ancestor: Doc<"issues"> | null = await ctx.db.get(ancestorId);
        ancestorId =
          ancestor && ancestor.orgId === ctx.org._id
            ? ancestor.parentIssueId
            : undefined;
      }
      newParentIdentifier = await issueIdentifier(ctx, parent, teamCache);
    }

    let oldParentIdentifier: string | undefined;
    if (issue.parentIssueId) {
      const oldParent = await ctx.db.get(issue.parentIssueId);
      if (oldParent && oldParent.orgId === ctx.org._id) {
        oldParentIdentifier = await issueIdentifier(ctx, oldParent, teamCache);
      }
    }

    await ctx.db.patch(issue._id, {
      parentIssueId: args.parentIssueId ?? undefined,
    });

    await logActivity(ctx, {
      orgId: ctx.org._id,
      issueId: issue._id,
      actorId: ctx.user._id,
      type: "parent_changed",
      field: "parent",
      oldValue: oldParentIdentifier,
      newValue: newParentIdentifier,
    });
    return null;
  },
});

export const searchIssues = orgQuery({
  args: {
    query: v.string(),
    excludeIssueId: v.optional(v.id("issues")),
  },
  returns: v.array(issueSummaryValidator),
  handler: async (ctx, args) => {
    const term = args.query.trim();
    const matches = term
      ? await ctx.db
          .query("issues")
          .withSearchIndex("search_title", (q) =>
            q.search("title", term).eq("orgId", ctx.org._id)
          )
          .take(15)
      : await ctx.db
          .query("issues")
          .withIndex("by_org", (q) => q.eq("orgId", ctx.org._id))
          .order("desc")
          .take(15);

    const teamCache: TeamCache = new Map();
    const result = [];
    for (const issue of matches) {
      if (issue._id === args.excludeIssueId) {
        continue;
      }
      result.push(await summarizeIssue(ctx, issue, teamCache));
    }
    return result;
  },
});

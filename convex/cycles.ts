import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { issueShape } from "./issues";
import { logActivity } from "./lib/activity";
import { orgMutation, orgQuery } from "./lib/customFunctions";
import { progressShape } from "./projects";

type DbContext = { db: QueryCtx["db"] };

export const cycleShape = {
  _id: v.id("cycles"),
  _creationTime: v.number(),
  orgId: v.id("organizations"),
  teamId: v.id("teams"),
  number: v.number(),
  name: v.optional(v.string()),
  startDate: v.number(),
  endDate: v.number(),
};

async function getOrgCycle(
  ctx: DbContext,
  orgId: Id<"organizations">,
  cycleId: Id<"cycles">
): Promise<Doc<"cycles">> {
  const cycle = await ctx.db.get(cycleId);
  if (!cycle || cycle.orgId !== orgId) {
    throw new Error("Cycle not found");
  }
  return cycle;
}

async function getOrgTeam(
  ctx: DbContext,
  orgId: Id<"organizations">,
  teamId: Id<"teams">
): Promise<Doc<"teams">> {
  const team = await ctx.db.get(teamId);
  if (!team || team.orgId !== orgId) {
    throw new Error("Team not found");
  }
  return team;
}

function assertValidCycleDateRange(startDate: number, endDate: number): void {
  if (endDate <= startDate) {
    throw new Error("Cycle end date must be after its start date");
  }
}

function normalizeCycleName(name: string | null | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed ? trimmed : undefined;
}

function createEmptyProgress() {
  return {
    total: 0,
    backlog: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
    canceled: 0,
  };
}

async function countProgress(
  ctx: DbContext,
  orgId: Id<"organizations">,
  cycleId: Id<"cycles">
) {
  const issues = await ctx.db
    .query("issues")
    .withIndex("by_cycle", (q) => q.eq("cycleId", cycleId))
    .collect();
  const progress = createEmptyProgress();
  for (const issue of issues) {
    if (issue.orgId !== orgId) {
      continue;
    }
    progress.total += 1;
    progress[issue.status] += 1;
  }
  return progress;
}

export const listByTeam = orgQuery({
  args: { teamId: v.id("teams") },
  returns: v.array(v.object(cycleShape)),
  handler: async (ctx, args) => {
    await getOrgTeam(ctx, ctx.org._id, args.teamId);
    return await ctx.db
      .query("cycles")
      .withIndex("by_team_and_number", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
  },
});

export const listWithProgress = orgQuery({
  args: {},
  returns: v.array(
    v.object({
      ...cycleShape,
      teamName: v.string(),
      teamKey: v.string(),
      progress: progressShape,
    })
  ),
  handler: async (ctx) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.org._id))
      .collect();
    const result = [];
    for (const team of teams) {
      const cycles = await ctx.db
        .query("cycles")
        .withIndex("by_team_and_number", (q) => q.eq("teamId", team._id))
        .order("desc")
        .collect();
      for (const cycle of cycles) {
        result.push({
          ...cycle,
          teamName: team.name,
          teamKey: team.key,
          progress: await countProgress(ctx, ctx.org._id, cycle._id),
        });
      }
    }
    return result;
  },
});

export const get = orgQuery({
  args: { cycleId: v.id("cycles") },
  returns: v.union(v.object(cycleShape), v.null()),
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.orgId !== ctx.org._id) {
      return null;
    }
    return cycle;
  },
});

export const currentForTeam = orgQuery({
  args: { teamId: v.id("teams") },
  returns: v.union(v.object(cycleShape), v.null()),
  handler: async (ctx, args) => {
    await getOrgTeam(ctx, ctx.org._id, args.teamId);
    const cycles = await ctx.db
      .query("cycles")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    const now = Date.now();
    const active = cycles
      .filter((cycle) => cycle.startDate <= now && now <= cycle.endDate)
      .sort((a, b) => b.startDate - a.startDate);
    return active[0] ?? null;
  },
});

export const listIssues = orgQuery({
  args: { cycleId: v.id("cycles") },
  returns: v.array(v.object(issueShape)),
  handler: async (ctx, args) => {
    await getOrgCycle(ctx, ctx.org._id, args.cycleId);
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    return issues.filter((issue) => issue.orgId === ctx.org._id);
  },
});

export const candidateIssues = orgQuery({
  args: { cycleId: v.id("cycles") },
  returns: v.array(v.object(issueShape)),
  handler: async (ctx, args) => {
    const cycle = await getOrgCycle(ctx, ctx.org._id, args.cycleId);
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_team", (q) => q.eq("teamId", cycle.teamId))
      .order("desc")
      .take(500);
    return issues
      .filter(
        (issue) => issue.orgId === ctx.org._id && issue.cycleId !== args.cycleId
      )
      .slice(0, 200);
  },
});

export const create = orgMutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.id("cycles"),
  handler: async (ctx, args) => {
    await getOrgTeam(ctx, ctx.org._id, args.teamId);
    assertValidCycleDateRange(args.startDate, args.endDate);

    const latest = await ctx.db
      .query("cycles")
      .withIndex("by_team_and_number", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .first();
    const number = (latest?.number ?? 0) + 1;

    return await ctx.db.insert("cycles", {
      orgId: ctx.org._id,
      teamId: args.teamId,
      number,
      name: normalizeCycleName(args.name),
      startDate: args.startDate,
      endDate: args.endDate,
    });
  },
});

export const update = orgMutation({
  args: {
    cycleId: v.id("cycles"),
    name: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cycle = await getOrgCycle(ctx, ctx.org._id, args.cycleId);

    const startDate = args.startDate ?? cycle.startDate;
    const endDate = args.endDate ?? cycle.endDate;
    assertValidCycleDateRange(startDate, endDate);

    const updates: Partial<Doc<"cycles">> = {};
    if (args.name !== undefined) {
      updates.name = normalizeCycleName(args.name);
    }
    if (args.startDate !== undefined) {
      updates.startDate = args.startDate;
    }
    if (args.endDate !== undefined) {
      updates.endDate = args.endDate;
    }

    await ctx.db.patch(cycle._id, updates);
    return null;
  },
});

export const remove = orgMutation({
  args: { cycleId: v.id("cycles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cycle = await getOrgCycle(ctx, ctx.org._id, args.cycleId);

    const issues = await ctx.db
      .query("issues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", cycle._id))
      .collect();
    for (const issue of issues) {
      if (issue.orgId !== ctx.org._id) {
        continue;
      }
      await ctx.db.patch(issue._id, { cycleId: undefined });
      await logActivity(ctx, {
        orgId: ctx.org._id,
        issueId: issue._id,
        actorId: ctx.user._id,
        type: "cycle_changed",
        field: "cycle",
        oldValue: cycle.name ?? `Cycle ${cycle.number}`,
        newValue: undefined,
      });
    }

    await ctx.db.delete(cycle._id);
    return null;
  },
});

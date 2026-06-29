import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  IssuePriority,
  IssueStatus,
  PRIORITIES,
  STATUSES,
} from "@/components/shared/issue-meta";

export const UNASSIGNED_FILTER = "unassigned";

export type DisplayMode = "board" | "list";

export type IssueFilters = {
  statuses: IssueStatus[];
  priorities: IssuePriority[];
  assignees: string[];
  labels: string[];
};

export const EMPTY_FILTERS: IssueFilters = {
  statuses: [],
  priorities: [],
  assignees: [],
  labels: [],
};

const QUERY_KEYS = {
  view: "view",
  status: "status",
  priority: "priority",
  assignee: "assignee",
  label: "label",
} as const;

const STATUS_VALUES = new Set<string>(STATUSES.map((s) => s.value));
const PRIORITY_VALUES = new Set<string>(PRIORITIES.map((p) => p.value));

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function parseList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return uniqueValues(value.split(",").map((part) => part.trim())).filter(
    Boolean
  );
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return uniqueValues(
    value.filter((item): item is string => typeof item === "string")
  );
}

function filterKnownValues<T extends string>(
  values: string[],
  knownValues: Set<string>
): T[] {
  return values.filter((value): value is T => knownValues.has(value));
}

export function sanitizeFilters(input: unknown): IssueFilters {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    statuses: filterKnownValues<IssueStatus>(
      sanitizeStringArray(raw.statuses),
      STATUS_VALUES
    ),
    priorities: filterKnownValues<IssuePriority>(
      sanitizeStringArray(raw.priorities),
      PRIORITY_VALUES
    ),
    assignees: sanitizeStringArray(raw.assignees),
    labels: sanitizeStringArray(raw.labels),
  };
}

type ParamsLike = { get(name: string): string | null };

export function filtersFromSearchParams(params: ParamsLike): IssueFilters {
  return sanitizeFilters({
    statuses: parseList(params.get(QUERY_KEYS.status)),
    priorities: parseList(params.get(QUERY_KEYS.priority)),
    assignees: parseList(params.get(QUERY_KEYS.assignee)),
    labels: parseList(params.get(QUERY_KEYS.label)),
  });
}

export function displayFromSearchParams(params: ParamsLike): DisplayMode {
  return params.get(QUERY_KEYS.view) === "list" ? "list" : "board";
}

export function toQueryString(
  filters: IssueFilters,
  display: DisplayMode
): string {
  const params = new URLSearchParams();
  if (display === "list") {
    params.set(QUERY_KEYS.view, "list");
  }
  if (filters.statuses.length > 0) {
    params.set(QUERY_KEYS.status, filters.statuses.join(","));
  }
  if (filters.priorities.length > 0) {
    params.set(QUERY_KEYS.priority, filters.priorities.join(","));
  }
  if (filters.assignees.length > 0) {
    params.set(QUERY_KEYS.assignee, filters.assignees.join(","));
  }
  if (filters.labels.length > 0) {
    params.set(QUERY_KEYS.label, filters.labels.join(","));
  }
  return params.toString();
}

export function countActiveFilters(filters: IssueFilters): number {
  return (
    filters.statuses.length +
    filters.priorities.length +
    filters.assignees.length +
    filters.labels.length
  );
}

export function issueMatchesFilters(
  issue: Doc<"issues">,
  filters: IssueFilters,
  labelIdsByIssue: Map<Id<"issues">, Set<string>>
): boolean {
  if (
    filters.statuses.length > 0 &&
    !filters.statuses.includes(issue.status)
  ) {
    return false;
  }
  if (
    filters.priorities.length > 0 &&
    !filters.priorities.includes(issue.priority)
  ) {
    return false;
  }
  if (filters.assignees.length > 0) {
    const matches = filters.assignees.some((assignee) =>
      assignee === UNASSIGNED_FILTER
        ? issue.assigneeId === undefined
        : issue.assigneeId === assignee
    );
    if (!matches) {
      return false;
    }
  }
  if (filters.labels.length > 0) {
    const labelIds = labelIdsByIssue.get(issue._id);
    if (!labelIds || !filters.labels.some((label) => labelIds.has(label))) {
      return false;
    }
  }
  return true;
}

export type SavedViewPayload = {
  v: 1;
  teamId: string;
  display: DisplayMode;
  filters: IssueFilters;
};

export function savedViewFingerprint(payload: SavedViewPayload): string {
  return JSON.stringify({
    teamId: payload.teamId,
    display: payload.display,
    statuses: [...payload.filters.statuses].sort(),
    priorities: [...payload.filters.priorities].sort(),
    assignees: [...payload.filters.assignees].sort(),
    labels: [...payload.filters.labels].sort(),
  });
}

export function serializeSavedView(payload: {
  teamId: string;
  display: DisplayMode;
  filters: IssueFilters;
}): string {
  return JSON.stringify({ v: 1, ...payload } satisfies SavedViewPayload);
}

export function parseSavedView(raw: string): SavedViewPayload | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data !== "object" || data === null) {
      return null;
    }
    if (typeof data.teamId !== "string" || data.teamId.length === 0) {
      return null;
    }
    return {
      v: 1,
      teamId: data.teamId,
      display: data.display === "list" ? "list" : "board",
      filters: sanitizeFilters(data.filters),
    };
  } catch {
    return null;
  }
}

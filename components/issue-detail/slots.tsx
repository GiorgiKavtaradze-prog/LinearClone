import { ComponentType } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { IssueProjectCyclePanel } from "@/components/projects/issue-project-cycle-panel";

/**
 * Issue detail extension slots.
 *
 * PARALLEL-TRACK REGISTRY FILE: tracks register their issue-detail panels
 * here with one-line additions (import your component, append to the array).
 *
 * - `issueDetailMainSlots` render under the description (Track C: comments,
 *   activity feed, sub-issues; Track D: AI triage suggestions).
 * - `issueDetailSidebarSlots` render at the bottom of the properties sidebar
 *   (Track C: labels, attachments, relations).
 */
export type IssueDetailSlotProps = {
  issue: Doc<"issues">;
  team: Doc<"teams">;
};

// Example: import { CommentsPanel } from "@/components/issue-detail/comments-panel";

export const issueDetailMainSlots: ComponentType<IssueDetailSlotProps>[] = [
  // ...CommentsPanel,
];

export const issueDetailSidebarSlots: ComponentType<IssueDetailSlotProps>[] = [
  // ...LabelsSection,
  IssueProjectCyclePanel,
];

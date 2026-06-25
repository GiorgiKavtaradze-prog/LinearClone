import { ComponentType } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { IssueProjectCyclePanel } from "@/components/projects/issue-project-cycle-panel";

export type IssueDetailSlotProps = {
  issue: Doc<"issues">;
  team: Doc<"teams">;
};

import { ActivitySection } from "@/components/issue-detail/activity-section";
import { SubIssuesPanel } from "@/components/issue-detail/sub-issues-panel";
import { PresencePanel } from "@/components/issue-detail/presence-panel";
import { LabelsPanel } from "@/components/issue-detail/labels-panel";
import { RelationsPanel } from "@/components/issue-detail/relations-panel";
import { AttachmentsPanel } from "@/components/issue-detail/attachments-panel";
import { PlanLimitListener } from "@/components/billing/upgrade-prompt";
import { AiTriagePanel } from "@/components/ai/triage-panel";

export const issueDetailMainSlots: ComponentType<IssueDetailSlotProps>[] = [
  SubIssuesPanel,
  ActivitySection,
  AiTriagePanel,
  PlanLimitListener,
];

export const issueDetailSidebarSlots: ComponentType<IssueDetailSlotProps>[] = [
  PresencePanel,
  LabelsPanel,
  RelationsPanel,
  AttachmentsPanel,
  IssueProjectCyclePanel,
];

import { LucideIcon } from "lucide-react";
import { projectCycleCommands } from "@/components/projects/commands";

export type AppCommand = {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  run: (helpers: CommandHelpers) => void;
};

export type CommandHelpers = {
  push: (path: string) => void;
  orgSlug: string;
  openCreateIssue: () => void;
  toggleTheme: () => void;
};

const builtinCommands: AppCommand[] = [
  {
    id: "create-issue",
    label: "Create new issue",
    group: "Issues",
    shortcut: "c",
    run: ({ openCreateIssue }) => openCreateIssue(),
  },
  {
    id: "go-home",
    label: "Go to workspace home",
    group: "Navigation",
    run: ({ push, orgSlug }) => push(`/${orgSlug}`),
  },
  {
    id: "toggle-theme",
    label: "Toggle light/dark theme",
    group: "Preferences",
    run: ({ toggleTheme }) => toggleTheme(),
  },
];

import { boardViewCommands } from "@/components/board/commands";
import { billingCommands } from "@/components/billing/commands";
import { aiCommands } from "@/components/ai/commands";

export const appCommands: AppCommand[] = [
  ...builtinCommands,
  ...boardViewCommands,
  ...projectCycleCommands,
  ...billingCommands,
  ...aiCommands,
];

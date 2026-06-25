import { CalendarPlus, FolderKanban, FolderPlus, RefreshCcw } from "lucide-react";
import type { AppCommand } from "@/components/commands/registry";

export const projectCycleCommands: AppCommand[] = [
  {
    id: "go-projects",
    label: "Go to projects",
    group: "Navigation",
    icon: FolderKanban,
    run: ({ push, orgSlug }) => push(`/${orgSlug}/projects`),
  },
  {
    id: "go-cycles",
    label: "Go to cycles",
    group: "Navigation",
    icon: RefreshCcw,
    run: ({ push, orgSlug }) => push(`/${orgSlug}/cycles`),
  },
  {
    id: "create-project",
    label: "Create new project",
    group: "Projects",
    icon: FolderPlus,
    run: ({ push, orgSlug }) => push(`/${orgSlug}/projects?new=true`),
  },
  {
    id: "create-cycle",
    label: "Create new cycle",
    group: "Cycles",
    icon: CalendarPlus,
    run: ({ push, orgSlug }) => push(`/${orgSlug}/cycles?new=true`),
  },
];

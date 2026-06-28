import { Columns3, LayoutList, Search } from "lucide-react";
import { AppCommand } from "@/components/commands/registry";

function currentTeamId(): string | null {
  const match = window.location.pathname.match(/\/team\/([^/]+)/);
  return match ? match[1] : null;
}

export const boardViewCommands: AppCommand[] = [
  {
    id: "go-board",
    label: "Go to team board",
    group: "Navigation",
    icon: Columns3,
    shortcut: "b",
    run: ({ push, orgSlug }) => {
      const teamId = currentTeamId();
      if (teamId) {
        push(`/${orgSlug}/team/${teamId}/board`);
      }
    },
  },
  {
    id: "toggle-board-display",
    label: "Toggle board / list display",
    group: "Navigation",
    icon: LayoutList,
    shortcut: "v",
    run: ({ push, orgSlug }) => {
      const teamId = currentTeamId();
      if (!teamId || !window.location.pathname.includes("/board")) {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "list") {
        params.delete("view");
      } else {
        params.set("view", "list");
      }
      const query = params.toString();
      push(`/${orgSlug}/team/${teamId}/board${query ? `?${query}` : ""}`);
    },
  },
  {
    id: "go-search",
    label: "Search issues",
    group: "Navigation",
    icon: Search,
    shortcut: "/",
    run: ({ push, orgSlug }) => push(`/${orgSlug}/search`),
  },
];

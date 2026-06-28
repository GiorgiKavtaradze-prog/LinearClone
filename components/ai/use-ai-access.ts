"use client";

import { useAuth } from "@clerk/nextjs";

export function useAiAccess(): { isLoaded: boolean; hasAccess: boolean } {
  const { isLoaded, has } = useAuth();
  return {
    isLoaded,
    hasAccess: isLoaded ? (has?.({ feature: "ai_agent" }) ?? false) : false,
  };
}

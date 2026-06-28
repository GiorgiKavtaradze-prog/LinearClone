"use client";

import { useOrganization } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast, useSonner } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRO_PLAN } from "@/lib/plans";
import {
  matchPlanLimitMessage,
  PLAN_LIMIT_COPY,
  PlanLimitKind,
} from "./plan-limit-error";

export function UpgradePromptDialog({
  open,
  onOpenChange,
  limit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limit: PlanLimitKind;
}) {
  const params = useParams<{ orgSlug?: string }>();
  const { membership } = useOrganization();
  const isAdmin = membership?.role === "org:admin";
  const copy = PLAN_LIMIT_COPY[limit];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-8 items-center justify-center rounded-md bg-primary/15">
            <Sparkles className="size-4 text-primary" />
          </div>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3">
          {PRO_PLAN.highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Check className="size-3.5 shrink-0 text-primary" />
              {highlight}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pricing">
              Compare plans
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
          {isAdmin ? (
            <CheckoutButton
              planId={PRO_PLAN.clerkPlanId}
              planPeriod="month"
              for="organization"
              onSubscriptionComplete={() => {
                toast.success("Welcome to Vector Pro");
                onOpenChange(false);
              }}
              newSubscriptionRedirectUrl={
                params.orgSlug
                  ? `/${params.orgSlug}/settings/billing`
                  : undefined
              }
            >
              <Button size="sm">
                Upgrade to Pro · ${PRO_PLAN.monthlyPrice}/mo
              </Button>
            </CheckoutButton>
          ) : (
            <Button size="sm" disabled>
              Ask an admin to upgrade
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const seenToastIds = new Set<string | number>();

export function PlanLimitListener() {
  const { toasts } = useSonner();
  const pendingKindRef = useRef<PlanLimitKind | null>(null);
  const [limit, setLimit] = useState<PlanLimitKind | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    for (const t of toasts) {
      if (seenToastIds.has(t.id)) {
        continue;
      }
      seenToastIds.add(t.id);
      const title = typeof t.title === "string" ? t.title : "";
      const description =
        typeof t.description === "string" ? t.description : "";
      const match =
        matchPlanLimitMessage(title) ?? matchPlanLimitMessage(description);
      if (match) {
        pendingKindRef.current = match.kind;
      }
    }
    if (pendingKindRef.current === null) {
      return;
    }
    
    const timer = window.setTimeout(() => {
      if (pendingKindRef.current !== null) {
        setLimit(pendingKindRef.current);
        setOpen(true);
        pendingKindRef.current = null;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (limit === null) {
    return null;
  }

  return (
    <UpgradePromptDialog open={open} onOpenChange={setOpen} limit={limit} />
  );
}

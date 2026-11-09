"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Loader2, Megaphone } from "lucide-react";
import { Badge } from "@school/ui/components/badge";
import { Button } from "@school/ui/components/button";
import { Card, CardContent } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { api } from "@/lib/api-client";
import { cn, getErrorMessage } from "@/lib/utils";
import { notifyAnnouncementsChanged } from "@/hooks/useAnnouncementCounts";
import { OFFICE_SHORT } from "@/components/offices/office-labels";
import { AttachmentList } from "./attachments";
import { AUDIENCE_LABEL, type Inbox, type InboxItem } from "./types";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Filter = "all" | "unread" | "ack";

/**
 * Announcements from the education offices (Phase 8), for everyone at a school: the head
 * teacher and deputy see all of them, other staff those sent to all staff. Opening one records
 * that it was read; the head or deputy acknowledges those that ask for it.
 */
export function AnnouncementsInbox() {
  const [data, setData] = useState<Inbox | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [acking, setAcking] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<{ data: Inbox }>("/announcements")
      .then((r) => setData(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const toggle = (a: InboxItem) => {
    const next = open === a.id ? null : a.id;
    setOpen(next);
    if (next && !a.readAt) {
      api
        .post(`/announcements/${a.id}/read`)
        .then(() => {
          setData((d) =>
            d
              ? {
                  ...d,
                  unread: Math.max(0, d.unread - (a.withdrawnAt ? 0 : 1)),
                  announcements: d.announcements.map((x) => (x.id === a.id ? { ...x, readAt: new Date().toISOString() } : x)),
                }
              : d
          );
          notifyAnnouncementsChanged();
        })
        .catch(() => undefined);
    }
  };

  const acknowledge = async (a: InboxItem) => {
    setAcking(a.id);
    try {
      await api.post(`/announcements/${a.id}/acknowledge`);
      toast.success("Acknowledged for the school. The office can see it.");
      notifyAnnouncementsChanged();
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setAcking(null);
    }
  };

  const shown = (data?.announcements ?? []).filter((a) =>
    filter === "unread" ? !a.readAt : filter === "ack" ? a.needsAcknowledgement : true
  );

  return (
    <div className="space-y-4 p-4 lg:p-0">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Circulars from the district office (DEBS), the provincial office and Ministry HQ.</p>
      </div>

      {data && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${data.announcements.length})`],
              ["unread", `Unread (${data.unread})`],
              ...(data.toAcknowledge > 0 || data.announcements.some((a) => a.canAcknowledge) ? [["ack", `To acknowledge (${data.toAcknowledge})`]] : []),
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
              {label}
            </Button>
          ))}
        </div>
      )}

      {!data ? (
        <Skeleton className="h-64" />
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Megaphone className="h-5 w-5" />
            {filter === "all" ? "No announcements yet." : "Nothing here."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {shown.map((a) => {
            const isOpen = open === a.id;
            return (
              <Card key={a.id} className={cn(a.needsAcknowledgement && "border-amber-400", a.withdrawnAt && "opacity-75")}>
                <button type="button" onClick={() => toggle(a)} className="flex w-full items-start gap-3 p-4 text-left">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.readAt ? "bg-transparent" : "bg-blue-600")} aria-hidden />
                  <span className="flex-1">
                    <span className={cn("block", !a.readAt && "font-semibold")}>{a.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {OFFICE_SHORT[a.office.type]} {a.office.name} · {when(a.publishedAt)}
                      {a.attachments.length > 0 && ` · ${a.attachments.length} attachment(s)`}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {a.withdrawnAt && <Badge variant="outline">Withdrawn</Badge>}
                      {a.needsAcknowledgement && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">Acknowledge</Badge>
                      )}
                      {a.schoolAcknowledged && (
                        <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300">Acknowledged</Badge>
                      )}
                    </span>
                  </span>
                  <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {a.withdrawnAt && (
                      <div className="rounded-md border bg-muted p-3 text-sm">
                        Withdrawn by the office on {when(a.withdrawnAt)}
                        {a.withdrawReason ? `: ${a.withdrawReason}` : ""}
                      </div>
                    )}
                    <p className="whitespace-pre-line text-sm leading-relaxed">{a.body}</p>
                    <AttachmentList files={a.attachments} basePath={`/api/announcements/${a.id}`} />
                    <p className="text-xs text-muted-foreground">Sent to: {AUDIENCE_LABEL[a.audience].toLowerCase()}</p>
                    {a.requiresAck && (
                      <div className="flex flex-wrap items-center gap-3">
                        {a.schoolAcknowledged ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-300">
                            <CheckCircle2 className="h-4 w-4" />
                            Acknowledged for the school{a.schoolAcknowledged.by ? ` by ${a.schoolAcknowledged.by}` : ""} on {when(a.schoolAcknowledged.at)}
                          </span>
                        ) : a.canAcknowledge ? (
                          <Button onClick={() => acknowledge(a)} disabled={acking === a.id}>
                            {acking === a.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Acknowledge for the school
                          </Button>
                        ) : (
                          !a.withdrawnAt && <span className="text-sm text-muted-foreground">The office has asked the head teacher or deputy to acknowledge this.</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Undo2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { OFFICE_SHORT } from "@/components/offices/office-labels";
import { downloadCsv } from "@/components/finance/csv";
import { AttachmentList } from "@/components/announcements/attachments";
import { AUDIENCE_LABEL, type OfficeDetail } from "@/components/announcements/types";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

/** One announcement for the office (Phase 8): the message, and each school's progress. */
export default function OfficeAnnouncementPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<OfficeDetail | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "not-opened" | "not-acknowledged">("all");

  const load = useCallback(() => {
    api
      .get<{ data: OfficeDetail }>(`/office/announcements/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  const withdraw = async () => {
    setSaving(true);
    try {
      const r = await api.post<{ data: OfficeDetail }>(`/office/announcements/${id}/withdraw`, { reason });
      setData(r.data);
      setWithdrawing(false);
      setReason("");
      toast.success("Withdrawn. The schools see it marked as withdrawn.");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <Skeleton className="h-96" />;

  const rows = data.rows.filter((r) =>
    filter === "not-opened" ? r.readers === 0 : filter === "not-acknowledged" ? !r.acknowledgedAt : true
  );

  const exportCsv = () =>
    downloadCsv(
      `announcement-${data.title}-schools`,
      ["School", "EMIS number", "District", "Opened", "People who opened it", ...(data.requiresAck ? ["Acknowledged", "Acknowledged by"] : [])],
      data.rows.map((r) => [
        r.name,
        r.emisNumber ?? "",
        r.district,
        r.firstReadAt ? when(r.firstReadAt) : "No",
        r.readers,
        ...(data.requiresAck ? [r.acknowledgedAt ? when(r.acknowledgedAt) : "No", r.acknowledgedBy ?? ""] : []),
      ])
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/office/announcements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="h-3 w-3" /> Announcements
          </Link>
          <h1 className="text-xl font-bold">
            {data.title}
            {data.withdrawnAt && <Badge variant="outline" className="ml-2">Withdrawn</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.sentByMyOffice ? "From your office" : `From ${OFFICE_SHORT[data.office.type]} ${data.office.name}`}
            {data.publishedBy ? ` (${data.publishedBy})` : ""} · {when(data.publishedAt)} · {AUDIENCE_LABEL[data.audience]}
            {data.requiresAck && " · acknowledgement asked"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Schools
          </Button>
          {data.canWithdraw && (
            <Button variant="outline" onClick={() => setWithdrawing(true)}>
              <Undo2 className="mr-2 h-4 w-4" /> Withdraw
            </Button>
          )}
        </div>
      </div>

      {data.withdrawnAt && (
        <div className="rounded-md border bg-muted p-3 text-sm">
          Withdrawn on {when(data.withdrawnAt)}
          {data.withdrawReason ? `: ${data.withdrawReason}` : ""}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-base">Message</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-line text-sm leading-relaxed">{data.body}</p>
            <AttachmentList files={data.attachments} basePath={`/api/office/announcements/${data.id}`} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Progress</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-2xl font-semibold tabular-nums">{data.opened}</span> of {data.schools} school(s) have opened it
            </p>
            {data.requiresAck && (
              <p>
                <span className="text-2xl font-semibold tabular-nums">{data.acknowledged}</span> of {data.schools} have acknowledged it
              </p>
            )}
            <p className="text-xs text-muted-foreground">Counted over the schools in your area.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All schools</Button>
        <Button size="sm" variant={filter === "not-opened" ? "default" : "outline"} onClick={() => setFilter("not-opened")}>
          Not opened ({data.schools - data.opened})
        </Button>
        {data.requiresAck && (
          <Button size="sm" variant={filter === "not-acknowledged" ? "default" : "outline"} onClick={() => setFilter("not-acknowledged")}>
            Not acknowledged ({data.schools - data.acknowledged})
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead className="text-right">People</TableHead>
                {data.requiresAck && <TableHead>Acknowledged</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No schools</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.schoolId}>
                  <TableCell>
                    <Link href={`/office/schools/${r.schoolId}`} className="font-medium hover:underline">{r.name}</Link>
                    <span className="block text-xs text-muted-foreground">{r.emisNumber ?? "EMIS number pending"} · {r.district}</span>
                  </TableCell>
                  <TableCell className="text-sm">{r.firstReadAt ? when(r.firstReadAt) : <span className="text-muted-foreground">Not yet</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.readers}</TableCell>
                  {data.requiresAck && (
                    <TableCell className="text-sm">
                      {r.acknowledgedAt ? (
                        <>
                          {when(r.acknowledgedAt)}
                          {r.acknowledgedBy && <span className="block text-xs text-muted-foreground">{r.acknowledgedBy}</span>}
                        </>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">Not yet</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={withdrawing} onOpenChange={(o) => !o && setWithdrawing(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw this announcement</DialogTitle>
            <DialogDescription>
              The schools keep seeing it, marked as withdrawn with your reason, and can no longer acknowledge it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="wd-reason">Reason</Label>
            <Textarea id="wd-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Replaced by Circular 13/2026" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawing(false)}>Cancel</Button>
            <Button onClick={withdraw} disabled={saving || reason.trim().length < 3}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

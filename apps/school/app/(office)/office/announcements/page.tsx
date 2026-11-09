"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Megaphone, Paperclip, Plus, X } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Card, CardContent } from "@school/ui/components/card";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Checkbox } from "@school/ui/components/checkbox";
import { Skeleton } from "@school/ui/components/skeleton";
import { RadioGroup, RadioGroupItem } from "@school/ui/components/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api, authFetch } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { OFFICE_SHORT } from "@/components/offices/office-labels";
import { AUDIENCE_LABEL, type OfficeListItem } from "@/components/announcements/types";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
const MAX_FILES = 5;
const MAX_TOTAL = 9 * 1024 * 1024;

/** Announcements (Phase 8): circulars from this office (and the offices above) to the schools. */
export default function OfficeAnnouncementsPage() {
  const [data, setData] = useState<{ announcements: OfficeListItem[]; canPost: boolean } | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: { announcements: OfficeListItem[]; canPost: boolean } }>("/office/announcements")
      .then((r) => setData(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Circulars to the schools in your area. You see which schools have opened each one and, when you ask, which have acknowledged it.
          </p>
        </div>
        {data?.canPost && (
          <Button onClick={() => setComposing(true)}>
            <Plus className="mr-2 h-4 w-4" /> New announcement
          </Button>
        )}
      </div>

      {!data ? (
        <Skeleton className="h-64" />
      ) : data.announcements.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Megaphone className="h-5 w-5" /> No announcements yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.announcements.map((a) => (
            <Link key={a.id} href={`/office/announcements/${a.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {a.title}
                      {a.withdrawnAt && <Badge variant="outline" className="ml-2">Withdrawn</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.sentByMyOffice ? "From your office" : `From ${OFFICE_SHORT[a.office.type]} ${a.office.name}`} · {when(a.publishedAt)} ·{" "}
                      {AUDIENCE_LABEL[a.audience]}
                      {a.attachments.length > 0 && ` · ${a.attachments.length} attachment(s)`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 text-sm">
                    <Badge variant="outline" className="tabular-nums">
                      Opened {a.opened}/{a.schools}
                    </Badge>
                    {a.requiresAck && (
                      <Badge
                        variant="outline"
                        className={`tabular-nums ${a.acknowledged === a.schools ? "border-green-500 text-green-700 dark:text-green-300" : "border-amber-500 text-amber-700 dark:text-amber-300"}`}
                      >
                        Acknowledged {a.acknowledged}/{a.schools}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ComposeDialog open={composing} onClose={() => setComposing(false)} onPosted={load} />
    </div>
  );
}

function ComposeDialog({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted: () => void }) {
  const empty = { title: "", body: "", audience: "LEADERS" as "LEADERS" | "ALL_STAFF", requiresAck: false };
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const total = files.reduce((s, f) => s + f.size, 0);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok = [...list].filter((f) => /\.(pdf|png|jpe?g)$/i.test(f.name));
    if (ok.length < list.length) toast.error("Only PDF, PNG and JPEG files can be attached");
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_FILES));
    if (picker.current) picker.current.value = "";
  };

  const post = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("title", form.title);
      fd.set("body", form.body);
      fd.set("audience", form.audience);
      fd.set("requiresAck", String(form.requiresAck));
      for (const f of files) fd.append("files", f, f.name);
      // A form with files: authFetch (the browser sets the multipart boundary itself).
      const res = await authFetch("/api/office/announcements", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Couldn't post the announcement");
      toast.success("Posted. The schools can see it now.");
      setForm(empty);
      setFiles([]);
      onClose();
      onPosted();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>
            Goes to every active school in your area straight away. It can&apos;t be edited afterwards, only withdrawn.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="an-title">Title</Label>
            <Input id="an-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Circular 12/2026: Grade 9 examination timetable" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="an-body">Message</Label>
            <Textarea id="an-body" rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Who receives it</Label>
            <RadioGroup value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v as typeof form.audience })}>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="aud-leaders" value="LEADERS" />
                <Label htmlFor="aud-leaders" className="font-normal">Head teachers and deputies</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="aud-all" value="ALL_STAFF" />
                <Label htmlFor="aud-all" className="font-normal">All staff at the schools (teachers, clerks, finance staff too)</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="an-ack" checked={form.requiresAck} onCheckedChange={(c) => setForm({ ...form, requiresAck: c === true })} />
            <Label htmlFor="an-ack" className="font-normal leading-snug">
              Ask each school&apos;s head teacher or deputy to acknowledge it
              <span className="block text-xs text-muted-foreground">You&apos;ll see which schools haven&apos;t.</span>
            </Label>
          </div>
          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <p className="text-xs text-muted-foreground">PDF, PNG or JPEG; up to {MAX_FILES} files, 9 MB together. Only the people it&apos;s sent to can open them.</p>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                    <span className="truncate">{f.name}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {total > MAX_TOTAL && <p className="text-sm text-red-600">The files are too big together ({(total / 1024 / 1024).toFixed(1)} MB).</p>}
            <input
              ref={picker}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <Button type="button" variant="outline" size="sm" disabled={files.length >= MAX_FILES} onClick={() => picker.current?.click()}>
              <Paperclip className="mr-2 h-4 w-4" /> Attach files
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={post} disabled={saving || form.title.trim().length < 3 || form.body.trim().length < 3 || total > MAX_TOTAL}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Post to the schools
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

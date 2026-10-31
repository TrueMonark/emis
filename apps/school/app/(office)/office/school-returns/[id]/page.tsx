"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Printer, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Skeleton } from "@school/ui/components/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { ReturnDocument } from "@/components/returns/return-document";
import type { SchoolReturnView } from "@/components/returns/types";

type OfficeReturn = SchoolReturnView & { canReview: boolean; canReopen: boolean };
type Action = "APPROVE" | "RETURN" | "REOPEN";

const ACTION_TEXT: Record<Action, { title: string; description: string; button: string; needsComment: boolean }> = {
  APPROVE: {
    title: "Approve this return",
    description: "The figures then count in the district's, province's and national totals. You can add a note for the school.",
    button: "Approve",
    needsComment: false,
  },
  RETURN: {
    title: "Send back for correction",
    description: "The head teacher sees your comment, corrects the return and submits it again.",
    button: "Send back",
    needsComment: true,
  },
  REOPEN: {
    title: "Reopen the approved return",
    description: "It goes back to the school for correction and leaves the approved totals until it's approved again.",
    button: "Reopen",
    needsComment: true,
  },
};

/** One school's return for the office (Phase 7): the DEBS approves it or sends it back. */
export default function OfficeSchoolReturnPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<OfficeReturn | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: OfficeReturn }>(`/office/school-returns/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  const decide = async () => {
    if (!action) return;
    setSaving(true);
    try {
      const r =
        action === "REOPEN"
          ? await api.post<{ data: OfficeReturn }>(`/office/school-returns/${id}/reopen`, { comment })
          : await api.post<{ data: OfficeReturn }>(`/office/school-returns/${id}/review`, { decision: action, comment: comment || null });
      setData(r.data);
      toast.success(action === "APPROVE" ? "Return approved" : action === "RETURN" ? "Sent back to the school" : "Return reopened");
      setAction(null);
      setComment("");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <Skeleton className="h-96" />;
  const text = action ? ACTION_TEXT[action] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href={`/office/returns/${data.round.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline print:hidden">
            <ArrowLeft className="h-3 w-3" /> {data.round.title}
          </Link>
          <h1 className="text-xl font-bold">{data.school.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.round.title} · {data.school.emisNumber ? `EMIS ${data.school.emisNumber}` : "EMIS number pending"} · {data.school.district}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          {data.canReview && (
            <>
              <Button variant="outline" onClick={() => setAction("RETURN")}>
                <Undo2 className="mr-2 h-4 w-4" /> Send back
              </Button>
              <Button onClick={() => setAction("APPROVE")}>
                <Check className="mr-2 h-4 w-4" /> Approve
              </Button>
            </>
          )}
          {data.canReopen && (
            <Button variant="outline" onClick={() => setAction("REOPEN")}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reopen
            </Button>
          )}
        </div>
      </div>

      <ReturnDocument ret={data} audience="office" />

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          {text && (
            <>
              <DialogHeader>
                <DialogTitle>{text.title}</DialogTitle>
                <DialogDescription>{text.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-1">
                <Label htmlFor="decision-comment">{text.needsComment ? "What needs correcting" : "Note for the school (optional)"}</Label>
                <Textarea id="decision-comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
                <Button onClick={decide} disabled={saving || (text.needsComment && comment.trim().length < 3)}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {text.button}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRoundCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@school/ui/components/select";
import { Skeleton } from "@school/ui/components/skeleton";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";

interface CoverTeacher {
  id: string;
  firstName: string;
  lastName: string;
  staffNumber: string;
}

interface RegisterCover {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  teacher: CoverTeacher;
}

/** Today's date as YYYY-MM-DD in the user's own calendar. */
function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatCoverDay(iso: string): string {
  // Cover dates are stored as UTC midnight; show the calendar day, not a shifted local time.
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * "Hand over register": the class teacher (or head/deputy) lets another teacher take the
 * morning class register for a few days, e.g. while the class teacher is away. Shows the current
 * and upcoming covers, which can be cancelled when the class teacher is back.
 */
export function RegisterCoverDialog({
  open,
  onOpenChange,
  classId,
  className,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  onChanged?: () => void;
}) {
  const [teachers, setTeachers] = useState<CoverTeacher[]>([]);
  const [covers, setCovers] = useState<RegisterCover[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [teacherId, setTeacherId] = useState("");
  const [startDate, setStartDate] = useState(localToday());
  const [endDate, setEndDate] = useState(localToday());
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        api.get<{ data: CoverTeacher[] }>(`/attendance/register-covers/teachers?classId=${classId}`),
        api.get<{ data: RegisterCover[] }>(`/attendance/register-covers?classId=${classId}`),
      ]);
      setTeachers(t.data ?? []);
      setCovers(c.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load register covers"));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (!open) return;
    setTeacherId("");
    setStartDate(localToday());
    setEndDate(localToday());
    setReason("");
    load();
  }, [open, load]);

  const handleSave = async () => {
    if (!teacherId) {
      toast.error("Choose the teacher who will take the register");
      return;
    }
    if (endDate < startDate) {
      toast.error("The last day can't be before the first day");
      return;
    }
    setSaving(true);
    try {
      await api.post("/attendance/register-covers", {
        classId,
        teacherId,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      const t = teachers.find((x) => x.id === teacherId);
      toast.success(
        `${t ? `${t.firstName} ${t.lastName}` : "The teacher"} will take the ${className} register`
      );
      setTeacherId("");
      setReason("");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't hand over the register"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (cover: RegisterCover) => {
    setCancellingId(cover.id);
    try {
      await api.delete(`/attendance/register-covers/${cover.id}`);
      toast.success("Cover cancelled — the register is back with the class teacher");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't cancel the cover"));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hand over register · {className}</DialogTitle>
          <DialogDescription>
            Let another teacher take this class&apos;s morning register while the class teacher is
            away. They can only take the register — nothing else about the class changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Teacher taking the register</Label>
            {loading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} · {t.staffNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cover-start">First day</Label>
              <Input
                id="cover-start"
                type="date"
                value={startDate}
                min={localToday()}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cover-end">Last day</Label>
              <Input
                id="cover-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cover-reason">Reason (optional)</Label>
            <Input
              id="cover-reason"
              value={reason}
              maxLength={200}
              placeholder="e.g. Attending a workshop"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Current and upcoming covers</p>
            {loading ? (
              <Skeleton className="h-12 w-full" />
            ) : covers.length === 0 ? (
              <p className="text-sm text-muted-foreground">None — the class teacher takes the register.</p>
            ) : (
              <ul className="space-y-2">
                {covers.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.teacher.firstName} {c.teacher.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCoverDay(c.startDate)} – {formatCoverDay(c.endDate)}
                        {c.reason ? ` · ${c.reason}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cancellingId === c.id}
                      onClick={() => handleCancel(c)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      {cancellingId === c.id ? "Cancelling…" : "Cancel"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !teacherId}>
            <UserRoundCheck className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : "Hand over"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

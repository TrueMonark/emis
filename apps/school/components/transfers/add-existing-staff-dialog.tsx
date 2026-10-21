"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import { Button } from "@school/ui/components/button";
import { Label } from "@school/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { FindPerson, FoundPersonSummary, canAddPerson, type FoundPerson } from "./find-person";

/**
 * "Add existing staff": someone who already has an account (they taught elsewhere, or are coming
 * back). No second account is made. If they work at another school it's a transfer that their
 * school (or the DEBS) confirms; until then they keep working there.
 */
export function AddExistingStaffDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}) {
  const [person, setPerson] = useState<FoundPerson | null>(null);
  const [role, setRole] = useState("TEACHER");
  const [saving, setSaving] = useState(false);

  const close = (o: boolean) => {
    if (!o) {
      setPerson(null);
      setRole("TEACHER");
    }
    onOpenChange(o);
  };

  const add = async () => {
    if (!person) return;
    setSaving(true);
    try {
      const res = await api.post<{ data: { status: "PENDING" | "ACTIVE"; name: string; fromSchool?: string } }>("/transfers", {
        userId: person.userId,
        role,
      });
      toast.success(
        res.data.status === "ACTIVE"
          ? `${res.data.name} now works here`
          : `Transfer requested. ${res.data.fromSchool} (or the district office) must confirm it.`
      );
      onAdded?.();
      close(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't add them"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add existing staff</DialogTitle>
          <DialogDescription>
            For someone who already has an account, e.g. a teacher transferring from another school. Find them by
            the email or mobile number they sign in with. They keep their account, password and records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FindPerson path="/staff/lookup" onFound={setPerson} />
          {person && <FoundPersonSummary person={person} />}
          {canAddPerson(person) && (
            <div className="space-y-2">
              <Label>Their role here</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEACHER">Teacher</SelectItem>
                  <SelectItem value="CLERK">Clerk</SelectItem>
                  <SelectItem value="DEPUTY_HEAD">Deputy head</SelectItem>
                  <SelectItem value="HEAD_TEACHER">Head teacher</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Give them classes and subjects once they&apos;ve joined (Edit on the Teachers page).
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={add} disabled={saving || !canAddPerson(person)}>
            {saving ? "Sending…" : person?.currentSchool ? "Ask for transfer" : "Add to staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

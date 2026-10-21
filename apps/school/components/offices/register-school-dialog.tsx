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
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@school/ui/components/select";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import type { IssuedPassword } from "@/components/accounts/one-time-password-dialog";
import { CATEGORY_LABEL } from "./office-labels";
import { FindPerson, FoundPersonSummary, canAddPerson, type FoundPerson } from "@/components/transfers/find-person";

const empty = {
  name: "",
  emisNumber: "",
  category: "PUBLIC",
  agency: "",
  head: {
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    gender: "FEMALE",
    dateOfBirth: "",
    staffNumber: "",
    qualification: "DEGREE",
  },
};

/**
 * DEBS: register a school in the district together with its first head teacher. The head is
 * either a new person (they get an account; the one-time password is shown once afterwards via
 * onCreated) or an existing one, e.g. a deputy promoted to head (Phase 4b): their account stays
 * theirs, and if they work at another school now it's a transfer to confirm. Either way they set
 * up the school when they first sign in as its head.
 */
export function RegisterSchoolDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (issued: IssuedPassword | null) => void;
}) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [headKind, setHeadKind] = useState<"new" | "existing">("new");
  const [existing, setExisting] = useState<FoundPerson | null>(null);

  const setHead = (patch: Partial<typeof empty.head>) => setForm((f) => ({ ...f, head: { ...f.head, ...patch } }));

  const submit = async () => {
    setSaving(true);
    try {
      const res = await api.post<{
        data: {
          school: { id: string; name: string };
          head: { email: string; name: string };
          headStatus?: "PENDING" | "ACTIVE";
          temporaryPassword: string | null;
          temporaryPasswordExpiresAt: string | null;
        };
      }>("/office/schools", {
        name: form.name,
        emisNumber: form.emisNumber || null,
        category: form.category,
        agency: form.agency || null,
        head:
          headKind === "existing" && existing
            ? { existingUserId: existing.userId }
            : { ...form.head, staffNumber: form.head.staffNumber.toUpperCase() },
      });
      onOpenChange(false);
      setForm(empty);
      setExisting(null);
      setHeadKind("new");
      if (!res.data.temporaryPassword) {
        toast.success(
          res.data.headStatus === "PENDING"
            ? `${res.data.school.name} registered. ${res.data.head.name}'s transfer is waiting for confirmation (Transfers page).`
            : `${res.data.school.name} registered. ${res.data.head.name} signs in with their own password.`
        );
        onCreated(null);
        return;
      }
      toast.success(`${res.data.school.name} registered`);
      onCreated({
        name: `${res.data.head.name} (head teacher, ${res.data.school.name})`,
        email: res.data.head.email,
        temporaryPassword: res.data.temporaryPassword,
        temporaryPasswordExpiresAt: res.data.temporaryPasswordExpiresAt ?? "",
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't register the school"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Register a school</DialogTitle>
          <DialogDescription>
            The school is added to your district with its first head teacher. The head gets a
            one-time password, chooses their own at first sign-in, and then sets up the school.
          </DialogDescription>
        </DialogHeader>
        {/* A plain scrolling box (the Radix ScrollArea doesn't scroll inside a max-height dialog) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2">
          <div className="space-y-4">
            <p className="text-sm font-semibold">School</p>
            <div className="space-y-1.5">
              <Label htmlFor="rs-name">School name</Label>
              <Input id="rs-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rs-emis">EMIS number (if known)</Label>
                <Input id="rs-emis" value={form.emisNumber} onChange={(e) => setForm({ ...form, emisNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.category === "AIDED" && (
              <div className="space-y-1.5">
                <Label htmlFor="rs-agency">Agency (e.g. the church running it)</Label>
                <Input id="rs-agency" value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
              </div>
            )}

            <p className="text-sm font-semibold pt-2">Head teacher</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={headKind === "new" ? "default" : "outline"} onClick={() => setHeadKind("new")}>
                A new person
              </Button>
              <Button type="button" size="sm" variant={headKind === "existing" ? "default" : "outline"} onClick={() => setHeadKind("existing")}>
                Someone with an account
              </Button>
            </div>
            {headKind === "existing" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  E.g. a deputy head promoted to head of this school. Find them by the email or mobile number they sign in
                  with; they keep their account and password.
                </p>
                <FindPerson path="/office/people" onFound={setExisting} />
                {existing && <FoundPersonSummary person={existing} />}
              </div>
            ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rs-fn">First name</Label>
                <Input id="rs-fn" value={form.head.firstName} onChange={(e) => setHead({ firstName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-ln">Last name</Label>
                <Input id="rs-ln" value={form.head.lastName} onChange={(e) => setHead({ lastName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-email">Email (their sign-in)</Label>
                <Input id="rs-email" type="email" value={form.head.email} onChange={(e) => setHead({ email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-phone">Mobile number</Label>
                <Input id="rs-phone" placeholder="0977123456" value={form.head.phone} onChange={(e) => setHead({ phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.head.gender} onValueChange={(v) => setHead({ gender: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="MALE">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-dob">Date of birth</Label>
                <Input id="rs-dob" type="date" value={form.head.dateOfBirth} onChange={(e) => setHead({ dateOfBirth: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rs-staff">Staff number</Label>
                <Input id="rs-staff" value={form.head.staffNumber} onChange={(e) => setHead({ staffNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Qualification</Label>
                <Select value={form.head.qualification} onValueChange={(v) => setHead({ qualification: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["CERTIFICATE", "DIPLOMA", "DEGREE", "MASTERS", "DOCTORATE"].map((q) => (
                      <SelectItem key={q} value={q}>{q.charAt(0) + q.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving || !form.name || (headKind === "new" ? !form.head.email : !canAddPerson(existing))}
          >
            {saving ? "Registering…" : "Register school"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
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
import { Switch } from "@school/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@school/ui/components/select";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { CATEGORY_LABEL } from "./office-labels";

export interface OfficeSchoolRow {
  id: string;
  name: string;
  emisNumber: string | null;
  emisStatus: "CONFIRMED" | "PENDING" | "DISPUTED";
  category: string;
  agency: string | null;
  status: "ACTIVE" | "INACTIVE";
  /** School fees pages (always on for private schools) */
  feesEnabled: boolean;
  setupCompletedAt: string | null;
  districtOffice: { id: string; name: string; parentId: string | null };
  memberships: { role: string; user: { email: string; displayName: string | null } }[];
  _count: { memberships: number };
}

const NONE = "__none__";

/** Correct a school's name, EMIS number and status, category, or close it (DEBS and above). */
export function EditSchoolDialog({
  school,
  onOpenChange,
  onSaved,
}: {
  school: OfficeSchoolRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    emisNumber: "",
    emisStatus: "PENDING",
    category: "PUBLIC",
    agency: "",
    status: "ACTIVE",
    feesEnabled: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!school) return;
    setForm({
      name: school.name,
      emisNumber: school.emisNumber ?? "",
      emisStatus: school.emisStatus,
      category: school.category,
      agency: school.agency ?? "",
      status: school.status,
      feesEnabled: school.feesEnabled,
    });
  }, [school]);

  const save = async () => {
    if (!school) return;
    setSaving(true);
    try {
      await api.patch(`/office/schools/${school.id}`, {
        name: form.name,
        emisNumber: form.emisNumber || null,
        emisStatus: form.emisStatus,
        category: form.category,
        agency: form.agency || null,
        status: form.status,
        feesEnabled: form.category === "PRIVATE" ? true : form.feesEnabled,
      });
      toast.success("School updated");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update the school"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!school} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {school?.name}</DialogTitle>
          <DialogDescription>
            Every change is recorded in the audit log, including the old and new EMIS number.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="es-name">School name</Label>
            <Input id="es-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="es-emis">EMIS number</Label>
              <Input id="es-emis" value={form.emisNumber} onChange={(e) => setForm({ ...form, emisNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>EMIS number status</Label>
              <Select value={form.emisStatus} onValueChange={(v) => setForm({ ...form, emisStatus: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending (not yet checked)</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Open</SelectItem>
                  <SelectItem value="INACTIVE">Closed (nobody can sign in)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-agency">Agency (grant-aided schools)</Label>
            <Input id="es-agency" value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Switch
              id="es-fees"
              checked={form.category === "PRIVATE" || form.feesEnabled}
              disabled={form.category === "PRIVATE"}
              onCheckedChange={(v) => setForm({ ...form, feesEnabled: v })}
            />
            <div className="space-y-0.5">
              <Label htmlFor="es-fees">School fees</Label>
              <p className="text-xs text-muted-foreground">
                {form.category === "PRIVATE"
                  ? "Always on for private schools: the head teacher can add finance staff who record fees and payments."
                  : "Switch on if this school charges fees: the head teacher can then add finance staff who record fees and payments."}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Move a school to another district (HQ, or a PEO within its province). */
export function MoveSchoolDialog({
  school,
  districts,
  onOpenChange,
  onSaved,
}: {
  school: OfficeSchoolRow | null;
  districts: { id: string; name: string; parentName: string | null }[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [districtId, setDistrictId] = useState(NONE);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDistrictId(NONE), [school]);

  const save = async () => {
    if (!school || districtId === NONE) return;
    setSaving(true);
    try {
      await api.put(`/office/schools/${school.id}/district`, { districtOfficeId: districtId });
      toast.success("School moved");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't move the school"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!school} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {school?.name}</DialogTitle>
          <DialogDescription>
            Now in: {school?.districtOffice.name}. Its district office will see and look after it.
          </DialogDescription>
        </DialogHeader>
        <Select value={districtId} onValueChange={setDistrictId}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Choose a district" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} disabled>Choose a district</SelectItem>
            {districts
              .filter((d) => d.id !== school?.districtOffice.id)
              .map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}{d.parentName ? ` · ${d.parentName}` : ""}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || districtId === NONE}>{saving ? "Moving…" : "Move"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

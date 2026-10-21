"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, UserPlus, UserX } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Skeleton } from "@school/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@school/ui/components/select";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { useCurrentOffice, type CurrentOffice } from "@/components/offices/office-context";
import { OFFICE_SHORT, roleLabel, type OfficeRole, type OfficeType } from "@/components/offices/office-labels";
import {
  OneTimePasswordDialog,
  type IssuedPassword,
} from "@/components/accounts/one-time-password-dialog";

interface Account {
  id: string;
  role: OfficeRole;
  title: string | null;
  user: { id: string; email: string; displayName: string | null; hasDefaultPassword: boolean; lastLogin: string | null };
}

interface OfficeRow {
  id: string;
  type: OfficeType;
  name: string;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  parent: { id: string; name: string } | null;
  _count: { schools: number; children: number };
  memberships: Account[];
}

/** Mirrors the server's rule (OfficeService.canManageAccountsAt) to show the right buttons. */
function canManage(me: CurrentOffice, target: OfficeRow, role: OfficeRole): boolean {
  if (me.role !== "OFFICE_HEAD") return false;
  if (me.officeType === "HQ") return true;
  if (target.id === me.officeId) return role === "OFFICER";
  return me.officeType === "PROVINCIAL" && target.type === "DISTRICT" && target.parentId === me.officeId;
}

const PLACEHOLDERS = new Set(["office-district-unassigned", "office-prov-unassigned"]);

export default function OfficesPage() {
  const me = useCurrentOffice();
  const [offices, setOffices] = useState<OfficeRow[] | null>(null);
  const [accountFor, setAccountFor] = useState<OfficeRow | null>(null);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ data: OfficeRow[] }>("/office/offices");
    setOffices(res.data ?? []);
  }, []);

  useEffect(() => {
    load().catch(() => setOffices([]));
  }, [load]);

  const provinces = useMemo(() => (offices ?? []).filter((o) => o.type === "PROVINCIAL" && !PLACEHOLDERS.has(o.id)), [offices]);

  const endAccount = async (a: Account) => {
    if (!window.confirm(`End ${a.user.displayName || a.user.email}'s office role? Their account stays; they just lose access to the office pages.`)) return;
    try {
      await api.delete(`/office/accounts/${a.id}`);
      toast.success("Office role ended");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't end the role"));
    }
  };

  // Own office first, then the rest by level and name (the server already sorts).
  const ordered = (offices ?? []).slice().sort((a, b) => (a.id === me.officeId ? -1 : b.id === me.officeId ? 1 : 0));
  const canAddDistrict = me.role === "OFFICE_HEAD" && me.officeType !== "DISTRICT";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Offices & accounts</h1>
          <p className="text-sm text-muted-foreground">
            HQ creates PEO accounts, a PEO creates DEBS accounts, and each head adds officers to their own office.
          </p>
        </div>
        {canAddDistrict && (
          <Button onClick={() => setDistrictOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add district office
          </Button>
        )}
      </div>

      {!offices ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="space-y-3">
          {ordered.map((o) => {
            const canAddHead = canManage(me, o, "OFFICE_HEAD");
            const canAddOfficer = canManage(me, o, "OFFICER");
            return (
              <Card key={o.id} className={o.isActive ? "" : "opacity-60"}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {o.name}
                        {o.id === me.officeId && <Badge variant="secondary" className="ml-2">your office</Badge>}
                        {!o.isActive && <Badge variant="outline" className="ml-2">closed</Badge>}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {OFFICE_SHORT[o.type]}
                        {o.code ? ` · ${o.code}` : ""}
                        {o.parent ? ` · under ${o.parent.name}` : ""}
                        {o.type === "DISTRICT" ? ` · ${o._count.schools} school${o._count.schools === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                    {(canAddHead || canAddOfficer) && !PLACEHOLDERS.has(o.id) && o.isActive && (
                      <Button variant="outline" size="sm" onClick={() => setAccountFor(o)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add account
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {o.memberships.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No accounts yet.</p>
                  ) : (
                    <ul className="divide-y">
                      {o.memberships.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{a.user.displayName || a.user.email}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {a.title || roleLabel(a.role, o.type)} · {a.user.email}
                              {a.user.hasDefaultPassword ? " · hasn't signed in yet" : ""}
                            </p>
                          </div>
                          {canManage(me, o, a.role) && a.user.id && (
                            <Button variant="ghost" size="sm" title="End office role" onClick={() => endAccount(a)}>
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddAccountDialog
        office={accountFor}
        me={me}
        onOpenChange={(open) => !open && setAccountFor(null)}
        onCreated={(i) => {
          if (i) setIssued(i);
          load();
        }}
      />
      <AddDistrictDialog
        open={districtOpen}
        onOpenChange={setDistrictOpen}
        provinces={me.officeType === "HQ" ? provinces : []}
        onCreated={load}
      />
      <OneTimePasswordDialog issued={issued} reason="created" onClose={() => setIssued(null)} />
    </div>
  );
}

function AddAccountDialog({
  office,
  me,
  onOpenChange,
  onCreated,
}: {
  office: OfficeRow | null;
  me: CurrentOffice;
  onOpenChange: (open: boolean) => void;
  onCreated: (issued: IssuedPassword | null) => void;
}) {
  const [form, setForm] = useState({ displayName: "", email: "", phone: "", title: "", role: "OFFICER" as OfficeRole });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!office) return;
    setForm({
      displayName: "",
      email: "",
      phone: "",
      title: "",
      role: canManage(me, office, "OFFICE_HEAD") ? "OFFICE_HEAD" : "OFFICER",
    });
  }, [office, me]);

  const submit = async () => {
    if (!office) return;
    setSaving(true);
    try {
      const res = await api.post<{
        data: { email: string; existingAccount: boolean; temporaryPassword: string | null; temporaryPasswordExpiresAt?: string };
      }>("/office/accounts", {
        officeId: office.id,
        email: form.email,
        phone: form.phone.trim() || null,
        displayName: form.displayName,
        role: form.role,
        title: form.title || null,
      });
      onOpenChange(false);
      if (res.data.existingAccount || !res.data.temporaryPassword) {
        toast.success(`${form.email} already had an account; they can now use the office pages with their own password`);
        onCreated(null);
      } else {
        onCreated({
          name: `${form.displayName} (${office.name})`,
          email: res.data.email,
          temporaryPassword: res.data.temporaryPassword,
          temporaryPasswordExpiresAt: res.data.temporaryPasswordExpiresAt ?? "",
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create the account"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!office} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an account · {office?.name}</DialogTitle>
          <DialogDescription>
            They get a one-time password (shown once, next) and choose their own at first sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aa-name">Full name</Label>
            <Input id="aa-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aa-email">Email (their sign-in)</Label>
            <Input id="aa-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aa-phone">Mobile number (optional, to sign in with)</Label>
            <Input id="aa-phone" type="tel" placeholder="0977 123 456" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\s/g, "") })} />
          </div>
          {office && (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as OfficeRole })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {canManage(me, office, "OFFICE_HEAD") && (
                    <SelectItem value="OFFICE_HEAD">{roleLabel("OFFICE_HEAD", office.type)} (head)</SelectItem>
                  )}
                  <SelectItem value="OFFICER">Officer (can see, can't change)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="aa-title">Job title (optional)</Label>
            <Input id="aa-title" placeholder="e.g. Planning Officer" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.email || !form.displayName}>
            {saving ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDistrictDialog({
  open,
  onOpenChange,
  provinces,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only for HQ, which chooses the province; a PEO always adds to its own. */
  provinces: OfficeRow[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setParentId("");
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post("/office/offices", { name, code: code || null, parentId: parentId || null });
      toast.success(`${name} added`);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't add the district office"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a district office</DialogTitle>
          <DialogDescription>
            Until the official list of education districts is loaded, offices add their own.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {provinces.length > 0 && (
            <div className="space-y-1.5">
              <Label>Province</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose the province" /></SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ad-name">Name</Label>
            <Input id="ad-name" placeholder="e.g. Chongwe District Education Board" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-code">Code (optional)</Label>
            <Input id="ad-code" placeholder="e.g. DEBS-CHONGWE" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || name.trim().length < 2 || (provinces.length > 0 && !parentId)}>
            {saving ? "Adding…" : "Add office"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

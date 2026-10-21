"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, Plus } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { useFinancePerson } from "@/components/finance/finance-context";
import { FinancePageHeader } from "@/components/finance/page-header";
import { dateTimeLabel, dayLabel } from "@/components/finance/format";

interface Staff {
  membershipId: string;
  name: string | null;
  email: string;
  phone: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  lastLogin: string | null;
  waitingForFirstSignIn: boolean;
}

interface Created {
  email: string;
  name: string;
  signInPhone: string | null;
  temporaryPassword: string;
  temporaryPasswordExpiresAt: string;
}

/**
 * Finance staff accounts (bursar, accounts clerk). Made by the head teacher or deputy. They only
 * see the school fees pages — nothing about teaching, marks or attendance.
 */
export default function FinanceStaffPage() {
  const person = useFinancePerson();
  const router = useRouter();
  const [rows, setRows] = useState<Staff[] | null>(null);
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    if (!person.isLeader) router.replace("/finance");
  }, [person.isLeader, router]);

  const load = useCallback(() => {
    api
      .get<{ data: Staff[] }>("/finance/staff")
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    setSaving(true);
    try {
      const { data } = await api.post<{ data: Created }>("/finance/staff", { displayName: displayName.trim(), email: email.trim(), phone: phone.trim() || null });
      setCreated(data);
      setDisplayName("");
      setEmail("");
      setPhone("");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const end = async (s: Staff) => {
    if (!confirm(`End ${s.name || s.email}'s finance account? They won't be able to sign in here any more.`)) return;
    try {
      await api.delete(`/finance/staff/${s.membershipId}`);
      toast.success("Account ended");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <>
      <FinancePageHeader
        title="Finance staff"
        description="People who record payments and set up fees. They see only the school fees pages."
        actions={
          <Button
            onClick={() => {
              setCreated(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New finance account
          </Button>
        }
      />
      {!rows ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No finance staff yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sign-in</TableHead>
                <TableHead>Since</TableHead>
                <TableHead>Last signed in</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.membershipId} className={s.status !== "ACTIVE" ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{s.name || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {s.email}
                    {s.phone && <span className="block text-xs text-muted-foreground">{s.phone}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{dayLabel(s.startDate)}</TableCell>
                  <TableCell className="text-sm">
                    {s.waitingForFirstSignIn ? <Badge variant="outline">waiting for first sign-in</Badge> : dateTimeLabel(s.lastLogin)}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.status === "ACTIVE" ? (
                      <Button size="sm" variant="outline" onClick={() => end(s)}>
                        End account
                      </Button>
                    ) : (
                      <Badge variant="outline">ended {dayLabel(s.endDate)}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Forgotten passwords: finance staff use “Forgot password?” on the sign-in page and you reset it from the Teachers page requests.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{created ? "Account created" : "New finance account"}</DialogTitle>
            <DialogDescription>
              {created
                ? "Give them this one-time password in person. It is shown only once; they choose their own when they first sign in."
                : "A one-time password is made for them."}
            </DialogDescription>
          </DialogHeader>
          {created ? (
            <div className="space-y-2 rounded-md border p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span> {created.name}
              </p>
              <p>
                <span className="text-muted-foreground">Sign in with:</span> {created.email}
                {created.signInPhone ? ` or ${created.signInPhone}` : ""}
              </p>
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">One-time password:</span>
                <span className="font-mono font-semibold">{created.temporaryPassword}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy"
                  onClick={() => navigator.clipboard?.writeText(created.temporaryPassword).then(() => toast.success("Copied"))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </p>
              <p className="text-xs text-muted-foreground">Stops working {dateTimeLabel(created.temporaryPasswordExpiresAt)} if not used.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fs-name">Full name</Label>
                <Input id="fs-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fs-email">Email</Label>
                <Input id="fs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fs-phone">Mobile number (optional, for signing in)</Label>
                <Input id="fs-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="097…" />
              </div>
            </div>
          )}
          <DialogFooter>
            {created ? (
              <Button onClick={() => setOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={create} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

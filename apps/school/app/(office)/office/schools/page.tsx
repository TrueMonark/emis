"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MoveRight, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Input } from "@school/ui/components/input";
import { Card, CardContent } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { useCurrentOffice } from "@/components/offices/office-context";
import { RegisterSchoolDialog } from "@/components/offices/register-school-dialog";
import { EditSchoolDialog, MoveSchoolDialog, type OfficeSchoolRow } from "@/components/offices/edit-school-dialog";
import { CATEGORY_LABEL } from "@/components/offices/office-labels";
import {
  OneTimePasswordDialog,
  type IssuedPassword,
} from "@/components/accounts/one-time-password-dialog";

interface OfficeRow {
  id: string;
  type: "HQ" | "PROVINCIAL" | "DISTRICT";
  name: string;
  isActive: boolean;
  parent: { id: string; name: string } | null;
}

const EMIS_BADGE: Record<OfficeSchoolRow["emisStatus"], string> = {
  CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  PENDING: "bg-muted text-muted-foreground",
  DISPUTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

/** Schools in the office's area. DEBS registers schools; HQ/PEO move them between districts. */
export default function OfficeSchoolsPage() {
  const office = useCurrentOffice();
  const isHead = office.role === "OFFICE_HEAD";
  const [schools, setSchools] = useState<OfficeSchoolRow[] | null>(null);
  const [districts, setDistricts] = useState<{ id: string; name: string; parentName: string | null }[]>([]);
  const [q, setQ] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [editing, setEditing] = useState<OfficeSchoolRow | null>(null);
  const [moving, setMoving] = useState<OfficeSchoolRow | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ data: OfficeSchoolRow[] }>(`/office/schools${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setSchools(res.data ?? []);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => { load().catch(() => setSchools([])); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (office.officeType === "DISTRICT") return;
    api
      .get<{ data: OfficeRow[] }>("/office/offices")
      .then((r) =>
        setDistricts(
          (r.data ?? [])
            .filter((o) => o.type === "DISTRICT" && o.isActive)
            .map((o) => ({ id: o.id, name: o.name, parentName: o.parent?.name ?? null }))
        )
      )
      .catch(() => setDistricts([]));
  }, [office.officeType]);

  const canRegister = isHead && office.officeType === "DISTRICT";
  const canMove = isHead && office.officeType !== "DISTRICT";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Schools</h1>
          <p className="text-sm text-muted-foreground">
            {office.officeType === "HQ"
              ? "Every school in the country."
              : office.officeType === "PROVINCIAL"
                ? "Schools in your province's districts."
                : "Schools in your district."}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 w-56" placeholder="Name or EMIS number" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {canRegister && (
            <Button onClick={() => setRegisterOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Register school
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {!schools ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : schools.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No schools yet{canRegister ? " — register the first one." : "."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>EMIS</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Head / deputy</TableHead>
                  <TableHead className="text-right">Staff</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/office/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[s.category] ?? s.category}
                        {s.status === "INACTIVE" && " · closed"}
                        {!s.setupCompletedAt && " · setting up"}
                        {s.feesEnabled && " · school fees on"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{s.emisNumber ?? "—"}</span>
                      <Badge variant="secondary" className={`ml-2 ${EMIS_BADGE[s.emisStatus]}`}>
                        {s.emisStatus.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{s.districtOffice.name}</TableCell>
                    <TableCell className="text-sm">
                      {s.memberships.length === 0
                        ? <span className="text-muted-foreground">—</span>
                        : s.memberships.map((m) => m.user.displayName || m.user.email).join(", ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s._count.memberships}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {isHead && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(s)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canMove && (
                        <Button variant="ghost" size="sm" onClick={() => setMoving(s)} title="Move to another district">
                          <MoveRight className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RegisterSchoolDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onCreated={(i) => {
          setIssued(i);
          load();
        }}
      />
      <OneTimePasswordDialog issued={issued} reason="created" onClose={() => setIssued(null)} />
      <EditSchoolDialog school={editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={load} />
      <MoveSchoolDialog school={moving} districts={districts} onOpenChange={(o) => !o && setMoving(null)} onSaved={load} />
    </div>
  );
}

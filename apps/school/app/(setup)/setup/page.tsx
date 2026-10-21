"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, LogOut } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@school/ui/components/card";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Badge } from "@school/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@school/ui/components/select";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { api, authFetch, getAuthToken } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { MonarkDevsCredit } from "@/components/layout/monark-devs-credit";
import { CreateAcademicYearDialog } from "@/components/settings/create-academic-year-dialog";
import { CreateTermDialog } from "@/components/settings/create-term-dialog";
import { YearLevelsManager } from "@/components/year-levels/year-levels-manager";
import { CatalogueSubjectsDialog } from "@/components/subjects/catalogue-subjects-dialog";
import { getRoleRoute } from "@/lib/auth/role-routes";
import { Role } from "@school/shared/types/prisma-enums";

interface SetupStatus {
  school: { id: string; name: string; emisNumber: string | null; districtOffice: { name: string } };
  setupComplete: boolean;
  activeAcademicYear: { id: string; year: number } | null;
  steps: { key: string; done: boolean; required: boolean }[];
  canFinish: boolean;
}

interface Year {
  id: string;
  year: number;
  isActive: boolean;
}

interface Term {
  id: string;
  termType: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const STEP_TITLES: Record<string, string> = {
  details: "School details",
  academicYear: "Academic year",
  terms: "Terms",
  yearLevels: "Year levels",
  subjects: "Subjects (recommended)",
};

/**
 * First-time setup for a school its district office has just registered. The server keeps the
 * school's other pages closed until the head (or deputy) finishes the required steps here.
 */
export default function SchoolSetupPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ role: Role } | null>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [years, setYears] = useState<Year[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [details, setDetails] = useState({ name: "", motto: "", address: "", phone: "", email: "", schoolType: "Secondary" });
  const [savingDetails, setSavingDetails] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    const s = await api.get<{ data: SetupStatus }>("/school/setup");
    setStatus(s.data);
    const y = await api.get<{ data: Year[] }>("/academic-years");
    setYears(y.data ?? []);
    const active = (y.data ?? []).find((x) => x.isActive);
    if (active) {
      const t = await api.get<{ data: Term[] }>(`/terms?academicYearId=${active.id}`);
      setTerms(t.data ?? []);
    } else {
      setTerms([]);
    }
  }, []);

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace("/login");
      return;
    }
    api
      .get<{ data: { role: Role; school: { setupComplete: boolean } | null } }>("/auth/me")
      .then(({ data }) => {
        setMe(data);
        if (data.school?.setupComplete) router.replace(getRoleRoute(data.role));
      })
      .catch(() => router.replace("/login"));
    load().catch(() => undefined);
    authFetch("/api/admin/settings/school-info")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings ?? {};
        setDetails((prev) => ({
          name: s.name || prev.name,
          motto: s.motto ?? "",
          address: s.address ?? "",
          phone: s.phone ?? "",
          email: s.email ?? "",
          schoolType: s.schoolType || "Secondary",
        }));
      })
      .catch(() => undefined);
  }, [router, load]);

  useEffect(() => {
    if (status && !details.name) setDetails((d) => ({ ...d, name: status.school.name }));
  }, [status, details.name]);

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      const res = await authFetch("/api/admin/settings/school-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't save");
      toast.success("School details saved");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save the school details"));
    } finally {
      setSavingDetails(false);
    }
  };

  const activateYear = async (id: string) => {
    const res = await authFetch(`/api/academic-years/${id}/activate`, { method: "POST" });
    if (!res.ok) toast.error("Couldn't make that year active");
    load();
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await api.post("/school/setup/complete");
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const u = JSON.parse(stored);
          localStorage.setItem("user", JSON.stringify({ ...u, school: { ...(u.school ?? {}), setupComplete: true } }));
        }
      } catch {
        // stored user is only a convenience
      }
      toast.success("Setup finished — welcome!");
      router.replace(getRoleRoute(me?.role ?? "HEAD_TEACHER"));
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't finish setup"));
    } finally {
      setFinishing(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const done = (key: string) => status?.steps.find((s) => s.key === key)?.done ?? false;
  const leader = me ? isSchoolLeader(me.role) : false;
  const activeYear = years.find((y) => y.isActive) ?? null;

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Set up {status?.school.name ?? "your school"}</h1>
              <p className="text-sm text-muted-foreground">
                {status?.school.districtOffice.name}
                {status?.school.emisNumber ? ` · EMIS ${status.school.emisNumber}` : ""}. A few steps before
                the school can start: the rest of the system opens once they're done.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>

          {me && !leader && (
            <Card>
              <CardContent className="p-6 text-sm">
                Your school is still being set up by the head teacher. Come back once they&apos;ve finished.
              </CardContent>
            </Card>
          )}

          {status && leader && (
            <>
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {status.steps.map((s) => (
                  <li key={s.key} className="flex items-center gap-1.5 text-xs">
                    {s.done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    {STEP_TITLES[s.key]}
                  </li>
                ))}
              </ol>

              {/* 1. Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">1. School details</CardTitle>
                  <CardDescription>Shown on report cards and in the sidebar. The EMIS number is kept by your district office.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="sd-name">School name</Label>
                      <Input id="sd-name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Type of school</Label>
                      <Select value={details.schoolType} onValueChange={(v) => setDetails({ ...details, schoolType: v })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Primary">Primary</SelectItem>
                          <SelectItem value="Secondary">Secondary</SelectItem>
                          <SelectItem value="Combined (Primary & Secondary)">Combined (primary and secondary)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sd-motto">Motto</Label>
                      <Input id="sd-motto" value={details.motto} onChange={(e) => setDetails({ ...details, motto: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="sd-address">Postal / physical address</Label>
                      <Input id="sd-address" value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sd-phone">Phone</Label>
                      <Input id="sd-phone" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sd-email">Email</Label>
                      <Input id="sd-email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveDetails} disabled={savingDetails || !details.name.trim()}>
                      {savingDetails ? "Saving…" : "Save details"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 2–3. Year and terms */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">2. Academic year and terms</CardTitle>
                  <CardDescription>The year that's running now must be active, with its terms.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {years.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No academic year yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {years.map((y) => (
                        <li key={y.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <span>{y.year}{y.isActive && <Badge variant="secondary" className="ml-2">active</Badge>}</span>
                          {!y.isActive && <Button size="sm" variant="outline" onClick={() => activateYear(y.id)}>Make active</Button>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setYearOpen(true)}>Add academic year</Button>

                  {activeYear && (
                    <div className="pt-2 space-y-2">
                      <p className="text-sm font-medium">Terms of {activeYear.year}</p>
                      {terms.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No terms yet.</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {terms.map((t) => (
                            <li key={t.id}>
                              {t.termType.replace("TERM_", "Term ")}:{" "}
                              {new Date(t.startDate).toLocaleDateString("en-GB")} – {new Date(t.endDate).toLocaleDateString("en-GB")}
                              {t.isActive && <Badge variant="secondary" className="ml-2">current</Badge>}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setTermOpen(true)}>Add term</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 4. Year levels */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3. Year levels</CardTitle>
                  <CardDescription>Start from a template (e.g. &quot;Secondary Forms 1–6&quot; or &quot;Changeover 2026&quot;).</CardDescription>
                </CardHeader>
                <CardContent>
                  <YearLevelsManager canEdit onChanged={load} />
                </CardContent>
              </Card>

              {/* 5. Subjects */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">4. Subjects (recommended)</CardTitle>
                  <CardDescription>
                    Pick the subjects you offer from the national list. You can add more later under Subjects.
                    {done("subjects") ? " Done." : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" onClick={() => setCatalogueOpen(true)}>Choose from the national list</Button>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {status.canFinish ? "Everything required is done." : "Finish the required steps above to continue."}
                </p>
                <Button onClick={finish} disabled={!status.canFinish || finishing}>
                  {finishing ? "Finishing…" : "Finish setup"}
                </Button>
              </div>
            </>
          )}
          <MonarkDevsCredit />
        </div>

        <CreateAcademicYearDialog open={yearOpen} onOpenChange={setYearOpen} onSuccess={load} />
        <CreateTermDialog
          open={termOpen}
          onOpenChange={setTermOpen}
          academicYearId={activeYear?.id ?? ""}
          onSuccess={load}
        />
        <CatalogueSubjectsDialog open={catalogueOpen} onOpenChange={setCatalogueOpen} onAdded={load} />
      </div>
    </ThemeProvider>
  );
}

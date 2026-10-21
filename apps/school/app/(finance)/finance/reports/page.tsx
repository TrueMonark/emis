"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Switch } from "@school/ui/components/switch";
import { Card, CardContent } from "@school/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@school/ui/components/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { useFinanceOptions } from "@/hooks/useFinanceOptions";
import { FinancePageHeader } from "@/components/finance/page-header";
import { MoneyInput } from "@/components/finance/money-input";
import { todayISO } from "@/components/finance/format";
import {
  ClassListTable,
  CollectionsTables,
  DebtorsTable,
  classListCsv,
  collectionsCsv,
  debtorsCsv,
  type ClassListReport,
  type CollectionsReport,
  type DebtorsReport,
} from "@/components/finance/report-tables";

const ALL = "__all";

function useReport<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async (path: string) => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: T }>(path);
      setData(data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return { data, loading, run };
}

function Actions({ loading, onShow, printUrl, onCsv }: { loading: boolean; onShow: () => void; printUrl: string | null; onCsv?: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onShow} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Show
      </Button>
      <Button variant="outline" disabled={!printUrl} onClick={() => printUrl && window.open(printUrl, "_blank")}>
        <Printer className="mr-2 h-4 w-4" /> Print
      </Button>
      <Button variant="outline" disabled={!onCsv} onClick={onCsv}>
        <Download className="mr-2 h-4 w-4" /> CSV
      </Button>
    </div>
  );
}

/** Printable money reports: class lists with payments, who owes, money collected. */
export default function ReportsPage() {
  const options = useFinanceOptions();
  const yearTerms = options?.terms.filter((t) => t.academicYearId === options.activeYear?.id) ?? [];

  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState(ALL);
  const classList = useReport<ClassListReport>();
  const classQuery = () => {
    const qs = new URLSearchParams({ classId });
    if (termId !== ALL) qs.set("termId", termId);
    return qs.toString();
  };

  const [dClass, setDClass] = useState(ALL);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [min, setMin] = useState<number | null>(null);
  const debtors = useReport<DebtorsReport>();
  const debtorsQuery = () => {
    const qs = new URLSearchParams();
    if (dClass !== ALL) qs.set("classId", dClass);
    if (overdueOnly) qs.set("overdue", "1");
    if (min) qs.set("min", String(min));
    return qs.toString();
  };

  const [from, setFrom] = useState(`${todayISO().slice(0, 8)}01`);
  const [to, setTo] = useState(todayISO());
  const collections = useReport<CollectionsReport>();
  const collectionsQuery = () => new URLSearchParams({ from, to }).toString();

  return (
    <>
      <FinancePageHeader title="Reports" description="Show a report here, print it, or download it as a spreadsheet (CSV)." />
      <Tabs defaultValue="class-list">
        <TabsList>
          <TabsTrigger value="class-list">Class list with payments</TabsTrigger>
          <TabsTrigger value="debtors">Who owes</TabsTrigger>
          <TabsTrigger value="collections">Money collected</TabsTrigger>
        </TabsList>

        <TabsContent value="class-list" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1">
                <Label className="text-xs">Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fees of</Label>
                <Select value={termId} onValueChange={setTermId}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>The whole year</SelectItem>
                    {yearTerms.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} (and one-off fees)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Actions
                loading={classList.loading}
                onShow={() => (classId ? classList.run(`/finance/reports/class-list?${classQuery()}`) : toast.error("Choose a class"))}
                printUrl={classId ? `/finance/print/class-list?${classQuery()}` : null}
                onCsv={classList.data ? () => classListCsv(classList.data!) : undefined}
              />
            </CardContent>
          </Card>
          {classList.data && (
            <div className="overflow-x-auto rounded-md border">
              <ClassListTable report={classList.data} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="debtors" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1">
                <Label className="text-xs">Class</Label>
                <Select value={dClass} onValueChange={setDClass}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Whole school</SelectItem>
                    {options?.classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40 space-y-1">
                <Label className="text-xs">Owing at least</Label>
                <MoneyInput value={min} onChange={setMin} />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Switch checked={overdueOnly} onCheckedChange={setOverdueOnly} /> Only overdue
              </label>
              <Actions
                loading={debtors.loading}
                onShow={() => debtors.run(`/finance/reports/debtors?${debtorsQuery()}`)}
                printUrl={`/finance/print/debtors?${debtorsQuery()}`}
                onCsv={debtors.data ? () => debtorsCsv(debtors.data!) : undefined}
              />
            </CardContent>
          </Card>
          {debtors.data && (
            <div className="overflow-x-auto rounded-md border">
              <DebtorsTable report={debtors.data} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="collections" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              <Actions
                loading={collections.loading}
                onShow={() => collections.run(`/finance/reports/collections?${collectionsQuery()}`)}
                printUrl={`/finance/print/collections?${collectionsQuery()}`}
                onCsv={collections.data ? () => collectionsCsv(collections.data!) : undefined}
              />
            </CardContent>
          </Card>
          {collections.data && <CollectionsTables report={collections.data} />}
        </TabsContent>
      </Tabs>
    </>
  );
}

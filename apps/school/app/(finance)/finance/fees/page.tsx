"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarRange, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Skeleton } from "@school/ui/components/skeleton";
import { Switch } from "@school/ui/components/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { FEE_CATEGORY_LABELS } from "@school/shared/fees/money";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { useFinanceOptions } from "@/hooks/useFinanceOptions";
import { useFinancePerson } from "@/components/finance/finance-context";
import { FinancePageHeader, ViewOnlyNote } from "@/components/finance/page-header";
import { FeeDialog } from "@/components/finance/fee-dialog";
import { TermFeesDialog } from "@/components/finance/term-fees-dialog";
import { dayLabel, k } from "@/components/finance/format";
import type { Fee } from "@/components/finance/types";

const ALL = "__all";

/** Fees and events of the year: term fees, trips, exam fees and other charges. */
export default function FeesPage() {
  const person = useFinancePerson();
  const options = useFinanceOptions();
  const [termId, setTermId] = useState(ALL);
  const [archived, setArchived] = useState(false);
  const [fees, setFees] = useState<Fee[] | null>(null);
  const [newFee, setNewFee] = useState(false);
  const [termFees, setTermFees] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (termId !== ALL) qs.set("termId", termId);
    if (archived) qs.set("archived", "1");
    api
      .get<{ data: Fee[] }>(`/finance/fees?${qs}`)
      .then(({ data }) => setFees(data))
      .catch((e) => {
        toast.error(getErrorMessage(e));
        setFees([]);
      });
  }, [termId, archived]);
  useEffect(load, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.post<{ data: { charged: number } }>("/finance/fees/refresh");
      toast.success(data.charged ? `${data.charged} new charge(s) for learners who joined since` : "Everyone is already charged");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };

  const yearTerms = options?.terms.filter((t) => t.academicYearId === options.activeYear?.id) ?? [];

  return (
    <>
      <FinancePageHeader
        title="Fees & events"
        description={options?.activeYear ? `Academic year ${options.activeYear.year}` : undefined}
        actions={
          person.canEdit &&
          options && (
            <>
              <Button variant="outline" onClick={refresh} disabled={refreshing} title="Charge learners who joined after the fees were set up">
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Update charges
              </Button>
              <Button variant="outline" onClick={() => setTermFees(true)}>
                <CalendarRange className="mr-2 h-4 w-4" />
                Term fees by year level
              </Button>
              <Button onClick={() => setNewFee(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New fee or event
              </Button>
            </>
          )
        }
      />
      {!person.canEdit && <ViewOnlyNote />}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Select value={termId} onValueChange={setTermId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All terms</SelectItem>
            {yearTerms.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={archived} onCheckedChange={setArchived} /> Show archived
        </label>
      </div>
      {!fees ? (
        <Skeleton className="h-64" />
      ) : fees.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No fees yet for this year.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee</TableHead>
                <TableHead>Who pays</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Learners</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Owed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((f) => (
                <TableRow key={f.id} className={f.archived ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link href={`/finance/fees/${f.id}`} className="font-medium hover:underline">
                      {f.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {FEE_CATEGORY_LABELS[f.category]}
                      {f.termLabel ? ` · ${f.termLabel}` : ""}
                      {f.instalments.length > 0 ? ` · ${f.instalments.length} instalments` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {f.targetKind === "ALL" ? "Whole school" : f.targetKind === "LEARNERS" ? "Chosen learners" : f.targets.join(", ")}
                    {f.optional && f.targetKind !== "LEARNERS" && (
                      <Badge variant="outline" className="ml-2">
                        optional
                      </Badge>
                    )}
                    {f.archived && (
                      <Badge variant="outline" className="ml-2">
                        archived
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{dayLabel(f.dueDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{k(f.amountNgwee)}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.learners}</TableCell>
                  <TableCell className="text-right tabular-nums">{k(f.paidNgwee)}</TableCell>
                  <TableCell className="text-right tabular-nums">{k(f.outstandingNgwee)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {options && (
        <>
          <FeeDialog open={newFee} onOpenChange={setNewFee} options={options} onSaved={load} />
          <TermFeesDialog open={termFees} onOpenChange={setTermFees} options={options} onSaved={load} />
        </>
      )}
    </>
  );
}

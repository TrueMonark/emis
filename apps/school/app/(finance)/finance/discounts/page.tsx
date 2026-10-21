"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { useFinancePerson } from "@/components/finance/finance-context";
import { FinancePageHeader, ViewOnlyNote } from "@/components/finance/page-header";
import { DiscountDialog } from "@/components/finance/discount-dialog";
import { dayLabel, discountText } from "@/components/finance/format";
import type { Discount } from "@/components/finance/types";

/** Discounts and bursaries: sibling, staff child, bursary, scholarship… */
export default function DiscountsPage() {
  const person = useFinancePerson();
  const [rows, setRows] = useState<Discount[] | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    api
      .get<{ data: Discount[] }>("/finance/discounts")
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const end = async (d: Discount) => {
    if (!confirm(`End "${d.name}" for ${d.learner}? This year's charges go back up.`)) return;
    try {
      await api.post(`/finance/discounts/${d.id}/end`);
      toast.success("Discount ended");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <>
      <FinancePageHeader
        title="Discounts & bursaries"
        description="A discount applies to the learner's fees for its academic year."
        actions={
          person.canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-2 h-4 w-4" /> Give a discount
            </Button>
          )
        }
      />
      {!person.canEdit && <ViewOnlyNote />}
      {!rows ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No discounts or bursaries yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id} className={d.endedAt ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link href={`/finance/learners/${d.studentId}`} className="hover:underline">
                      {d.learner}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{d.name}</span>
                    <span className="block text-xs text-muted-foreground">{discountText(d)}</span>
                  </TableCell>
                  <TableCell className="text-sm">{d.year}</TableCell>
                  <TableCell className="text-sm">{d.reason ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {d.endedAt ? (
                      <Badge variant="outline">ended {dayLabel(d.endedAt)}</Badge>
                    ) : (
                      person.canEdit && (
                        <Button size="sm" variant="outline" onClick={() => end(d)}>
                          End
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {person.canEdit && <DiscountDialog open={adding} onOpenChange={setAdding} onSaved={load} />}
    </>
  );
}

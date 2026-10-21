"use client";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { dayLabel, k, STATUS_STYLE } from "./format";
import { csvKwacha, downloadCsv } from "./csv";
import type { ChargeStatus, Payment } from "./types";

/** Report data from /api/finance/reports/* and the tables shown on screen and when printed. */

export interface ClassListReport {
  school: { name: string };
  classLabel: string;
  year: number;
  generatedAt: string;
  columns: { feeId: string; name: string; amountNgwee: number; optional: boolean }[];
  rows: {
    studentId: string;
    name: string;
    learnerNumber: string | null;
    fees: { charged: boolean; amountNgwee: number; paidNgwee: number; balanceNgwee: number; status: ChargeStatus | null }[];
    balanceNgwee: number;
    overdueNgwee: number;
  }[];
  totals: { fees: { amountNgwee: number; paidNgwee: number; balanceNgwee: number }[]; balanceNgwee: number };
}

export interface DebtorsReport {
  school: { name: string };
  generatedAt: string;
  rows: {
    studentId: string;
    name: string;
    learnerNumber: string | null;
    classLabel: string;
    chargedNgwee: number;
    paidNgwee: number;
    balanceNgwee: number;
    overdueNgwee: number;
    guardianName: string | null;
    guardianPhone: string | null;
  }[];
  totals: { learners: number; balanceNgwee: number; overdueNgwee: number };
}

export interface CollectionsReport {
  school: { name: string };
  from: string;
  to: string;
  generatedAt: string;
  payments: Payment[];
  voided: Payment[];
  byDay: { key: string; count: number; amountNgwee: number }[];
  byMethod: { key: string; label: string; count: number; amountNgwee: number }[];
  byReceiver: { key: string; count: number; amountNgwee: number }[];
  totals: { count: number; amountNgwee: number };
}

const num = "text-right tabular-nums";

export function ClassListTable({ report }: { report: ClassListReport }) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>#</TableHead>
          <TableHead rowSpan={2}>Learner</TableHead>
          {report.columns.map((c) => (
            <TableHead key={c.feeId} colSpan={2} className="text-center border-l">
              {c.name}
            </TableHead>
          ))}
          <TableHead rowSpan={2} className={`${num} border-l`}>
            Total owed
          </TableHead>
        </TableRow>
        <TableRow>
          {report.columns.map((c) => [
            <TableHead key={`${c.feeId}-p`} className={`${num} border-l`}>
              Paid
            </TableHead>,
            <TableHead key={`${c.feeId}-b`} className={num}>
              Owing
            </TableHead>,
          ])}
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((r, i) => (
          <TableRow key={r.studentId}>
            <TableCell>{i + 1}</TableCell>
            <TableCell className="font-medium">{r.name}</TableCell>
            {r.fees.map((f, j) =>
              f.charged
                ? [
                    <TableCell key={`${j}-p`} className={`${num} border-l`}>
                      {k(f.paidNgwee)}
                    </TableCell>,
                    <TableCell key={`${j}-b`} className={num}>
                      {f.balanceNgwee === 0 ? STATUS_STYLE[f.status ?? "PAID"].label : k(f.balanceNgwee)}
                    </TableCell>,
                  ]
                : [
                    <TableCell key={`${j}-p`} className="border-l text-center text-muted-foreground" colSpan={2}>
                      —
                    </TableCell>,
                  ]
            )}
            <TableCell className={`${num} border-l font-medium`}>{k(r.balanceNgwee)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>{report.rows.length} learners</TableCell>
          {report.totals.fees.map((t, j) => [
            <TableCell key={`${j}-p`} className={`${num} border-l`}>
              {k(t.paidNgwee)}
            </TableCell>,
            <TableCell key={`${j}-b`} className={num}>
              {k(t.balanceNgwee)}
            </TableCell>,
          ])}
          <TableCell className={`${num} border-l`}>{k(report.totals.balanceNgwee)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function classListCsv(r: ClassListReport) {
  downloadCsv(
    `class-list-${r.classLabel}`,
    ["Learner", "Learner number", ...r.columns.flatMap((c) => [`${c.name} charged (K)`, `${c.name} paid (K)`, `${c.name} owing (K)`]), "Total owed (K)"],
    r.rows.map((row) => [
      row.name,
      row.learnerNumber,
      ...row.fees.flatMap((f) => (f.charged ? [csvKwacha(f.amountNgwee), csvKwacha(f.paidNgwee), csvKwacha(f.balanceNgwee)] : ["", "", ""])),
      csvKwacha(row.balanceNgwee),
    ])
  );
}

export function DebtorsTable({ report }: { report: DebtorsReport }) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Learner</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Guardian</TableHead>
          <TableHead className={num}>Charged</TableHead>
          <TableHead className={num}>Paid</TableHead>
          <TableHead className={num}>Owing</TableHead>
          <TableHead className={num}>Overdue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((r, i) => (
          <TableRow key={r.studentId}>
            <TableCell>{i + 1}</TableCell>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell>{r.classLabel}</TableCell>
            <TableCell>
              {r.guardianName ?? "—"}
              {r.guardianPhone && <span className="block text-muted-foreground">{r.guardianPhone}</span>}
            </TableCell>
            <TableCell className={num}>{k(r.chargedNgwee)}</TableCell>
            <TableCell className={num}>{k(r.paidNgwee)}</TableCell>
            <TableCell className={`${num} font-medium`}>{k(r.balanceNgwee)}</TableCell>
            <TableCell className={num}>{k(r.overdueNgwee)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={6}>{report.totals.learners} learners owing</TableCell>
          <TableCell className={num}>{k(report.totals.balanceNgwee)}</TableCell>
          <TableCell className={num}>{k(report.totals.overdueNgwee)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function debtorsCsv(r: DebtorsReport) {
  downloadCsv(
    "debtors",
    ["Learner", "Learner number", "Class", "Guardian", "Guardian phone", "Charged (K)", "Paid (K)", "Owing (K)", "Overdue (K)"],
    r.rows.map((x) => [x.name, x.learnerNumber, x.classLabel, x.guardianName, x.guardianPhone, csvKwacha(x.chargedNgwee), csvKwacha(x.paidNgwee), csvKwacha(x.balanceNgwee), csvKwacha(x.overdueNgwee)])
  );
}

function Summary({ title, rows }: { title: string; rows: { label: string; count: number; amountNgwee: number }[] }) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{title}</p>
      <Table className="text-xs">
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell className={num}>{r.count}</TableCell>
              <TableCell className={num}>{k(r.amountNgwee)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CollectionsTables({ report }: { report: CollectionsReport }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <Summary title="By method" rows={report.byMethod.map((m) => ({ label: m.label, count: m.count, amountNgwee: m.amountNgwee }))} />
        <Summary title="By day" rows={report.byDay.map((d) => ({ label: dayLabel(`${d.key}T00:00:00Z`), count: d.count, amountNgwee: d.amountNgwee }))} />
        <Summary title="Received by" rows={report.byReceiver.map((d) => ({ label: d.key, count: d.count, amountNgwee: d.amountNgwee }))} />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">Receipts</p>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Learner</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className={num}>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{dayLabel(p.paidOn)}</TableCell>
                <TableCell className="font-mono">{p.receiptNumber}</TableCell>
                <TableCell>{p.learner}</TableCell>
                <TableCell>{p.methodLabel}</TableCell>
                <TableCell>{p.reference ?? ""}</TableCell>
                <TableCell className={num}>{k(p.amountNgwee)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>{report.totals.count} payments</TableCell>
              <TableCell className={num}>{k(report.totals.amountNgwee)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {report.voided.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold">Cancelled receipts (not counted)</p>
          <Table className="text-xs">
            <TableBody>
              {report.voided.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.receiptNumber}</TableCell>
                  <TableCell>{p.learner}</TableCell>
                  <TableCell className={num}>{k(p.amountNgwee)}</TableCell>
                  <TableCell>{p.voidReason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function collectionsCsv(r: CollectionsReport) {
  downloadCsv(
    `collections-${r.from.slice(0, 10)}-to-${r.to.slice(0, 10)}`,
    ["Date", "Receipt", "Learner", "Learner number", "Method", "Reference", "Paid by", "Received by", "Amount (K)"],
    r.payments.map((p) => [dayLabel(p.paidOn), p.receiptNumber, p.learner, p.learnerNumber, p.methodLabel, p.reference, p.payerName, p.receivedBy, csvKwacha(p.amountNgwee)])
  );
}

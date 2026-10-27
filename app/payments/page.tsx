"use client";

import { useCallback, useEffect, useState } from "react";
import TrafficSidebar from "@/app/traffic-sidebar";

type PaymentRecord = {
  id: number;
  event_id: number;
  vehicle_id: number | null;
  plate_number: string;
  violation_name: string;
  amount: string;
  currency: string;
  payment_status: "UNPAID" | "PAID";
  paid_at: string | null;
  created_at: string;
  detected_at: string;
  driver_name: string | null;
  driver_license: string | null;
  driver_phone: string | null;
};

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "The request could not be completed.");
  }
  return data;
}

function formatAmount(amount: string, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments", { cache: "no-store" });
      setPayments(await readResponse(response) as PaymentRecord[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  async function markAsPaid(payment: PaymentRecord) {
    if (!window.confirm(`Mark ${payment.currency} ${Number(payment.amount).toFixed(2)} for plate ${payment.plate_number} as paid?`)) return;
    setBusyId(payment.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/payments/${payment.id}`, { method: "PATCH" });
      const result = await readResponse(response);
      setMessage(result.message ?? "Payment marked as paid.");
      await loadPayments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update payment status.");
    } finally {
      setBusyId(null);
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPayments = payments.filter((payment) => {
    const matchesSearch = !normalizedSearch || [
      payment.plate_number,
      payment.driver_name ?? "",
      payment.driver_license ?? "",
      payment.violation_name,
    ].some((value) => value.toLowerCase().includes(normalizedSearch));
    return matchesSearch && (statusFilter === "ALL" || payment.payment_status === statusFilter);
  });
  const unpaidTotal = payments.filter((payment) => payment.payment_status === "UNPAID").reduce((total, payment) => total + Number(payment.amount), 0);
  const paidTotal = payments.filter((payment) => payment.payment_status === "PAID").reduce((total, payment) => total + Number(payment.amount), 0);
  const currency = payments[0]?.currency ?? "ETB";

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <TrafficSidebar activeItem="Payments" />
      <section className="min-w-0 flex-1 p-5 sm:p-7 xl:p-9">
        <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-7xl flex-col gap-6">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Administration / Payments</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Penalty payments</h1>
              <p className="mt-1 text-sm text-slate-500">Track issued camera penalties against the responsible driver.</p>
            </div>
          </header>

          {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          {message && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

          <div className="row g-3">
            <div className="col-12 col-md-6">
              <section className="h-full rounded-lg border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4">
                <p className="text-sm font-medium text-slate-500">Outstanding payments</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{loading ? "—" : formatAmount(String(unpaidTotal), currency)}</p>
                <p className="mt-1 text-xs text-slate-500">{payments.filter((payment) => payment.payment_status === "UNPAID").length} unpaid penalties</p>
              </section>
            </div>
            <div className="col-12 col-md-6">
              <section className="h-full rounded-lg border border-slate-200 border-l-4 border-l-emerald-600 bg-white p-4">
                <p className="text-sm font-medium text-slate-500">Payments recorded</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{loading ? "—" : formatAmount(String(paidTotal), currency)}</p>
                <p className="mt-1 text-xs text-slate-500">{payments.filter((payment) => payment.payment_status === "PAID").length} paid penalties</p>
              </section>
            </div>
          </div>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
              <label className="min-w-56 flex-1">
                <span className="sr-only">Search payments</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plate, driver, or violation..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
              </label>
              <div role="group" aria-label="Filter by payment status" className="flex max-w-full flex-wrap rounded-md border border-slate-200 bg-slate-100 p-1">
                {(["ALL", "UNPAID", "PAID"] as const).map((status) => (
                  <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={`rounded px-3 py-1.5 text-xs font-semibold transition ${statusFilter === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                    {status === "ALL" ? "All" : status === "UNPAID" ? "Unpaid" : "Paid"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full table-fixed text-left text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500"><tr>
                  <th className="w-[14%] px-4 py-3">Plate</th>
                  <th className="w-[18%] px-4 py-3">Driver</th>
                  <th className="w-[19%] px-4 py-3">Violation</th>
                  <th className="w-[15%] px-4 py-3 text-right">Amount</th>
                  <th className="w-[14%] px-4 py-3">Detected</th>
                  <th className="w-[12%] px-4 py-3">Payment status</th>
                  <th className="w-[12%] px-4 py-3 text-right">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">Loading penalty payments...</td></tr> : filteredPayments.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center"><p className="font-medium text-slate-800">{payments.length ? "No payments match these filters" : "No issued penalties yet"}</p><p className="mt-1 text-sm text-slate-500">Issued camera penalties will appear here.</p></td></tr> : filteredPayments.map((payment) => (
                    <tr key={payment.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/50">
                      <td className="px-4 py-3.5 font-mono font-semibold text-slate-800">{payment.plate_number}</td>
                      <td className="px-4 py-3.5"><p className="font-medium text-slate-800">{payment.driver_name || "Driver not linked"}</p><p className="mt-1 text-xs text-slate-500">{payment.driver_license || payment.driver_phone || "No driver details"}</p></td>
                      <td className="px-4 py-3.5 text-slate-700">{payment.violation_name}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatAmount(payment.amount, payment.currency)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">{formatDate(payment.detected_at)}</td>
                      <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${payment.payment_status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{payment.payment_status === "PAID" ? "Paid" : "Unpaid"}</span></td>
                      <td className="px-4 py-3.5 text-right">{payment.payment_status === "UNPAID" ? <button type="button" disabled={busyId === payment.id} onClick={() => void markAsPaid(payment)} className="rounded-md bg-teal-800 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60">{busyId === payment.id ? "Saving..." : "Mark paid"}</button> : <span className="text-xs text-slate-500">{payment.paid_at ? `Paid ${formatDate(payment.paid_at)}` : "Recorded"}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">Showing {filteredPayments.length} of {payments.length} issued penalties</div>
          </section>
        </main>
      </section>
    </div>
  );
}
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import TrafficSidebar from "@/app/traffic-sidebar";

type ReportView = "periodic" | "penalties" | "summary" | "status" | "cameras" | "daily";
type ReportFilters = {
  from: string;
  to: string;
  status: string;
  eventType: string;
  vehicleType: string;
  search: string;
};
type ReportRow = Record<string, string | number | null>;

const emptyFilters: ReportFilters = {
  from: "",
  to: "",
  status: "",
  eventType: "",
  vehicleType: "",
  search: "",
};

const reportTabs: Array<{ id: ReportView; label: string }> = [
  { id: "periodic", label: "Periodic report" },
  { id: "penalties", label: "Penalty report" },
  { id: "summary", label: "Summary report" },
  { id: "status", label: "Status summary" },
  { id: "cameras", label: "Camera report" },
  { id: "daily", label: "Daily report" },
];

const columns: Record<ReportView, Array<{ key: string; label: string }>> = {
  periodic: [
    { key: "detected_at", label: "Detected" },
    { key: "plate_number", label: "Plate" },
    { key: "driver_name", label: "Driver" },
    { key: "camera_name", label: "Camera" },
    { key: "event_type", label: "Event" },
    { key: "review_status", label: "Status" },
    { key: "confidence", label: "Confidence" },
  ],
  daily: [
    { key: "detected_at", label: "Detected" },
    { key: "plate_number", label: "Plate" },
    { key: "driver_name", label: "Driver" },
    { key: "vehicle_type", label: "Vehicle type" },
    { key: "event_type", label: "Event" },
    { key: "review_status", label: "Status" },
  ],
  penalties: [
    { key: "detected_at", label: "Detected" },
    { key: "plate_number", label: "Plate" },
    { key: "driver_name", label: "Driver" },
    { key: "violation_name", label: "Violation" },
    { key: "amount", label: "Amount" },
    { key: "payment_status", label: "Payment" },
    { key: "penalty_status", label: "Penalty status" },
  ],
  summary: [
    { key: "label", label: "Event type" },
    { key: "event_count", label: "Events" },
    { key: "matched_vehicles", label: "Matched vehicles" },
    { key: "average_confidence", label: "Average confidence" },
    { key: "latest_event", label: "Latest event" },
  ],
  status: [
    { key: "label", label: "Review status" },
    { key: "event_count", label: "Events" },
    { key: "matched_vehicles", label: "Matched vehicles" },
    { key: "average_confidence", label: "Average confidence" },
    { key: "latest_event", label: "Latest event" },
  ],
  cameras: [
    { key: "camera_code", label: "Camera code" },
    { key: "camera_name", label: "Camera" },
    { key: "location", label: "Location" },
    { key: "camera_type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "event_count", label: "Events" },
    { key: "latest_event", label: "Latest event" },
  ],
};

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Could not load report data.");
  }
  return data as ReportRow[];
}

function displayValue(key: string, value: ReportRow[string], row: ReportRow) {
  if (value === null || value === undefined || value === "") return "-";
  if (["detected_at", "latest_event"].includes(key)) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  if (key === "confidence") return `${(Number(value) * 100).toFixed(1)}%`;
  if (key === "average_confidence") return value === null ? "-" : `${Number(value).toFixed(1)}%`;
  if (key === "amount") return `${String(row.currency ?? "")} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return String(value).replaceAll("_", " ");
}

export default function ReportsPage() {
  const [view, setView] = useState<ReportView>("periodic");
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(emptyFilters);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async (nextView: ReportView, nextFilters: ReportFilters) => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ view: nextView });
    for (const [key, value] of Object.entries(nextFilters)) {
      if (value) query.set(key, value);
    }
    try {
      setRows(await readResponse(await fetch(`/api/reports?${query}`, { cache: "no-store" })));
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : "Could not load report data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport("periodic", emptyFilters);
  }, [loadReport]);

  function chooseView(nextView: ReportView) {
    const nextFilters = { ...appliedFilters };
    if (nextView === "daily" && !nextFilters.from && !nextFilters.to) {
      const today = new Date().toISOString().slice(0, 10);
      nextFilters.from = today;
      nextFilters.to = today;
      setFilters(nextFilters);
      setAppliedFilters(nextFilters);
    }
    setView(nextView);
    void loadReport(nextView, nextFilters);
  }

  function searchReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
    void loadReport(view, filters);
  }

  function exportReport() {
    const reportColumns = columns[view];
    const csvRows = [
      reportColumns.map((column) => column.label),
      ...rows.map((row) => reportColumns.map((column) => displayValue(column.key, row[column.key], row))),
    ];
    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blobUrl = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `traffic-${view}-report.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  }

  const reportColumns = columns[view];
  const statuses = view === "penalties"
    ? ["UNPAID", "PAID"]
    : view === "cameras"
      ? ["ONLINE", "OFFLINE", "MAINTENANCE"]
      : ["PENDING", "PENALTY_PENDING", "VIOLATION_ISSUED", "REVIEWED"];
  const groupedReport = view === "summary" || view === "status";

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <TrafficSidebar activeItem="Reports" />
      <section className="min-w-0 flex-1 p-5 sm:p-7 xl:p-9">
        <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[1600px] flex-col gap-5">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Administration / Reports</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">Traffic reports</h1>
            </div>
            <button type="button" onClick={exportReport} disabled={rows.length === 0} className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Export CSV</button>
          </header>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div role="tablist" aria-label="Report type" className="flex overflow-x-auto border-b border-slate-200 px-3 sm:px-5">
              {reportTabs.map((tab) => (
                <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} onClick={() => chooseView(tab.id)} className={`shrink-0 border-b-[3px] px-3 py-3 text-xs font-semibold transition sm:px-4 ${view === tab.id ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={searchReport} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
              <label className="text-xs font-semibold text-slate-700">From
                <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal text-slate-700 outline-none focus:border-teal-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">To
                <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal text-slate-700 outline-none focus:border-teal-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Status
                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} disabled={groupedReport} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-normal text-slate-700 outline-none focus:border-teal-700 disabled:bg-slate-100">
                  <option value="">All statuses</option>
                  {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              {view === "penalties" ? (
                <label className="text-xs font-semibold text-slate-700">Violation type
                  <input value={filters.eventType} onChange={(event) => setFilters({ ...filters, eventType: event.target.value })} placeholder="Search violation" className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal text-slate-700 outline-none focus:border-teal-700" />
                </label>
              ) : (
                <label className="text-xs font-semibold text-slate-700">Event type
                  <select value={filters.eventType} onChange={(event) => setFilters({ ...filters, eventType: event.target.value })} disabled={groupedReport || view === "cameras"} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-normal text-slate-700 outline-none focus:border-teal-700 disabled:bg-slate-100">
                    <option value="">All event types</option><option value="PLATE_DETECTED">Plate detected</option><option value="UNREGISTERED_VEHICLE">Unregistered vehicle</option>
                  </select>
                </label>
              )}
              <label className="text-xs font-semibold text-slate-700">Vehicle type
                <select value={filters.vehicleType} onChange={(event) => setFilters({ ...filters, vehicleType: event.target.value })} disabled={view === "summary" || view === "status" || view === "cameras"} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-normal text-slate-700 outline-none focus:border-teal-700 disabled:bg-slate-100">
                  <option value="">All vehicle types</option><option>Private</option><option>Commercial</option><option>Taxi</option><option>Bus</option><option>Motorcycle</option><option>Truck</option><option>Government</option><option>Other</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700 lg:col-span-3">Search
                <span className="mt-1.5 flex h-9 w-full overflow-hidden rounded-md border border-slate-300 focus-within:border-teal-700">
                  <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Plate, driver, camera..." className="min-w-0 flex-1 px-2.5 text-sm font-normal outline-none" />
                  <button type="submit" className="bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800">Search</button>
                </span>
              </label>
            </form>
          </section>

          {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div><h2 className="text-sm font-semibold text-slate-900">{reportTabs.find((tab) => tab.id === view)?.label}</h2><p className="mt-0.5 text-xs text-slate-500">{rows.length.toLocaleString()} rows</p></div>
              <button type="button" onClick={() => void loadReport(view, appliedFilters)} disabled={loading} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{loading ? "Refreshing..." : "Refresh"}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500"><tr>{reportColumns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3">{column.label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? <tr><td colSpan={reportColumns.length} className="px-4 py-12 text-center text-sm text-slate-500">Loading report...</td></tr> : rows.length === 0 ? <tr><td colSpan={reportColumns.length} className="px-4 py-12 text-center text-sm text-slate-500">No results for this report and filter set.</td></tr> : rows.map((row, index) => (
                    <tr key={String(row.id ?? `${view}-${index}`)} className="odd:bg-white even:bg-slate-50/60 hover:bg-teal-50/40">
                      {reportColumns.map((column) => <td key={column.key} className="max-w-xs whitespace-nowrap px-4 py-3 text-slate-700">{displayValue(column.key, row[column.key], row)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}
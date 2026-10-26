"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import TrafficSidebar from "@/app/traffic-sidebar";

type DriverOption = {
  id: number;
  full_name: string;
  license_number: string | null;
  phone_number: string;
  vehicle_type: string;
};

type VehicleOption = {
  id: number;
  plate: string;
  owner_name: string;
  make: string;
  model: string;
  type: string;
  status: string;
};

type Agreement = {
  id: number;
  vehicle_id: number;
  driver_id: number;
  plate_number: string;
  owner_name: string | null;
  driver_name: string;
  license_number: string | null;
  phone_number: string;
  vehicle_type: string;
  amount: string;
  vat_amount: string;
  total_amount: string;
  currency: string;
  start_date: string;
  end_date: string | null;
  status: "ACTIVE" | "UPCOMING" | "COMPLETED" | "CANCELLED";
  created_at: string;
};

type AgreementForm = {
  vehicle_id: string;
  driver_id: string;
  amount: string;
  vat_amount: string;
  currency: string;
  start_date: string;
  end_date: string;
};

function initialForm(): AgreementForm {
  return {
    vehicle_id: "",
    driver_id: "",
    amount: "",
    vat_amount: "0",
    currency: "ETB",
    start_date: "",
    end_date: "",
  };
}

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "The request could not be completed.");
  }
  return data;
}

function formatMoney(amount: string, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function displayDate(value: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [form, setForm] = useState<AgreementForm>(initialForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAgreementId, setBusyAgreementId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [agreementsResponse, driversResponse, vehiclesResponse] = await Promise.all([
        fetch("/api/agreements", { cache: "no-store" }),
        fetch("/api/drivers", { cache: "no-store" }),
        fetch("/api/vehicles", { cache: "no-store" }),
      ]);
      const [agreementRows, driverRows, vehicleRows] = await Promise.all([
        readResponse(agreementsResponse) as Promise<Agreement[]>,
        readResponse(driversResponse) as Promise<DriverOption[]>,
        readResponse(vehiclesResponse) as Promise<VehicleOption[]>,
      ]);
      setAgreements(agreementRows);
      setDrivers(driverRows);
      setVehicles(vehicleRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load agreement data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          vehicle_id: Number(form.vehicle_id),
          driver_id: Number(form.driver_id),
          amount: Number(form.amount),
          vat_amount: Number(form.vat_amount || 0),
        }),
      });
      const result = await readResponse(response);
      setShowForm(false);
      setForm(initialForm());
      setMessage(result.message ?? "Agreement created.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create agreement.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(agreement: Agreement, status: Agreement["status"]) {
    setBusyAgreementId(agreement.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/agreements/${agreement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await readResponse(response);
      setMessage(result.message ?? "Agreement status updated.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update agreement.");
    } finally {
      setBusyAgreementId(null);
    }
  }

  function exportAgreements() {
    const rows = [
      ["Driver", "Driver License", "Vehicle Plate", "Vehicle Owner", "Amount", "VAT", "Total", "Vehicle Type", "Start Date", "End Date", "Status"],
      ...filteredAgreements.map((agreement) => [
        agreement.driver_name,
        agreement.license_number ?? "",
        agreement.plate_number,
        agreement.owner_name ?? "",
        agreement.amount,
        agreement.vat_amount,
        agreement.total_amount,
        agreement.vehicle_type,
        agreement.start_date,
        agreement.end_date ?? "",
        agreement.status,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "vehicle-driver-agreements.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredAgreements = agreements.filter((agreement) => {
    const matchesSearch = !normalizedSearch || [
      agreement.driver_name,
      agreement.plate_number,
      agreement.owner_name ?? "",
      agreement.license_number ?? "",
    ].some((value) => value.toLowerCase().includes(normalizedSearch));
    return matchesSearch && (statusFilter === "ALL" || agreement.status === statusFilter);
  });

  const availableVehicles = vehicles.filter((vehicle) => vehicle.status !== "Inactive" && vehicle.status !== "Maintenance");
  const totalAmount = Number(form.amount || 0) + Number(form.vat_amount || 0);
  const inputClass = "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100";
  const statusFilters = ["ALL", "ACTIVE", "UPCOMING", "COMPLETED", "CANCELLED"] as const;

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <TrafficSidebar activeItem="Agreements" />
      <section className="min-w-0 flex-1 p-6 md:p-10">
        <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-7xl flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Administration / Agreements</p>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-950">Vehicle agreements</h1>
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">{agreements.length.toLocaleString()} total</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportAgreements} disabled={filteredAgreements.length === 0} className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Export CSV</button>
              <button type="button" onClick={() => { setForm({ ...initialForm(), start_date: new Date().toISOString().slice(0, 10) }); setError(""); setMessage(""); setShowForm(true); }} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">+ Add Agreement</button>
            </div>
          </header>

          {message && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
          {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-w-56 flex-1">
                  <span className="sr-only">Search agreements</span>
                  <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search driver, plate or owner..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
                </label>
                <div role="group" aria-label="Filter agreements by status" className="flex max-w-full flex-wrap rounded-md border border-slate-200 bg-slate-100 p-1">
                  {statusFilters.map((status) => (
                    <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${statusFilter === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                      {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full table-fixed text-left text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-[17%] px-4 py-3">Driver</th>
                    <th className="w-[15%] px-4 py-3">Vehicle</th>
                    <th className="w-[10%] px-4 py-3 text-right">Amount</th>
                    <th className="w-[8%] px-4 py-3 text-right">VAT</th>
                    <th className="w-[11%] px-4 py-3 text-right">Amount inc. VAT</th>
                    <th className="w-[9%] px-4 py-3">Vehicle type</th>
                    <th className="w-[9%] px-4 py-3">Start date</th>
                    <th className="w-[9%] px-4 py-3">End date</th>
                    <th className="w-[10%] px-4 py-3">Contract status</th>
                    <th className="w-[10%] px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? <tr><td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-500">Loading agreements...</td></tr> : filteredAgreements.length === 0 ? <tr><td colSpan={10} className="px-5 py-12 text-center"><p className="font-medium text-slate-800">{agreements.length ? "No agreements match these filters" : "No agreements yet"}</p><p className="mt-1 text-sm text-slate-500">Create an agreement to connect a driver with an owner’s vehicle.</p></td></tr> : filteredAgreements.map((agreement) => (
                    <tr key={agreement.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/50">
                      <td className="px-4 py-3.5"><p className="font-semibold text-slate-800">{agreement.driver_name}</p><p className="mt-1 text-xs text-slate-500">{agreement.license_number || agreement.phone_number}</p></td>
                      <td className="px-4 py-3.5"><p className="font-mono font-medium text-slate-700">{agreement.plate_number}</p><p className="mt-1 truncate text-xs text-slate-500">{agreement.owner_name || "Owner not recorded"}</p></td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{formatMoney(agreement.amount, agreement.currency)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{formatMoney(agreement.vat_amount, agreement.currency)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatMoney(agreement.total_amount, agreement.currency)}</td>
                      <td className="px-4 py-3.5 text-slate-700">{agreement.vehicle_type}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{displayDate(agreement.start_date)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{displayDate(agreement.end_date)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${agreement.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : agreement.status === "UPCOMING" ? "bg-sky-100 text-sky-800" : agreement.status === "COMPLETED" ? "bg-slate-200 text-slate-700" : "bg-rose-100 text-rose-800"}`}>
                          {agreement.status.charAt(0) + agreement.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {agreement.status === "ACTIVE" || agreement.status === "UPCOMING" ? (
                          <select aria-label={`Change status for agreement ${agreement.id}`} value={agreement.status} disabled={busyAgreementId === agreement.id} onChange={(event) => void changeStatus(agreement, event.target.value as Agreement["status"])} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700">
                            <option value="ACTIVE">Active</option><option value="UPCOMING">Upcoming</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
                          </select>
                        ) : <span className="text-sm text-slate-500">Closed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">Showing {filteredAgreements.length} of {agreements.length} agreements</div>
          </section>
        </main>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="agreement-form-title" className="my-auto w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-teal-800 px-6 py-5 text-white">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-teal-100">Vehicle rental</p><h2 id="agreement-form-title" className="mt-1 text-xl font-bold">Add agreement</h2></div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close agreement form" className="text-3xl leading-none">×</button>
            </div>
            <form onSubmit={saveAgreement} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <label className="text-sm font-semibold text-slate-700">Driver / tenant
                <select required value={form.driver_id} onChange={(event) => setForm({ ...form, driver_id: event.target.value })} className={inputClass}>
                  <option value="">Select a driver</option>
                  {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name} · {driver.license_number || "No license"}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Vehicle / plate
                <select required value={form.vehicle_id} onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })} className={inputClass}>
                  <option value="">Select a vehicle</option>
                  {availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.owner_name || "Owner unknown"} · {vehicle.make} {vehicle.model}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Agreement amount
                <input required type="number" min="0.01" step="0.01" max="99999999.99" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={inputClass} placeholder="0.00" />
              </label>
              <label className="text-sm font-semibold text-slate-700">VAT amount
                <input type="number" min="0" step="0.01" max="99999999.99" value={form.vat_amount} onChange={(event) => setForm({ ...form, vat_amount: event.target.value })} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Currency
                <input required minLength={3} maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} className={`${inputClass} uppercase`} />
              </label>
              <div className="flex items-end justify-between rounded-md bg-slate-50 px-3 py-2.5 sm:col-span-1">
                <span className="text-sm font-medium text-slate-600">Amount incl. VAT</span>
                <span className="font-semibold tabular-nums text-slate-900">{formatMoney(String(totalAmount), form.currency || "ETB")}</span>
              </div>
              <label className="text-sm font-semibold text-slate-700">Start date
                <input required type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">End date <span className="font-normal text-slate-500">(optional)</span>
                <input type="date" min={form.start_date} value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} className={inputClass} />
              </label>
              <p className="text-xs text-slate-500 sm:col-span-2">Active dates cannot overlap another agreement for the same vehicle or driver.</p>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving || drivers.length === 0 || availableVehicles.length === 0} className="rounded-md bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Create agreement"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
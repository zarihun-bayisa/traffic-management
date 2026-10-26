
"use client";

import { useCallback, useEffect, useState } from "react";
import TrafficSidebar from "@/app/traffic-sidebar";

type Driver = {
  id: number;
  full_name: string;
  plate_number: string;
  license_number: string | null;
  vehicle_type: string;
  phone_number: string;
  created_at: string;
};

const emptyForm = {
  full_name: "",
  plate_number: "",
  license_number: "",
  vehicle_type: "Private",
  phone_number: "",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [listFilter, setListFilter] = useState<"ALL" | "RECENT" | "MISSING_LICENSE">("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDrivers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/drivers?search=${encodeURIComponent(search)}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Could not load drivers.");
      setDrivers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load drivers.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDrivers();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadDrivers]);

  function changeField(
    field: keyof typeof emptyForm,
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  async function saveDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const response = await fetch(
        editingId ? `/api/drivers/${editingId}` : "/api/drivers",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save driver.");

      setMessage(data.message);
      resetForm();
      await loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save driver.");
    } finally {
      setSaving(false);
    }
  }

  async function importDrivers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) {
      setImportError("Choose an Excel file first.");
      return;
    }
    setImportBusy(true);
    setImportError("");
    setError("");
    setMessage("");
    const body = new FormData();
    body.set("file", importFile);

    try {
      const response = await fetch("/api/drivers/import", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const rowErrors = Array.isArray(data.errors) ? ` ${data.errors.join(" ")}` : "";
        const duplicates = Array.isArray(data.duplicates) ? ` ${data.duplicates.join(", ")}` : "";
        throw new Error(`${data.message ?? "Could not import drivers."}${rowErrors}${duplicates}`);
      }
      setShowImportDialog(false);
      setImportFile(null);
      setMessage(data.message ?? "Drivers imported successfully.");
      await loadDrivers();
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "Could not import drivers.");
    } finally {
      setImportBusy(false);
    }
  }

  function editDriver(driver: Driver) {
    setEditingId(driver.id);
    setShowForm(true);
    setForm({
      full_name: driver.full_name,
      plate_number: driver.plate_number,
      license_number: driver.license_number ?? "",
      vehicle_type: driver.vehicle_type,
      phone_number: driver.phone_number,
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteDriver(driver: Driver) {
    if (!window.confirm(`Delete driver ${driver.full_name}?`)) return;

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Could not delete driver.");

      setMessage(data.message);
      if (editingId === driver.id) resetForm();
      await loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete driver.");
    }
  }

  const driverTypes = [...new Set(drivers.map((driver) => driver.vehicle_type).filter(Boolean))].sort();
  const filteredDrivers = drivers.filter((driver) => {
    const matchesType = typeFilter === "ALL" || driver.vehicle_type === typeFilter;
    const matchesList = listFilter === "ALL" ||
      (listFilter === "MISSING_LICENSE" && !driver.license_number) ||
      (listFilter === "RECENT" && Date.now() - new Date(driver.created_at).getTime() <= 30 * 24 * 60 * 60 * 1000);
    return matchesType && matchesList;
  });

  function exportDrivers() {
    const rows = [
      ["Driver", "Plate Number", "License Number", "Vehicle Type", "Phone Number", "Created At"],
      ...filteredDrivers.map((driver) => [
        driver.full_name,
        driver.plate_number,
        driver.license_number ?? "",
        driver.vehicle_type,
        driver.phone_number,
        driver.created_at,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "drivers.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <TrafficSidebar activeItem="Drivers" />
      <section className="min-w-0 flex-1 p-6 md:p-10">
        <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-7xl flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Administration / Drivers</p>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-slate-950">Drivers</h1>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">{drivers.length.toLocaleString()} total</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportDrivers} disabled={filteredDrivers.length === 0} className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Export CSV</button>
              <a href="/api/drivers/import" className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Download template</a>
              <button type="button" onClick={() => { setImportError(""); setImportFile(null); setShowImportDialog(true); }} className="rounded-md border border-teal-700 px-3.5 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50">Import Excel</button>
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setEditingId(null);
                  setMessage("");
                  setError("");
                  setShowForm(true);
                }}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                + Add Driver
              </button>
            </div>
          </header>

          {message && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
          {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
              <label className="min-w-56 flex-1">
                <span className="sr-only">Search drivers</span>
                <input
                  type="search"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, plate, license or phone..."
                />
              </label>
              <label>
                <span className="sr-only">Filter by vehicle type</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-700">
                  <option value="ALL">All vehicle types</option>
                  {driverTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <div role="group" aria-label="Filter drivers" className="flex max-w-full flex-wrap rounded-md border border-slate-200 bg-slate-100 p-1">
                {(["ALL", "RECENT", "MISSING_LICENSE"] as const).map((filter) => (
                  <button key={filter} type="button" aria-pressed={listFilter === filter} onClick={() => setListFilter(filter)} className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${listFilter === filter ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                    {filter === "ALL" ? "All" : filter === "RECENT" ? "New" : "Missing license"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-[28%] px-4 py-3">Driver</th>
                    <th className="w-[16%] px-4 py-3">License plate</th>
                    <th className="w-[18%] px-4 py-3">Driver license</th>
                    <th className="w-[14%] px-4 py-3">Vehicle type</th>
                    <th className="w-[16%] px-4 py-3">Phone</th>
                    <th className="w-[8%] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">Loading drivers...</td></tr>
                  ) : filteredDrivers.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center">
                      <p className="font-medium text-slate-800">No drivers match these filters</p>
                      <p className="mt-1 text-sm text-slate-500">Try changing the search or filters.</p>
                    </td></tr>
                  ) : filteredDrivers.map((driver) => (
                    <tr key={driver.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/50">
                      <td className="px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">{driver.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                          <span className="truncate font-semibold text-slate-800">{driver.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-600">{driver.plate_number}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-600">{driver.license_number || <span className="font-sans text-xs text-slate-400">Not recorded</span>}</td>
                      <td className="px-4 py-3.5 text-slate-700">{driver.vehicle_type}</td>
                      <td className="px-4 py-3.5 text-slate-600">{driver.phone_number}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => editDriver(driver)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                          <button type="button" onClick={() => void deleteDriver(driver)} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">Showing {filteredDrivers.length} of {drivers.length} drivers</div>
          </section>
        </main>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="driver-form-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-teal-800 px-6 py-5 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">Driver records</p>
                <h2 id="driver-form-title" className="mt-1 text-xl font-bold">{editingId ? "Edit driver" : "Add driver"}</h2>
              </div>
              <button type="button" onClick={resetForm} aria-label="Close driver form" className="text-3xl leading-none">×</button>
            </div>
            <form onSubmit={saveDriver} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">Driver full name
                <input className={inputClass} value={form.full_name} onChange={(event) => changeField("full_name", event.target.value)} placeholder="Enter driver's full name" maxLength={160} required />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">License plate number
                <input className={inputClass} value={form.plate_number} onChange={(event) => changeField("plate_number", event.target.value)} placeholder="e.g. AA-12345" maxLength={20} required />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">Driver's license number
                <input className={inputClass} value={form.license_number} onChange={(event) => changeField("license_number", event.target.value)} placeholder="Enter driver's license number" maxLength={50} required />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">Vehicle type
                <select className={inputClass} value={form.vehicle_type} onChange={(event) => changeField("vehicle_type", event.target.value)} required>
                  <option value="Private">Private</option><option value="Commercial">Commercial</option><option value="Taxi">Taxi</option><option value="Bus">Bus</option><option value="Motorcycle">Motorcycle</option><option value="Truck">Truck</option><option value="Government">Government</option><option value="Other">Other</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Phone number
                <input className={inputClass} type="tel" value={form.phone_number} onChange={(event) => changeField("phone_number", event.target.value)} placeholder="Enter phone number" maxLength={30} required />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2">
                <button type="button" onClick={resetForm} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60">{saving ? "Saving..." : editingId ? "Save changes" : "Add driver"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="driver-import-title" className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <form onSubmit={importDrivers}>
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Bulk registration</p>
                <h2 id="driver-import-title" className="mt-1 text-lg font-semibold text-slate-900">Import drivers from Excel</h2>
              </div>
              <div className="space-y-3 p-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Excel file
                  <input required type="file" accept=".xlsx" onChange={(event) => { setImportFile(event.currentTarget.files?.[0] ?? null); setImportError(""); }} className="mt-2 block w-full text-sm font-normal text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-50" />
                </label>
                {importFile && <p className="text-sm text-slate-600">Selected: <span className="font-medium text-slate-900">{importFile.name}</span></p>}
                <p className="text-xs text-slate-500">Use the template columns: Full Name, Plate Number, License Number, Vehicle Type, and Phone Number. Maximum 500 rows and 5 MB.</p>
                {importError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{importError}</p>}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button type="button" disabled={importBusy} onClick={() => { setShowImportDialog(false); setImportFile(null); setImportError(""); }} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={!importFile || importBusy} className="rounded-md bg-teal-800 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">{importBusy ? "Registering..." : "Register"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

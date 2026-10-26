"use client";

import { useEffect, useState } from "react";
import type { Vehicle } from "@/lib/vehicle-types";

type DocumentRecord = {
  id: number;
  document_type: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
};

type HistoryRecord = {
  id: number;
  action: string;
  details: string;
  created_at: string;
};

type VehicleForm = {
  plate: string;
  ownerName: string;
  make: string;
  model: string;
  type: string;
  status: Vehicle["status"];
};

const emptyForm: VehicleForm = {
  plate: "",
  ownerName: "",
  make: "",
  model: "",
  type: "Private",
  status: "Available",
};

async function responseMessage(response: Response) {
  const body = await response.json().catch(() => ({}));
  return typeof body.message === "string" ? body.message : "The request could not be completed.";
}

function formattedDetails(details: string) {
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

export default function VehicleManagement({
  vehicles,
  loading,
  onRefresh,
}: {
  vehicles: Vehicle[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [statusFilter, setStatusFilter] = useState<Vehicle["status"] | "All">("All");
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null);
  const [detailsTab, setDetailsTab] = useState<"Documents" | "History">("Documents");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [documentType, setDocumentType] = useState("Registration");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    if (!successToast) return;
    const timeout = window.setTimeout(() => setSuccessToast(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [successToast]);

  async function loadDetails(vehicleId: number) {
    setDetailsLoading(true);
    setError("");
    try {
      const [documentsResponse, historyResponse] = await Promise.all([
        fetch(`/api/vehicles/${vehicleId}/documents`, { cache: "no-store" }),
        fetch(`/api/vehicles/${vehicleId}/history`, { cache: "no-store" }),
      ]);
      if (!documentsResponse.ok) throw new Error(await responseMessage(documentsResponse));
      if (!historyResponse.ok) throw new Error(await responseMessage(historyResponse));
      const [documentRows, historyRows] = await Promise.all([
        documentsResponse.json() as Promise<DocumentRecord[]>,
        historyResponse.json() as Promise<HistoryRecord[]>,
      ]);
      setDocuments(documentRows);
      setHistory(historyRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load vehicle records.");
    } finally {
      setDetailsLoading(false);
    }
  }

  function openDetails(vehicle: Vehicle, tab: "Documents" | "History") {
    setDetailsVehicle(vehicle);
    setDetailsTab(tab);
    void loadDetails(vehicle.id);
  }

  function openEdit(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setForm({
      plate: vehicle.plate,
      ownerName: vehicle.owner_name,
      make: vehicle.make,
      model: vehicle.model,
      type: vehicle.type || "Private",
      status: vehicle.status,
    });
    setError("");
    setShowForm(true);
    setOpenActionMenu(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingVehicle(null);
    setForm(emptyForm);
  }

  async function saveVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const payload = {
      plate_number: form.plate.trim().toUpperCase(),
      owner_name: form.ownerName.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      vehicle_type: form.type,
      status: form.status,
    };

    try {
      const response = await fetch(
        editingVehicle ? `/api/vehicles/${editingVehicle.id}` : "/api/vehicles",
        {
          method: editingVehicle ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      await onRefresh();
      setMessage(`${payload.plate_number} ${editingVehicle ? "updated" : "registered"}.`);
      closeForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this vehicle.");
    } finally {
      setBusy(false);
    }
  }

  async function importVehicles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) {
      setImportError("Choose an Excel file first.");
      return;
    }

    setImportBusy(true);
    setImportError("");
    setMessage("");
    const body = new FormData();
    body.set("file", importFile);

    try {
      const response = await fetch("/api/vehicles/import", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const rowErrors = Array.isArray(result.errors) ? ` ${result.errors.join(" ")}` : "";
        const duplicates = Array.isArray(result.duplicates) ? ` ${result.duplicates.join(", ")}` : "";
        throw new Error(`${result.message ?? "Could not import vehicles."}${rowErrors}${duplicates}`);
      }
      await onRefresh();
      setShowImportDialog(false);
      setImportFile(null);
      setSuccessToast(result.message ?? "Vehicles imported successfully.");
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "Could not import vehicles.");
    } finally {
      setImportBusy(false);
    }
  }

  async function updateVehicleStatus(vehicle: Vehicle, status: Vehicle["status"]) {
    setOpenActionMenu(null);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate_number: vehicle.plate,
          owner_name: vehicle.owner_name,
          make: vehicle.make,
          model: vehicle.model,
          vehicle_type: vehicle.type,
          status,
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await onRefresh();
      setMessage(`${vehicle.plate} is now ${status.toLowerCase()}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update vehicle status.");
    }
  }

  async function archiveVehicle(vehicle: Vehicle) {
    setOpenActionMenu(null);
    if (!window.confirm(`Archive vehicle ${vehicle.plate}? Its history and documents will be kept.`)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response));
      await onRefresh();
      setMessage(`${vehicle.plate} was archived. Its history and documents were kept.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive this vehicle.");
    }
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailsVehicle || !documentFile) {
      setError("Choose a document file first.");
      return;
    }
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("file", documentFile);
    body.set("documentType", documentType);

    try {
      const response = await fetch(`/api/vehicles/${detailsVehicle.id}/documents`, {
        method: "POST",
        body,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setDocumentFile(null);
      event.currentTarget.reset();
      setMessage(`Document saved for ${detailsVehicle.plate}.`);
      await loadDetails(detailsVehicle.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload this document.");
    } finally {
      setBusy(false);
    }
  }

  const statusClasses: Record<Vehicle["status"], string> = {
    Available: "bg-emerald-100 text-emerald-800",
    "In Use": "bg-amber-100 text-amber-800",
    Maintenance: "bg-rose-100 text-rose-800",
    Inactive: "bg-slate-200 text-slate-700",
  };
  const statusFilters: Array<Vehicle["status"] | "All"> = [
    "All",
    "Available",
    "In Use",
    "Maintenance",
    "Inactive",
  ];
  const vehicleTypes = [...new Set(vehicles.map((vehicle) => vehicle.type).filter(Boolean))].sort();
  const normalizedSearch = vehicleSearch.trim().toLowerCase();
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch = !normalizedSearch ||
      vehicle.plate.toLowerCase().includes(normalizedSearch) ||
      vehicle.owner_name.toLowerCase().includes(normalizedSearch);
    const matchesType = typeFilter === "All types" || vehicle.type === typeFilter;
    const matchesStatus = statusFilter === "All" || vehicle.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Administration / Vehicles</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Vehicle Management</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/vehicles/import" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Download Excel Template
          </a>
          <button
            type="button"
            onClick={() => {
              setImportError("");
              setImportFile(null);
              setShowImportDialog(true);
            }}
            className="rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"
          >
            Import Excel
          </button>
          <button
            type="button"
            onClick={() => {
              setError("");
              setEditingVehicle(null);
              setForm(emptyForm);
              setShowForm(true);
            }}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            + Add Vehicle
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      {successToast && (
        <div role="status" aria-live="polite" className="fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-md bg-emerald-600 px-4 py-3 text-white shadow-lg">
          <svg aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0">
            <p className="font-semibold">Import successful</p>
            <p className="text-sm text-emerald-50">{successToast}</p>
          </div>
          <button type="button" onClick={() => setSuccessToast("")} aria-label="Dismiss success message" className="ml-2 text-xl leading-none text-emerald-50 hover:text-white">×</button>
        </div>
      )}

      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="vehicle-import-title" className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <form onSubmit={importVehicles}>
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 id="vehicle-import-title" className="text-lg font-semibold text-slate-900">Register Vehicles</h3>
              </div>
              <div className="space-y-4 p-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Excel File
                  <input
                    required
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => {
                      setImportFile(event.currentTarget.files?.[0] ?? null);
                      setImportError("");
                    }}
                    className="mt-2 block w-full text-sm font-normal text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                  />
                </label>
                {importFile && <p className="text-sm text-slate-500">Selected: {importFile.name}</p>}
                {importError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{importError}</p>}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  disabled={importBusy}
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportFile(null);
                    setImportError("");
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button type="submit" disabled={!importFile || importBusy} className="rounded-md bg-teal-700 px-5 py-2 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {importBusy ? "Registering..." : "Register"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-teal-700 px-6 py-5 text-white">
              <h3 id="vehicle-form-title" className="text-2xl font-bold">{editingVehicle ? "Update Vehicle" : "Add Vehicle"}</h3>
              <button type="button" onClick={closeForm} aria-label="Close vehicle form" className="text-3xl leading-none">×</button>
            </div>
            <form onSubmit={saveVehicle} className="grid gap-4 p-6 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Plate Number
                <input required value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Owner Name
                <input maxLength={160} value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Vehicle Type
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option>Private</option><option>Taxi</option><option>Bus</option><option>Truck</option><option>Motorcycle</option><option>Government</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Make
                <input required value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Model
                <input required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Vehicle["status"] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option>Available</option><option>In Use</option><option>Maintenance</option><option>Inactive</option>
                </select>
              </label>
              <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
                <button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700">Cancel</button>
                <button type="submit" disabled={busy} className="rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "Saving..." : editingVehicle ? "Update Vehicle" : "Save Vehicle"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="vehicle-record-title" className="my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm text-slate-500">{detailsVehicle.plate}</p>
                <h3 id="vehicle-record-title" className="text-2xl font-bold text-slate-900">Vehicle Records</h3>
              </div>
              <button type="button" onClick={() => setDetailsVehicle(null)} aria-label="Close vehicle records" className="text-3xl leading-none text-slate-500">×</button>
            </div>
            <div className="flex gap-2 border-b border-slate-200 px-6 pt-4">
              {(["Documents", "History"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setDetailsTab(tab)} className={`border-b-2 px-3 py-2 text-sm font-semibold ${detailsTab === tab ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500"}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="space-y-5 p-6">
              {detailsLoading ? <p className="text-sm text-slate-500">Loading records...</p> : detailsTab === "Documents" ? (
                <>
                  <form onSubmit={uploadDocument} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
                    <label className="text-sm font-medium text-slate-700">Document type
                      <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                        <option>Registration</option><option>Insurance</option><option>Inspection</option><option>Permit</option><option>Other</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">Scanned file
                      <input required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:font-medium" />
                    </label>
                    <button type="submit" disabled={busy || !documentFile} className="rounded-md bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Uploading..." : "Upload"}</button>
                    <p className="text-xs text-slate-500 sm:col-span-3">PDF, JPG, PNG, or WEBP, up to 10 MB.</p>
                  </form>
                  {documents.length ? <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {documents.map((document) => (
                      <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0"><p className="font-medium text-slate-900">{document.document_type}</p><p className="truncate text-sm text-slate-500">{document.original_filename} · {(document.size_bytes / 1024 / 1024).toFixed(2)} MB</p></div>
                        <a href={`/api/vehicle-documents/${document.id}`} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-teal-800 underline">Open</a>
                      </div>
                    ))}
                  </div> : <p className="text-sm text-slate-500">No documents saved for this vehicle yet.</p>}
                </>
              ) : history.length ? (
                <ol className="divide-y divide-slate-200">
                  {history.map((record) => (
                    <li key={record.id} className="py-4 first:pt-0">
                      <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-900">{record.action.replaceAll("_", " ")}</p><time className="text-sm text-slate-500">{new Date(record.created_at).toLocaleString()}</time></div>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600">{formattedDetails(record.details)}</pre>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-slate-500">No history recorded for this vehicle yet.</p>}
            </div>
          </section>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Registered Vehicles</h3></div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-6">
          <label className="min-w-56 flex-1">
            <span className="sr-only">Search by plate or owner name</span>
            <input
              type="search"
              value={vehicleSearch}
              onChange={(event) => setVehicleSearch(event.target.value)}
              placeholder="Search plate or owner name..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label>
            <span className="sr-only">Filter by vehicle type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-600"
            >
              <option>All types</option>
              {vehicleTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Filter by vehicle status" className="flex max-w-full flex-wrap rounded-md border border-slate-200 bg-slate-100 p-1">
            {statusFilters.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${statusFilter === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <p className="px-6 py-2 text-xs text-slate-500">Showing {filteredVehicles.length} of {vehicles.length} vehicles</p>
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50"><tr>
              {(["Plate", "Owner Name", "Type", "Make", "Model", "Status", "Actions"] as const).map((heading) => <th key={heading} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">Loading vehicles...</td></tr> : vehicles.length === 0 ? <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">No vehicles registered yet.</td></tr> : filteredVehicles.length === 0 ? <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">No vehicles match these filters.</td></tr> : filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{vehicle.plate}</td>
                  <td className="px-6 py-4 text-slate-700">{vehicle.owner_name || "-"}</td>
                  <td className="px-6 py-4 text-slate-700">{vehicle.type || "-"}</td>
                  <td className="px-6 py-4 text-slate-700">{vehicle.make}</td>
                  <td className="px-6 py-4 text-slate-700">{vehicle.model}</td>
                  <td className="px-6 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[vehicle.status] ?? "bg-slate-100 text-slate-700"}`}>{vehicle.status}</span></td>
                    <td className="px-6 py-4"><div className="relative inline-block">
                    <button type="button" aria-expanded={openActionMenu === vehicle.id} onClick={() => setOpenActionMenu(openActionMenu === vehicle.id ? null : vehicle.id)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Actions ▾</button>
                    {openActionMenu === vehicle.id && <div className="absolute right-0 z-20 mt-2 min-w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                      <button type="button" onClick={() => openEdit(vehicle)} className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50">Edit / Update</button>
                      <button type="button" onClick={() => void archiveVehicle(vehicle)} className="block w-full px-4 py-3 text-left text-sm text-rose-700 hover:bg-rose-50">Archive</button>
                      <button type="button" onClick={() => void updateVehicleStatus(vehicle, vehicle.status === "Inactive" ? "Available" : "Inactive")} className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50">{vehicle.status === "Inactive" ? "Activate" : "Inactive"}</button>
                      <button type="button" onClick={() => { setOpenActionMenu(null); openDetails(vehicle, "History"); }} className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50">View History</button>
                      <button type="button" onClick={() => { setOpenActionMenu(null); openDetails(vehicle, "Documents"); }} className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50">Full Document Information</button>
                    </div>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
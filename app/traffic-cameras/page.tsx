
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import TrafficSidebar from "@/app/traffic-sidebar";

type Camera = {
  id: number;
  camera_code: string;
  camera_name: string;
  location: string;
  road_name: string | null;
  ip_address: string | null;
  camera_type: string;
  status: string;
};

type CameraForm = {
  camera_code: string;
  camera_name: string;
  location: string;
  road_name: string;
  ip_address: string;
  camera_type: string;
  status: string;
};

const emptyForm: CameraForm = {
  camera_code: "",
  camera_name: "",
  location: "",
  road_name: "",
  ip_address: "",
  camera_type: "ANPR",
  status: "OFFLINE",
};

export default function TrafficCamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState<CameraForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCameras = useCallback(async (term: string) => {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();

      if (term.trim()) {
        query.set("search", term.trim());
      }

      const response = await fetch(
        `/api/cameras${query.size ? `?${query.toString()}` : ""}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load cameras.");
      }

      setCameras(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load cameras."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCameras(search);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search, loadCameras]);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
    setShowForm(true);
  }

  function openEditForm(camera: Camera) {
    setEditingId(camera.id);

    setForm({
      camera_code: camera.camera_code,
      camera_name: camera.camera_name,
      location: camera.location,
      road_name: camera.road_name ?? "",
      ip_address: camera.ip_address ?? "",
      camera_type: camera.camera_type,
      status: camera.status,
    });

    setMessage("");
    setError("");
    setShowForm(true);
  }

  function updateField(
    field: keyof CameraForm,
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        editingId !== null
          ? `/api/cameras/${editingId}`
          : "/api/cameras",
        {
          method: editingId !== null ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save camera.");
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      setMessage(data.message || "Camera saved successfully.");

      await loadCameras(search);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save camera."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCamera(camera: Camera) {
    const confirmed = window.confirm(
      `Delete camera "${camera.camera_name}" (${camera.camera_code})?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/cameras/${camera.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not delete camera.");
      }

      setMessage(data.message || "Camera deleted successfully.");
      await loadCameras(search);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete camera."
      );
    }
  }

  async function changeStatus(camera: Camera, status: string) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/cameras/${camera.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...camera, status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not update status.");
      }

      setMessage(`Camera status changed to ${status}.`);
      await loadCameras(search);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update status."
      );
    }
  }

  const onlineCount = cameras.filter(
    (camera) => camera.status === "ONLINE"
  ).length;

  const offlineCount = cameras.filter(
    (camera) => camera.status === "OFFLINE"
  ).length;

  const maintenanceCount = cameras.filter(
    (camera) => camera.status === "MAINTENANCE"
  ).length;
  const cameraTypes = [...new Set(cameras.map((camera) => camera.camera_type))].sort();
  const statusFilters = ["ALL", "ONLINE", "OFFLINE", "MAINTENANCE"];
  const filteredCameras = cameras.filter((camera) =>
    (typeFilter === "ALL" || camera.camera_type === typeFilter) &&
    (statusFilter === "ALL" || camera.status === statusFilter)
  );

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <TrafficSidebar activeItem="Traffic Cameras" />
      <section className="min-w-0 flex-1 p-6 md:p-10">
      <main className="flex min-h-[calc(100vh-8rem)] flex-col space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Administration / Traffic Cameras</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Traffic Cameras</h1>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
        >
          + Add Camera
        </button>
      </header>

      {message && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total cameras" value={cameras.length} />
        <StatCard title="Online" value={onlineCount} />
        <StatCard title="Offline" value={offlineCount} />
        <StatCard title="Maintenance" value={maintenanceCount} />
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="camera-form-title" className="my-auto w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-teal-700 px-6 py-5 text-white">
              <h2 id="camera-form-title" className="text-2xl font-bold">
                {editingId !== null ? "Update Camera" : "Register Camera"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close camera form"
                className="text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 p-6 sm:grid-cols-2">
              <FormField label="Camera Code *">
                <input
                  required
                  maxLength={50}
                  value={form.camera_code}
                  onChange={(e) => updateField("camera_code", e.target.value)}
                  placeholder="CAM-001"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Camera Name *">
                <input
                  required
                  maxLength={150}
                  value={form.camera_name}
                  onChange={(e) => updateField("camera_name", e.target.value)}
                  placeholder="Bole Intersection Camera"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Location *">
                <input
                  required
                  maxLength={200}
                  value={form.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="Bole, Addis Ababa"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Road / Intersection">
                <input
                  maxLength={150}
                  value={form.road_name}
                  onChange={(e) => updateField("road_name", e.target.value)}
                  placeholder="Bole Road"
                  className={inputClass}
                />
              </FormField>

              <FormField label="IP Address (optional)">
                <input
                  maxLength={100}
                  value={form.ip_address}
                  onChange={(e) => updateField("ip_address", e.target.value)}
                  placeholder="192.168.1.100"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Camera Type">
                <select
                  value={form.camera_type}
                  onChange={(e) => updateField("camera_type", e.target.value)}
                  className={inputClass}
                >
                  <option value="ANPR">ANPR / Plate Recognition</option>
                  <option value="CCTV">CCTV</option>
                  <option value="RED_LIGHT">Red Light Detection</option>
                  <option value="SPEED">Speed Detection</option>
                  <option value="OTHER">Other</option>
                </select>
              </FormField>

              <FormField label="Status">
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className={inputClass}
                >
                  <option value="OFFLINE">Offline</option>
                  <option value="ONLINE">Online</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </FormField>

              <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Update Camera"
                      : "Save Camera"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Registered Cameras</h2>
            <label className="min-w-56 flex-1 sm:max-w-xs">
              <span className="sr-only">Search cameras</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cameras..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label>
              <span className="sr-only">Filter by camera type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-600"
              >
                <option value="ALL">All types</option>
                {cameraTypes.map((type) => (
                  <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <div role="group" aria-label="Filter by camera status" className="flex max-w-full flex-wrap rounded-md border border-slate-200 bg-slate-100 p-1">
              {statusFilters.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${statusFilter === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                {["Camera", "Location", "Type", "IP Address", "Status", "Change Status", "Actions"].map((heading) => (
                  <th key={heading} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                    Loading cameras...
                  </td>
                </tr>
              ) : cameras.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                    No cameras found. Select Add Camera to register one.
                  </td>
                </tr>
              ) : filteredCameras.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                    No cameras match these filters.
                  </td>
                </tr>
              ) : (
                filteredCameras.map((camera) => (
                  <tr key={camera.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{camera.camera_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {camera.camera_code}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-slate-700">
                      <p>{camera.location}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {camera.road_name || "No road specified"}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-slate-700">
                      {camera.camera_type.replaceAll("_", " ")}
                    </td>

                    <td className="px-6 py-4 text-slate-700">
                      {camera.ip_address || "—"}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={camera.status} />
                    </td>

                    <td className="px-6 py-4">
                      <select
                        aria-label={`Change status for ${camera.camera_name}`}
                        value={camera.status}
                        onChange={(e) =>
                          void changeStatus(camera, e.target.value)
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-teal-600"
                      >
                        <option value="ONLINE">Online</option>
                        <option value="OFFLINE">Offline</option>
                        <option value="MAINTENANCE">Maintenance</option>
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(camera)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteCamera(camera)}
                          className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
          Showing {filteredCameras.length} camera{filteredCameras.length === 1 ? "" : "s"}
        </div>
      </section>
      </main>
      </section>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ONLINE: "bg-emerald-100 text-emerald-800",
    OFFLINE: "bg-rose-100 text-rose-800",
    MAINTENANCE: "bg-amber-100 text-amber-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}


"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import VehicleManagement from "@/app/vehicles/vehicle-management";
import TrafficSidebar from "@/app/traffic-sidebar";
import type { Vehicle } from "@/lib/vehicle-types";

type DashboardData = {
  stats: {
    registeredVehicles: number;
    activeAgreements: number;
    trafficCameras: number;
    recordedViolations: number;
    issuedPenalties: number;
  };
  vehicleStatuses: Array<{ status: string; count: number }>;
  recentEvents: Array<{
    id: number;
    plate_number: string | null;
    event_type: string;
    review_status: string;
    confidence: number | null;
    detected_at: string;
    owner_name: string | null;
    make: string | null;
    model: string | null;
  }>;
};

const initialVehicleRows = [
  { plate: "AA-2045", type: "Private", make: "Toyota", model: "Corolla", status: "Available" },
  { plate: "CA-9814", type: "Taxi", make: "Honda", model: "Civic", status: "In Use" },
  { plate: "KZ-4401", type: "Bus", make: "Ford", model: "Transit", status: "Maintenance" },
  { plate: "TX-9987", type: "Private", make: "BMW", model: "X5", status: "Available" },
];

async function fetchVehicles(): Promise<Vehicle[]> {
  const response = await fetch("/api/vehicles", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load vehicles from the database.");
  return response.json();
}

async function fetchDashboard(): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load dashboard metrics from the database.");
  return response.json();
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [vehicleRows, setVehicleRows] = useState<(typeof initialVehicleRows)[number][]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState("");
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [editingPlate, setEditingPlate] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState("");
  const [form, setForm] = useState({
    plate: "",
    make: "",
    model: "",
    type: "Private",
    status: "Available",
  });

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab) {
      const matchingTab = ["Dashboard", "Vehicles", "Violations", "Reports"]
        .find((item) => item === requestedTab);
      if (matchingTab) setActiveTab(matchingTab);
    }

    let cancelled = false;
    fetchVehicles()
      .then((rows) => {
        if (!cancelled) setVehicleRows(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) setVehiclesError(error instanceof Error ? error.message : "Could not load vehicles.");
      })
      .finally(() => {
        if (!cancelled) setVehiclesLoading(false);
      });
    fetchDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setDashboardError(error instanceof Error ? error.message : "Could not load dashboard metrics.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshVehicles() {
    setVehiclesLoading(true);
    setVehiclesError("");
    try {
      setVehicleRows(await fetchVehicles());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load vehicles.";
      setVehiclesError(message);
      throw error;
    } finally {
      setVehiclesLoading(false);
    }
    try {
      setDashboard(await fetchDashboard());
      setDashboardError("");
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not refresh dashboard metrics.");
    }
  }

  function handleAddVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.plate.trim() || !form.make.trim() || !form.model.trim()) {
      return;
    }

    const newVehicle = {
      plate: form.plate.trim().toUpperCase(),
      type: form.type,
      make: form.make.trim(),
      model: form.model.trim(),
      status: form.status,
    };

    if (editingPlate) {
      setVehicleRows((current) =>
        current.map((vehicle) =>
          vehicle.plate === editingPlate ? { ...vehicle, ...newVehicle } : vehicle
        )
      );
      setInfoMessage(`Updated vehicle ${newVehicle.plate}.`);
    } else {
      setVehicleRows((current) => [newVehicle, ...current]);
      setInfoMessage(`Added new vehicle ${newVehicle.plate}.`);
    }

    setForm({ plate: "", make: "", model: "", type: "Private", status: "Available" });
    setEditingPlate(null);
    setShowAddVehicle(false);
    setOpenActionMenu(null);
  }

  function handleVehicleAction(action: string, vehicle: (typeof initialVehicleRows)[number]) {
    setOpenActionMenu(null);

    if (action === "Edit/Update") {
      setForm({
        plate: vehicle.plate,
        make: vehicle.make,
        model: vehicle.model,
        type: vehicle.type,
        status: vehicle.status,
      });
      setEditingPlate(vehicle.plate);
      setShowAddVehicle(true);
      return;
    }

    if (action === "Delete") {
      setVehicleRows((current) => current.filter((item) => item.plate !== vehicle.plate));
      setInfoMessage(`Deleted vehicle ${vehicle.plate}.`);
      return;
    }

    if (action === "Activate") {
      setVehicleRows((current) =>
        current.map((item) =>
          item.plate === vehicle.plate ? { ...item, status: "Available" } : item
        )
      );
      setInfoMessage(`Activated vehicle ${vehicle.plate}.`);
      return;
    }

    if (action === "Inactive") {
      setVehicleRows((current) =>
        current.map((item) =>
          item.plate === vehicle.plate ? { ...item, status: "Inactive" } : item
        )
      );
      setInfoMessage(`Marked vehicle ${vehicle.plate} inactive.`);
      return;
    }

    if (action === "View History") {
      setInfoMessage(`Viewing history for ${vehicle.plate}.`);
      return;
    }

    if (action === "Full Document Information") {
      setInfoMessage(`Showing full document information for ${vehicle.plate}.`);
    }
  }

  const renderContent = () => {
    if (activeTab === "Vehicles") {
      return (
        <>
          {vehiclesError && <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{vehiclesError}</p>}
          <VehicleManagement vehicles={vehicleRows as Vehicle[]} loading={vehiclesLoading} onRefresh={refreshVehicles} />
        </>
      );
    }

    if (activeTab === "Dashboard") {
      const dashboardCards = [
        { title: "Registered vehicles", value: dashboard?.stats.registeredVehicles, detail: "In the fleet", accent: "border-l-teal-600", href: "/?tab=Vehicles" },
        { title: "Active agreements", value: dashboard?.stats.activeAgreements, detail: "Vehicle and driver contracts", accent: "border-l-blue-600", href: "/agreements" },
        { title: "Traffic cameras", value: dashboard?.stats.trafficCameras, detail: "Registered devices", accent: "border-l-amber-500", href: "/traffic-cameras" },
        { title: "Recorded violations", value: dashboard?.stats.recordedViolations, detail: "Traffic detection events", accent: "border-l-rose-600", href: "#recent-events" },
        { title: "Issued penalties", value: dashboard?.stats.issuedPenalties, detail: "Confirmed penalties", accent: "border-l-emerald-600", href: "/violations" },
      ];
      const vehicleStatusColors: Record<string, string> = {
        Available: "bg-emerald-500",
        "In Use": "bg-blue-500",
        Maintenance: "bg-amber-500",
        Inactive: "bg-slate-400",
      };
      const statusTotal = dashboard?.vehicleStatuses.reduce((total, item) => total + item.count, 0) ?? 0;

      return (
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Administration / Overview</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">Traffic dashboard</h2>
              <p className="mt-1 text-sm text-slate-500">Live snapshot of vehicles, agreements, cameras, and recorded events.</p>
            </div>
            <span className="text-xs font-medium text-slate-500">Data from connected records</span>
          </header>

          {dashboardError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{dashboardError}</p>}

          <div className="row g-3">
            {dashboardCards.map((card) => (
              <div key={card.title} className="col-12 col-sm-6 col-xxl">
                <Link href={card.href} className={`block h-full rounded-lg border border-slate-200 border-l-4 ${card.accent} bg-white p-4 text-decoration-none shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}>
                  <p className="text-sm font-medium text-slate-500">{card.title}</p>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-slate-950">{card.value === undefined ? "—" : card.value.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
                </Link>
              </div>
            ))}
          </div>

          <div className="row g-3">
            <section className="col-12 col-xl-5">
              <div className="h-full rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-base font-semibold text-slate-900">Vehicle availability</h3><p className="mt-1 text-sm text-slate-500">Current registration status</p></div>
                  <span className="text-xl font-bold tabular-nums text-slate-900">{statusTotal.toLocaleString()}</span>
                </div>
                <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-label="Vehicle availability breakdown">
                  {dashboard?.vehicleStatuses.map((item) => (
                    <span key={item.status} title={`${item.status}: ${item.count}`} className={vehicleStatusColors[item.status] ?? "bg-slate-400"} style={{ width: statusTotal ? `${(item.count / statusTotal) * 100}%` : "0%" }} />
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                  {(dashboard?.vehicleStatuses ?? []).map((item) => (
                    <div key={item.status} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-slate-600"><span className={`h-2 w-2 shrink-0 rounded-full ${vehicleStatusColors[item.status] ?? "bg-slate-400"}`} />{item.status}</span>
                      <span className="font-semibold tabular-nums text-slate-900">{item.count}</span>
                    </div>
                  ))}
                  {!dashboard && <p className="col-span-2 text-sm text-slate-500">Loading vehicle status...</p>}
                </div>
              </div>
            </section>

            <section id="recent-events" className="col-12 col-xl-7">
              <div className="h-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div><h3 className="text-base font-semibold text-slate-900">Recent traffic events</h3><p className="mt-1 text-sm text-slate-500">Latest plate detections from registered cameras</p></div>
                  <Link href="/traffic-cameras" className="text-sm font-semibold text-teal-800 hover:text-teal-950">Cameras</Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Plate / vehicle</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Review</th><th className="px-4 py-3">Detected</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard?.recentEvents.length ? dashboard.recentEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3"><p className="font-mono font-semibold text-slate-800">{event.plate_number || "Unknown"}</p><p className="mt-0.5 text-xs text-slate-500">{[event.owner_name, event.make, event.model].filter(Boolean).join(" · ") || "Unregistered vehicle"}</p></td>
                          <td className="px-4 py-3 text-slate-700">{event.event_type.replaceAll("_", " ")}</td>
                          <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{event.review_status.replaceAll("_", " ")}</span></td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Intl.DateTimeFormat("en", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(event.detected_at))}</td>
                        </tr>
                      )) : <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">{dashboard ? "No traffic events recorded yet." : "Loading recent events..."}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>
      );
    }

    if (activeTab === "Vehicles") {
      return (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Administration / Vehicles</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Vehicle Management</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddVehicle((value) => !value)}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              + Add Vehicle
            </button>
          </div>

          {showAddVehicle && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
              <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between bg-teal-600 px-6 py-5 text-white">
                  <h3 className="text-3xl font-bold">{editingPlate ? "Update Vehicle" : "Add Vehicle"}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddVehicle(false);
                      setEditingPlate(null);
                      setForm({ plate: "", make: "", model: "", type: "Private", status: "Available" });
                    }}
                    className="text-3xl font-light leading-none hover:opacity-80"
                    aria-label="Close add vehicle form"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleAddVehicle} className="bg-white p-6 md:p-8">
                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
                        Plate Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.plate}
                        onChange={(event) => setForm({ ...form, plate: event.target.value })}
                        placeholder="AA-12345"
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
                        Vehicle Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.type}
                        onChange={(event) => setForm({ ...form, type: event.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      >
                        <option value="Private">Private</option>
                        <option value="Taxi">Taxi</option>
                        <option value="Bus">Bus</option>
                        <option value="Truck">Truck</option>
                        <option value="Motorcycle">Motorcycle</option>
                        <option value="Government">Government</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
                        Make <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.make}
                        onChange={(event) => setForm({ ...form, make: event.target.value })}
                        placeholder="Toyota"
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
                        Model <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.model}
                        onChange={(event) => setForm({ ...form, model: event.target.value })}
                        placeholder="Corolla"
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
                        Status
                      </label>
                      <select
                        value={form.status}
                        onChange={(event) => setForm({ ...form, status: event.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      >
                        <option value="Available">Available</option>
                        <option value="In Use">In Use</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-teal-700"
                      >
                        {editingPlate ? "Update Vehicle" : "Save Vehicle"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {infoMessage}
            </div>
          )}

          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Registered Vehicles</h3>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Plate</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Make</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Model</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {vehicleRows.map((vehicle) => (
                    <tr key={`${vehicle.plate}-${vehicle.model}`} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{vehicle.plate}</td>
                      <td className="px-6 py-4 text-slate-700">{vehicle.type}</td>
                      <td className="px-6 py-4 text-slate-700">{vehicle.make}</td>
                      <td className="px-6 py-4 text-slate-700">{vehicle.model}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          vehicle.status === "Available"
                            ? "bg-emerald-100 text-emerald-700"
                            : vehicle.status === "In Use"
                              ? "bg-amber-100 text-amber-700"
                              : vehicle.status === "Inactive"
                                ? "bg-rose-200 text-rose-900"
                                : "bg-rose-100 text-rose-700"
                        }`}>
                          {vehicle.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() => setOpenActionMenu(openActionMenu === vehicle.plate ? null : vehicle.plate)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            Actions ▾
                          </button>

                          {openActionMenu === vehicle.plate && (
                            <div className="absolute right-0 z-10 mt-2 min-w-56 rounded-lg border border-slate-200 bg-white shadow-xl">
                              {[
                                "Edit/Update",
                                "Delete",
                                vehicle.status === "Inactive" ? "Activate" : "Inactive",
                                "View History",
                                "Full Document Information",
                              ].map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => handleVehicleAction(action, vehicle)}
                                  className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-center gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-600">
              <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
                Previous
              </button>
              <button type="button" className="rounded-lg bg-teal-600 px-3 py-2 font-semibold text-white">
                1
              </button>
              <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
                2
              </button>
              <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
                3
              </button>
              <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
                Next
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "Traffic Cameras") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900">Traffic Cameras</h2>
          <p className="mt-3 text-slate-600">Camera feeds and monitoring status.</p>
        </div>
      );
    }

    if (activeTab === "Violations") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900">Violations</h2>
          <p className="mt-3 text-slate-600">Traffic offenses and violation reports.</p>
        </div>
      );
    }

    if (activeTab === "Reports") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900">Reports</h2>
          <p className="mt-3 text-slate-600">Analytics and operational summaries.</p>
        </div>
      );
    }

    return null;
  };

  return (
    <main className="flex min-h-screen bg-slate-100 text-slate-800">
      <TrafficSidebar activeItem={activeTab} onTabSelect={setActiveTab} />

      <section className="min-w-0 flex-1 p-6 md:p-10">
        {renderContent()}
      </section>
    </main>
  );
}

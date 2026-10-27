"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TrafficSidebar from "@/app/traffic-sidebar";
import VehicleManagement from "@/app/vehicles/vehicle-management";
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

function formatDetectedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [vehiclesError, setVehiclesError] = useState("");

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "Vehicles") setActiveTab(requestedTab);

    let cancelled = false;
    fetchVehicles()
      .then((rows) => {
        if (!cancelled) setVehicles(rows);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setVehiclesError(cause instanceof Error ? cause.message : "Could not load vehicles.");
      })
      .finally(() => {
        if (!cancelled) setVehiclesLoading(false);
      });
    fetchDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setDashboardError(cause instanceof Error ? cause.message : "Could not load dashboard data.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshVehicles() {
    setVehiclesLoading(true);
    setVehiclesError("");
    try {
      setVehicles(await fetchVehicles());
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load vehicles.";
      setVehiclesError(message);
      throw cause;
    } finally {
      setVehiclesLoading(false);
    }

    try {
      setDashboard(await fetchDashboard());
      setDashboardError("");
    } catch (cause) {
      setDashboardError(cause instanceof Error ? cause.message : "Could not refresh dashboard data.");
    }
  }

  const statusColors: Record<string, string> = {
    Available: "bg-emerald-500",
    "In Use": "bg-blue-500",
    Maintenance: "bg-amber-500",
    Inactive: "bg-slate-400",
  };

  const totalVehicleStatuses = dashboard?.vehicleStatuses.reduce((total, item) => total + item.count, 0) ?? 0;
  const cards = dashboard ? [
    { title: "Registered vehicles", value: dashboard.stats.registeredVehicles, detail: "In the fleet", href: "/?tab=Vehicles", accent: "border-l-teal-600" },
    { title: "Active agreements", value: dashboard.stats.activeAgreements, detail: "Vehicle and driver contracts", href: "/agreements", accent: "border-l-blue-600" },
    { title: "Traffic cameras", value: dashboard.stats.trafficCameras, detail: "Registered devices", href: "/traffic-cameras", accent: "border-l-amber-500" },
    { title: "Recorded violations", value: dashboard.stats.recordedViolations, detail: "Traffic detection events", href: "/violations", accent: "border-l-rose-600" },
    { title: "Issued penalties", value: dashboard.stats.issuedPenalties, detail: "Confirmed penalties", href: "/payments", accent: "border-l-emerald-600" },
  ] : [];

  return (
    <main className="flex min-h-screen bg-slate-100 text-slate-800">
      <TrafficSidebar activeItem={activeTab} onTabSelect={setActiveTab} />
      <section className="min-w-0 flex-1 p-5 sm:p-7 xl:p-9">
        {activeTab === "Vehicles" ? (
          <div className="mx-auto w-full max-w-7xl">
            {vehiclesError && <p role="alert" className="mb-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{vehiclesError}</p>}
            <VehicleManagement vehicles={vehicles} loading={vehiclesLoading} onRefresh={refreshVehicles} />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[1600px] space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Administration / Overview</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-950">Traffic dashboard</h1>
                <p className="mt-1 text-sm text-slate-500">A live view of the fleet and traffic activity.</p>
              </div>
              <Link href="/agreements" className="rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-teal-900">
                View agreements
              </Link>
            </header>

            {dashboardError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{dashboardError}</p>}

            <div className="row g-3">
              {cards.length ? cards.map((card) => (
                <div key={card.title} className="col-12 col-sm-6 col-xl-4 col-xxl">
                  <Link href={card.href} className={`block h-full rounded-lg border border-slate-200 border-l-4 ${card.accent} bg-white p-4 text-slate-800 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}>
                    <p className="text-sm font-medium text-slate-500">{card.title}</p>
                    <p className="mt-3 text-3xl font-bold tabular-nums text-slate-950">{card.value.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
                  </Link>
                </div>
              )) : Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="col-12 col-sm-6 col-xl-4 col-xxl">
                  <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white" />
                </div>
              ))}
            </div>

            <div className="row g-3">
              <section className="col-12 col-xl-5">
                <div className="h-full rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div><h2 className="text-base font-semibold text-slate-900">Vehicle availability</h2><p className="mt-1 text-sm text-slate-500">Current registration status</p></div>
                    <span className="text-xl font-bold tabular-nums text-slate-900">{totalVehicleStatuses.toLocaleString()}</span>
                  </div>
                  <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-label="Vehicle availability breakdown">
                    {dashboard?.vehicleStatuses.map((item) => <span key={item.status} title={`${item.status}: ${item.count}`} className={statusColors[item.status] ?? "bg-slate-400"} style={{ width: totalVehicleStatuses ? `${(item.count / totalVehicleStatuses) * 100}%` : "0%" }} />)}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                    {(dashboard?.vehicleStatuses ?? []).map((item) => (
                      <div key={item.status} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-slate-600"><span className={`h-2 w-2 shrink-0 rounded-full ${statusColors[item.status] ?? "bg-slate-400"}`} />{item.status}</span>
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
                    <div><h2 className="text-base font-semibold text-slate-900">Recent traffic events</h2><p className="mt-1 text-sm text-slate-500">Latest plate detections from registered cameras</p></div>
                    <Link href="/traffic-cameras" className="text-sm font-semibold text-teal-800 no-underline hover:text-teal-950">Cameras</Link>
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
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDetectedAt(event.detected_at)}</td>
                          </tr>
                        )) : <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">{dashboard ? "No traffic events recorded yet." : "Loading recent events..."}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
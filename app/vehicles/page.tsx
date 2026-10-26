
"use client";

import Link from "next/link";
import { useState } from "react";

type Vehicle = {
  id: number;
  plate: string;
  make: string;
  model: string;
  type: string;
  year: number;
  status: "Available" | "In Use" | "Maintenance";
};

const initialVehicles: Vehicle[] = [
  {
    id: 1,
    plate: "AA-2045",
    make: "Toyota",
    model: "Corolla",
    type: "Private",
    year: 2022,
    status: "Available",
  },
  {
    id: 2,
    plate: "CA-9814",
    make: "Honda",
    model: "Civic",
    type: "Taxi",
    year: 2021,
    status: "In Use",
  },
  {
    id: 3,
    plate: "KZ-4401",
    make: "Ford",
    model: "Transit",
    type: "Bus",
    year: 2020,
    status: "Maintenance",
  },
  {
    id: 4,
    plate: "TX-9987",
    make: "BMW",
    model: "X5",
    type: "Private",
    year: 2023,
    status: "Available",
  },
];

const emptyForm = {
  plate: "",
  make: "",
  model: "",
  type: "Private",
  year: "",
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.plate || !form.make || !form.model) {
      setMessage("Please complete the required vehicle details.");
      return;
    }

    const newVehicle: Vehicle = {
      id: Date.now(),
      plate: form.plate,
      make: form.make,
      model: form.model,
      type: form.type,
      year: Number(form.year) || new Date().getFullYear(),
      status: "Available",
    };

    setVehicles((current) => [newVehicle, ...current]);
    setForm(emptyForm);
    setShowAddForm(false);
    setMessage(`${newVehicle.plate} was added successfully.`);
  }

  const stats = [
    { label: "Total Vehicles", value: vehicles.length },
    { label: "Available", value: vehicles.filter((v) => v.status === "Available").length },
    { label: "In Use", value: vehicles.filter((v) => v.status === "In Use").length },
    { label: "Maintenance", value: vehicles.filter((v) => v.status === "Maintenance").length },
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm font-medium text-blue-700 hover:underline">
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Vehicle Fleet
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((value) => !value)}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            + Add Vehicle
          </button>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {showAddForm && (
          <div className="mb-8 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Add a New Vehicle</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Plate Number *</label>
                <input
                  name="plate"
                  value={form.plate}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="e.g. AA-12345"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Make *</label>
                <input
                  name="make"
                  value={form.make}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="Toyota"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Model *</label>
                <input
                  name="model"
                  value={form.model}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="Corolla"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
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
                <label className="mb-2 block text-sm font-medium text-slate-700">Year</label>
                <input
                  name="year"
                  type="number"
                  value={form.year}
                  onChange={handleChange}
                  min="1900"
                  max="2100"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="2024"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
                <p className="text-sm text-slate-600">{message}</p>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-slate-900">Registered Vehicles</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {vehicles.length} active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Year</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-bold text-white">
                          {vehicle.make.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <p className="font-semibold text-slate-900">{vehicle.make} {vehicle.model}</p>
                          <p className="text-sm text-slate-500">{vehicle.plate}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">{vehicle.type}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{vehicle.year}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          vehicle.status === "Available"
                            ? "bg-emerald-100 text-emerald-700"
                            : vehicle.status === "In Use"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {vehicle.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

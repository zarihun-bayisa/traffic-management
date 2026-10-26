"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import TrafficSidebar from "@/app/traffic-sidebar";

type ViolationType = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  active: number;
};

type RuleForm = {
  name: string;
  description: string;
  amount: string;
  currency: string;
};

const emptyRuleForm: RuleForm = {
  name: "",
  description: "",
  amount: "",
  currency: "ETB",
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

export default function ViolationsPage() {
  const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRuleForm);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadManagementData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const typesResponse = await fetch("/api/violation-types", { cache: "no-store" });
      const types = await readResponse(typesResponse) as ViolationType[];
      setViolationTypes(types);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load violation types.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadManagementData();
  }, [loadManagementData]);

  async function createViolationType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create-rule");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/violation-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ruleForm, amount: Number(ruleForm.amount) }),
      });
      const result = await readResponse(response);
      setRuleForm(emptyRuleForm);
      setMessage(result.message ?? "Violation type created.");
      await loadManagementData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create violation type.");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <TrafficSidebar activeItem="Violations" />
      <section className="min-w-0 flex-1 p-6 md:p-10">
        <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-7xl flex-col gap-8">
          <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Administration / Violations</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Violation rules</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Set up the violation types and fine amounts used by traffic enforcement.</p>
            </div>
            <div className="flex items-baseline gap-2 border-l-2 border-teal-700 pl-4">
              <span className="text-2xl font-bold tabular-nums text-slate-900">{violationTypes.length}</span>
              <span className="text-sm text-slate-500">configured {violationTypes.length === 1 ? "type" : "types"}</span>
            </div>
          </header>

          {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          {message && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(290px,0.8fr)_minmax(0,1.7fr)]">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-800">New rule</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Add violation type</h2>
                <p className="mt-1 text-sm text-slate-500">Enter the official name and fine amount.</p>
              </div>
              <form onSubmit={createViolationType} className="space-y-4 p-5">
                <label className="block text-sm font-semibold text-slate-700">Violation name
                  <input required maxLength={150} value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100" placeholder="Speeding" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Description
                  <textarea rows={3} maxLength={500} value={ruleForm.description} onChange={(event) => setRuleForm({ ...ruleForm, description: event.target.value })} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100" placeholder="Optional details for this violation" />
                </label>
                <div className="grid grid-cols-[1fr_92px] gap-3">
                  <label className="block text-sm font-semibold text-slate-700">Fine amount
                    <input required type="number" min="0.01" max="99999999.99" step="0.01" value={ruleForm.amount} onChange={(event) => setRuleForm({ ...ruleForm, amount: event.target.value })} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal tabular-nums outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100" placeholder="500.00" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Currency
                    <input required minLength={3} maxLength={3} value={ruleForm.currency} onChange={(event) => setRuleForm({ ...ruleForm, currency: event.target.value.toUpperCase() })} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal uppercase outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
                  </label>
                </div>
                <button type="submit" disabled={busyAction === "create-rule"} className="w-full rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60">
                  {busyAction === "create-rule" ? "Creating..." : "Create violation type"}
                </button>
              </form>
            </section>

            <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Rule catalog</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Configured violations</h2>
                </div>
                <span className="text-sm tabular-nums text-slate-500">{violationTypes.length} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50"><tr>
                    {(["Violation", "Details", "Fine amount"] as const).map((heading) => <th key={heading} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-200">
                    {violationTypes.length === 0 ? (
                      <tr><td colSpan={3} className="px-5 py-12 text-center">
                        <p className="font-medium text-slate-800">{loading ? "Loading rules..." : "No violation types yet"}</p>
                        <p className="mt-1 text-sm text-slate-500">Created types will appear here.</p>
                      </td></tr>
                    ) : violationTypes.map((type) => (
                      <tr key={type.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{type.name}</p>
                          <p className="mt-1 font-mono text-xs text-slate-400">{type.code}</p>
                        </td>
                        <td className="max-w-xs px-5 py-4 text-sm text-slate-600">{type.description || <span className="text-slate-400">No details</span>}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-900">{formatAmount(type.amount, type.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">Amounts are saved as entered and can be used by enforcement rules later.</div>
            </section>
          </div>

        </main>
      </section>
    </div>
  );
}
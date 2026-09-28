"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePayrollRuleAction } from "@/app/actions/rules-actions";
import { PayrollRuleData } from "@/services/rules.service";
import { format } from "date-fns";
import {
  Sliders,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Banknote,
  Calendar,
  History,
} from "lucide-react";

interface RulesFormProps {
  currentRule: PayrollRuleData;
  history: Array<PayrollRuleData & { createdAt: Date }>;
}

export function RulesForm({ currentRule, history }: RulesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await savePayrollRuleAction(formData);
      if (res.success) {
        setMessage({ type: "success", text: "Payroll rules successfully updated and activated!" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error || "Failed to update rules." });
      }
    });
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center space-x-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Configuration Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Active Statutory & Factory Rules</h3>
            <p className="text-xs text-slate-500">
              Changes will apply to future attendance processing and unlocked monthly payroll calculations.
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? "Saving..." : "Save & Activate Rules"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overtime Multiplier */}
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-700">
              <Banknote className="w-4 h-4" />
              <label className="text-xs font-bold uppercase tracking-wider">
                Overtime Multiplier *
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step="0.05"
                min="1.0"
                max="3.0"
                name="overtimeMultiplier"
                defaultValue={currentRule.overtimeMultiplier}
                required
                className="w-full px-3 py-2 text-lg font-bold font-mono border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <span className="text-sm font-bold text-indigo-700">x</span>
            </div>
            <p className="text-[11px] text-indigo-600 font-medium">
              Statutory Standard: <strong>1.5x</strong> of base hourly rate.
            </p>
          </div>

          {/* Standard Daily Hours */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center space-x-2 text-slate-700">
              <Clock className="w-4 h-4" />
              <label className="text-xs font-bold uppercase tracking-wider">
                Standard Daily Hours *
              </label>
            </div>
            <input
              type="number"
              step="0.5"
              min="4"
              max="12"
              name="standardDailyHours"
              defaultValue={currentRule.standardDailyHours}
              required
              className="w-full px-3 py-2 text-lg font-bold font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <p className="text-[11px] text-slate-500">
              Hours before overtime begins accrual (Default: 8.0h).
            </p>
          </div>

          {/* Working Days per Month */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center space-x-2 text-slate-700">
              <Calendar className="w-4 h-4" />
              <label className="text-xs font-bold uppercase tracking-wider">
                Working Days / Month *
              </label>
            </div>
            <input
              type="number"
              min="20"
              max="31"
              name="standardWorkingDays"
              defaultValue={currentRule.standardWorkingDays}
              required
              className="w-full px-3 py-2 text-lg font-bold font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <p className="text-[11px] text-slate-500">
              Basis for absence deduction divisor (Default: 26 days).
            </p>
          </div>

          {/* Late Grace Period */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Late Arrival Grace Period (Minutes) *
            </label>
            <input
              type="number"
              min="0"
              max="60"
              name="gracePeriodMinutes"
              defaultValue={currentRule.gracePeriodMinutes}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-400">Tolerance before marked LATE</span>
          </div>

          {/* Break Duration */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Meal Break Duration (Minutes) *
            </label>
            <input
              type="number"
              min="0"
              max="120"
              name="breakDurationMinutes"
              defaultValue={currentRule.breakDurationMinutes}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-400">Deducted from daily work span</span>
          </div>

          {/* Currency Settings */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Currency Code *
              </label>
              <input
                type="text"
                name="currency"
                defaultValue={currentRule.currency}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Currency Symbol *
              </label>
              <input
                type="text"
                name="currencySymbol"
                defaultValue={currentRule.currencySymbol}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
            Reason / Policy Remarks
          </label>
          <input
            type="text"
            name="remarks"
            placeholder="e.g. Bangladesh Labor Act Standard Rule 1.5x"
            defaultValue={currentRule.remarks || ""}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </form>

      {/* Audit Trail of Rule Revisions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center space-x-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h4 className="text-sm font-bold text-slate-900">Payroll Rule Revision Audit Trail</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3">OT Multiplier</th>
                <th className="px-4 py-3">Std Hours</th>
                <th className="px-4 py-3">Working Days</th>
                <th className="px-4 py-3">Grace</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-2.5 font-mono">
                    {format(new Date(r.effectiveFrom), "yyyy-MM-dd HH:mm")}
                  </td>
                  <td className="px-4 py-2.5 font-bold font-mono text-indigo-700">
                    {r.overtimeMultiplier}x
                  </td>
                  <td className="px-4 py-2.5">{r.standardDailyHours}h</td>
                  <td className="px-4 py-2.5">{r.standardWorkingDays}d</td>
                  <td className="px-4 py-2.5">{r.gracePeriodMinutes}m</td>
                  <td className="px-4 py-2.5">
                    {r.isActive ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                        ARCHIVED
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{r.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
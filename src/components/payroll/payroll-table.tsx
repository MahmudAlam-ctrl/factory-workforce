"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateAndSavePayroll } from "@/app/actions/payroll-actions";
import { EmployeePayrollCalculation } from "@/services/payroll.service";
import { PayrollStatus } from "@prisma/client";
import {
  Calculator,
  Lock,
  RefreshCw,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PayrollTableProps {
  year: number;
  month: number;
  rows: EmployeePayrollCalculation[];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function PayrollTable({ year, month, rows }: PayrollTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Aggregates
  const totalBase = rows.reduce((s, r) => s + r.baseSalary, 0);
  const totalOTPay = rows.reduce((s, r) => s + r.overtimePay, 0);
  const totalOTHours = rows.reduce((s, r) => s + r.totalOvertimeHours, 0);
  const totalDeductions = rows.reduce((s, r) => s + r.deductions, 0);
  const totalNet = rows.reduce((s, r) => s + r.netPay, 0);

  const isMonthApproved = rows.length > 0 && rows.every((r) => r.status === PayrollStatus.APPROVED);

  function handleFilterChange(newYear: number, newMonth: number) {
    startTransition(() => {
      router.push(`/payroll?year=${newYear}&month=${newMonth}`);
    });
  }

  async function handleSnapshot(status: PayrollStatus) {
    setMessage(null);
    const res = await generateAndSavePayroll(year, month, status);
    if (res.success) {
      setMessage({
        type: "success",
        text:
          status === PayrollStatus.APPROVED
            ? `Month ${MONTH_NAMES[month - 1]} ${year} has been locked and approved!`
            : `Payroll calculations snapshot saved successfully.`,
      });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error ?? "Failed to save payroll snapshot." });
    }
  }

  return (
    <div className="space-y-6">
      {/* Month Filter & Action Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400 block">Payroll Period</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <select
                value={month}
                onChange={(e) => handleFilterChange(year, Number(e.target.value))}
                className="font-bold text-slate-900 bg-transparent text-base border-b border-slate-300 focus:outline-none focus:border-indigo-600"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => handleFilterChange(Number(e.target.value), month)}
                className="font-bold text-slate-900 bg-transparent text-base border-b border-slate-300 focus:outline-none focus:border-indigo-600"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleSnapshot(PayrollStatus.DRAFT)}
            disabled={isPending || isMonthApproved}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
            title="Recalculate and update draft summary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recalculate</span>
          </button>

          <button
            onClick={() => handleSnapshot(PayrollStatus.APPROVED)}
            disabled={isPending || isMonthApproved}
            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition ${
              isMonthApproved
                ? "bg-emerald-100 text-emerald-800 cursor-not-allowed border border-emerald-300"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isMonthApproved ? "Month Locked (Approved)" : "Approve & Lock Month"}</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 block">Total Base Payroll</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            ৳{totalBase.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-slate-400">Regular contractual pay</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-amber-600 flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Total Overtime Payout</span>
          </span>
          <span className="text-xl font-bold font-mono text-amber-700 mt-1 block">
            ৳{totalOTPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-amber-600 font-medium">
            {totalOTHours.toFixed(1)} hrs total (2.0x standard rate)
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-rose-600 block">Absence Deductions</span>
          <span className="text-xl font-bold font-mono text-rose-700 mt-1 block">
            -৳{totalDeductions.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-slate-400">Unexcused missing shifts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-indigo-500 shadow-sm">
          <span className="text-xs font-bold uppercase text-indigo-600 block">Net Factory Liability</span>
          <span className="text-xl font-extrabold font-mono text-indigo-900 mt-1 block">
            ৳{totalNet.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-indigo-500 font-semibold">Total disbursement estimate</span>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center space-x-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Worker</th>
                <th className="px-4 py-3.5 text-right">Base Salary</th>
                <th className="px-4 py-3.5 text-center">Attendance</th>
                <th className="px-4 py-3.5 text-center">OT Hours</th>
                <th className="px-4 py-3.5 text-right">OT Pay (2.0x)</th>
                <th className="px-4 py-3.5 text-right">Deductions</th>
                <th className="px-4 py-3.5 text-right">Net Payable</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const isExpanded = expandedId === row.employeeId;
                return (
                  <tr key={row.employeeId} className="group hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-indigo-700 text-xs block">
                        {row.employeeCode}
                      </span>
                      <span className="font-medium text-slate-900">{row.name}</span>
                      <span className="text-xs text-slate-400 block">
                        {row.department} &bull; {row.designation}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                      ৳{row.baseSalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3 text-center text-xs">
                      <span className="font-semibold text-emerald-700">{row.presentDays}P</span>
                      {row.lateDays > 0 && (
                        <span className="text-amber-600 ml-1">({row.lateDays}L)</span>
                      )}
                      {row.halfDays > 0 && (
                        <span className="text-blue-600 ml-1">({row.halfDays}H)</span>
                      )}
                      {row.absentDays > 0 && (
                        <span className="text-rose-600 ml-1">/{row.absentDays}A</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {row.totalOvertimeHours > 0 ? (
                        <span className="font-bold text-amber-700">{row.totalOvertimeHours.toFixed(1)}h</span>
                      ) : (
                        <span className="text-slate-400">0h</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-amber-700">
                      ৳{row.overtimePay.toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-xs text-rose-600 font-medium">
                      {row.deductions > 0 ? `-৳${row.deductions.toFixed(2)}` : "৳0.00"}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-900">
                      ৳{row.netPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          row.status === PayrollStatus.APPROVED
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : row.employeeId)}
                        className="text-slate-400 hover:text-indigo-600 p-1"
                        title="View formula drill-down"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down info drawer / details */}
      {expandedId && (
        <div className="bg-slate-900 text-slate-100 p-5 rounded-xl text-xs space-y-3 shadow-lg">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-sm text-indigo-400">
              Calculation Breakdown: {rows.find((r) => r.employeeId === expandedId)?.name} (
              {rows.find((r) => r.employeeId === expandedId)?.employeeCode})
            </h4>
            <button
              onClick={() => setExpandedId(null)}
              className="text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          {(() => {
            const item = rows.find((r) => r.employeeId === expandedId);
            if (!item) return null;
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                <div className="p-3 bg-slate-800/60 rounded-lg">
                  <span className="text-slate-400 block mb-1">1. Overtime Formula (2.0x RMG Rate)</span>
                  <p>OT Hours: {item.totalOvertimeHours}h</p>
                  <p>Base Hourly Rate: ৳{item.hourlyRate.toFixed(2)}/h</p>
                  <p className="text-amber-400 mt-1">
                    OT Pay = {item.totalOvertimeHours} × ৳{item.hourlyRate.toFixed(2)} × 2.0 = ৳
                    {item.overtimePay.toFixed(2)}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-lg">
                  <span className="text-slate-400 block mb-1">2. Absence Deductions</span>
                  <p>Daily Rate: ৳{item.baseSalary} ÷ 26 = ৳{(item.baseSalary / 26).toFixed(2)}/day</p>
                  <p>Absent Days: {item.absentDays} | Half Days: {item.halfDays}</p>
                  <p className="text-rose-400 mt-1">
                    Deductions = ৳{item.deductions.toFixed(2)}
                  </p>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-lg">
                  <span className="text-slate-400 block mb-1">3. Net Payroll Result</span>
                  <p>Base Salary: ৳{item.baseSalary.toFixed(2)}</p>
                  <p>+ Overtime: ৳{item.overtimePay.toFixed(2)}</p>
                  <p>- Deductions: ৳{item.deductions.toFixed(2)}</p>
                  <p className="text-emerald-400 font-bold mt-1 text-sm">
                    Net Pay = ৳{item.netPay.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
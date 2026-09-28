"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveBulkAttendance } from "@/app/actions/attendance-actions";
import { AttendanceStatus } from "@prisma/client";
import {
  Calendar,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

interface EmployeeAttendanceItem {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    standardHours: number;
    gracePeriodMinutes: number;
  } | null;
  status: AttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  regularHours: number;
  overtimeHours: number;
  remarks: string;
}

interface AttendanceSheetProps {
  dateStr: string;
  initialRows: EmployeeAttendanceItem[];
}

export function AttendanceSheet({ dateStr, initialRows }: AttendanceSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<EmployeeAttendanceItem[]>(initialRows);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Recalculate row hours and status live
  function updateRow(index: number, updates: Partial<EmployeeAttendanceItem>) {
    setRows((prev) => {
      const next = [...prev];
      const current = { ...next[index], ...updates };

      if (current.status === AttendanceStatus.ABSENT) {
        current.checkInTime = "";
        current.checkOutTime = "";
        current.regularHours = 0;
        current.overtimeHours = 0;
      } else if (current.checkInTime && current.checkOutTime) {
        const [inH, inM] = current.checkInTime.split(":").map(Number);
        const [outH, outM] = current.checkOutTime.split(":").map(Number);

        const inMin = inH * 60 + inM;
        let outMin = outH * 60 + outM;
        if (outMin < inMin) {
          outMin += 24 * 60; // Next day
        }

        const rawHours = (outMin - inMin) / 60;
        const breakHours = (current.shift?.breakMinutes ?? 60) / 60;
        const netHours = Math.max(0, rawHours - breakHours);
        const standardHours = current.shift?.standardHours ?? 8.0;

        current.regularHours = Math.round(Math.min(netHours, standardHours) * 100) / 100;
        current.overtimeHours =
          netHours > standardHours ? Math.round((netHours - standardHours) * 100) / 100 : 0;

        // Grace period late check
        if (current.shift && updates.checkInTime) {
          const [sH, sM] = current.shift.startTime.split(":").map(Number);
          const shiftStartMin = sH * 60 + sM;
          const graceLimit = shiftStartMin + (current.shift.gracePeriodMinutes ?? 15);

          if (inMin > graceLimit && current.status !== AttendanceStatus.HALF_DAY) {
            current.status = AttendanceStatus.LATE;
          } else if (current.status === AttendanceStatus.LATE && inMin <= graceLimit) {
            current.status = AttendanceStatus.PRESENT;
          }
        }
      }

      next[index] = current;
      return next;
    });
  }

  function handleFillDefaults() {
    setRows((prev) =>
      prev.map((row) => {
        if (!row.shift) return row;
        const stdHours = row.shift.standardHours ?? 8.0;
        return {
          ...row,
          status: AttendanceStatus.PRESENT,
          checkInTime: row.shift.startTime,
          checkOutTime: row.shift.endTime,
          regularHours: stdHours,
          overtimeHours: 0,
        };
      })
    );
  }

  function handleSetAll(status: AttendanceStatus) {
    setRows((prev) =>
      prev.map((row) => {
        if (status === AttendanceStatus.ABSENT) {
          return {
            ...row,
            status: AttendanceStatus.ABSENT,
            checkInTime: "",
            checkOutTime: "",
            regularHours: 0,
            overtimeHours: 0,
          };
        }
        if (row.shift) {
          return {
            ...row,
            status,
            checkInTime: row.shift.startTime,
            checkOutTime: row.shift.endTime,
            regularHours: row.shift.standardHours ?? 8.0,
            overtimeHours: 0,
          };
        }
        return { ...row, status };
      })
    );
  }

  function handleDateChange(newDate: string) {
    startTransition(() => {
      router.push(`/attendance?date=${newDate}`);
    });
  }

  function navigateDay(offset: number) {
    const current = new Date(`${dateStr}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + offset);
    const nextStr = current.toISOString().split("T")[0];
    handleDateChange(nextStr);
  }

  async function handleSave() {
    setMessage(null);
    const payload = {
      dateStr,
      records: rows.map((r) => ({
        employeeId: r.employeeId,
        shiftId: r.shift?.id ?? null,
        status: r.status,
        checkInTime: r.checkInTime || null,
        checkOutTime: r.checkOutTime || null,
        remarks: r.remarks || null,
      })),
    };

    const res = await saveBulkAttendance(payload);
    if (res.success) {
      setMessage({ type: "success", text: `Successfully saved attendance records for ${res.count} workers.` });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error ?? "Failed to save attendance" });
    }
  }

  // Summary Metrics
  const presentCount = rows.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const lateCount = rows.filter((r) => r.status === AttendanceStatus.LATE).length;
  const absentCount = rows.filter((r) => r.status === AttendanceStatus.ABSENT).length;
  const halfDayCount = rows.filter((r) => r.status === AttendanceStatus.HALF_DAY).length;
  const totalOT = rows.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

  return (
    <div className="space-y-5">
      {/* Top Bar: Date & Quick Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateDay(-1)}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <input
              type="date"
              value={dateStr}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={() => navigateDay(1)}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleDateChange(new Date().toISOString().split("T")[0])}
            className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleFillDefaults}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Apply assigned shift hours to all workers"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Fill Shift Times</span>
          </button>
          <button
            onClick={() => handleSetAll(AttendanceStatus.PRESENT)}
            className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
          >
            All Present
          </button>
          <button
            onClick={() => handleSetAll(AttendanceStatus.ABSENT)}
            className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
          >
            All Absent
          </button>
          <Link
            href="/devices"
            className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
            title="Manage biometric machines and pull punches"
          >
            <span>Sync Device</span>
          </Link>
          <a
            href={`/api/export/excel?type=attendance&date=${dateStr}`}
            download
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Export Excel
          </a>
          <a
            href={`/api/export/pdf?type=attendance&date=${dateStr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Export PDF
          </a>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Attendance</span>
          </button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 block">Total Staff</span>
          <span className="text-lg font-bold text-slate-900">{rows.length}</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-emerald-600 block">Present</span>
          <span className="text-lg font-bold text-emerald-700">{presentCount}</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-amber-600 block">Late</span>
          <span className="text-lg font-bold text-amber-700">{lateCount}</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-rose-600 block">Absent</span>
          <span className="text-lg font-bold text-rose-700">{absentCount}</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-xs font-medium text-indigo-600 block">Total OT Hours</span>
          <span className="text-lg font-bold text-indigo-700">{totalOT.toFixed(1)} hrs</span>
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
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Code & Name</th>
                <th className="px-4 py-3.5">Assigned Shift</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Check In</th>
                <th className="px-4 py-3.5">Check Out</th>
                <th className="px-4 py-3.5 text-center">Regular</th>
                <th className="px-4 py-3.5 text-center">Overtime</th>
                <th className="px-4 py-3.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={row.employeeId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-indigo-700 text-xs block">
                      {row.employeeCode}
                    </span>
                    <span className="font-medium text-slate-900">{row.name}</span>
                    <span className="text-xs text-slate-400 block">{row.department}</span>
                  </td>

                  <td className="px-4 py-3">
                    {row.shift ? (
                      <div>
                        <span className="font-medium text-slate-800 text-xs block">
                          {row.shift.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {row.shift.startTime} - {row.shift.endTime} (grace {row.shift.gracePeriodMinutes}m)
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No shift</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateRow(idx, { status: e.target.value as AttendanceStatus })
                      }
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border focus:outline-none ${
                        row.status === AttendanceStatus.PRESENT
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : row.status === AttendanceStatus.LATE
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : row.status === AttendanceStatus.HALF_DAY
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      <option value={AttendanceStatus.PRESENT}>PRESENT</option>
                      <option value={AttendanceStatus.LATE}>LATE</option>
                      <option value={AttendanceStatus.HALF_DAY}>HALF_DAY</option>
                      <option value={AttendanceStatus.ABSENT}>ABSENT</option>
                    </select>
                  </td>

                  <td className="px-4 py-3">
                    <input
                      type="time"
                      value={row.checkInTime}
                      disabled={row.status === AttendanceStatus.ABSENT}
                      onChange={(e) => updateRow(idx, { checkInTime: e.target.value })}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="px-4 py-3">
                    <input
                      type="time"
                      value={row.checkOutTime}
                      disabled={row.status === AttendanceStatus.ABSENT}
                      onChange={(e) => updateRow(idx, { checkOutTime: e.target.value })}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="px-4 py-3 text-center font-mono font-medium text-xs text-slate-700">
                    {row.regularHours.toFixed(1)}h
                  </td>

                  <td className="px-4 py-3 text-center">
                    {row.overtimeHours > 0 ? (
                      <span className="font-mono font-bold text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        +{row.overtimeHours.toFixed(1)}h OT
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-slate-400">0.0h</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <input
                      type="text"
                      placeholder="Optional notes"
                      value={row.remarks}
                      onChange={(e) => updateRow(idx, { remarks: e.target.value })}
                      className="w-full text-xs px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
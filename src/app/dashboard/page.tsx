import { db } from "@/lib/db";
import { calculateMonthlyPayroll } from "@/services/payroll.service";
import { AttendanceStatus } from "@prisma/client";
import Link from "next/link";
import {
  Users,
  CalendarCheck,
  Clock,
  Banknote,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Factory,
  Plus,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // 1. Employee counts
  const [totalEmployees, activeEmployees, todayRecords, deptGroups] = await Promise.all([
    db.employee.count(),
    db.employee.count({ where: { status: "ACTIVE" } }),
    db.attendanceRecord.findMany({
      where: { date: todayDate },
      include: { employee: true },
    }),
    db.employee.groupBy({
      by: ["department"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    }),
  ]);

  // 2. Today's attendance breakdown
  const presentCount = todayRecords.filter(
    (r) => r.status === AttendanceStatus.PRESENT
  ).length;
  const lateCount = todayRecords.filter((r) => r.status === AttendanceStatus.LATE).length;
  const absentCount = todayRecords.filter(
    (r) => r.status === AttendanceStatus.ABSENT
  ).length;
  const halfDayCount = todayRecords.filter(
    (r) => r.status === AttendanceStatus.HALF_DAY
  ).length;
  const unloggedCount = Math.max(0, activeEmployees - todayRecords.length);

  // 3. Month-to-date Payroll & Overtime
  const payrollItems = await calculateMonthlyPayroll(currentYear, currentMonth);
  const mtdOTHours = payrollItems.reduce((s, r) => s + r.totalOvertimeHours, 0);
  const mtdOTPay = payrollItems.reduce((s, r) => s + r.overtimePay, 0);
  const mtdTotalLiability = payrollItems.reduce((s, r) => s + r.netPay, 0);

  const attendanceRate =
    activeEmployees > 0
      ? Math.round(((presentCount + lateCount) / activeEmployees) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Factory Operations Dashboard
          </h2>
          <p className="text-sm text-slate-500">
            Real-time workforce attendance, overtime tracking, and payroll liability summary.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/attendance"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Mark Today&apos;s Attendance</span>
          </Link>
          <Link
            href="/employees/new"
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            <span>New Worker</span>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Workforce Headcount */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              Total Workforce
            </span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{activeEmployees}</span>
            <span className="text-xs text-slate-500">active workers</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {totalEmployees - activeEmployees} separated / inactive
          </p>
        </div>

        {/* Metric 2: Today's Attendance Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              Attendance Today
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{attendanceRate}%</span>
            <span className="text-xs text-slate-500">present &amp; late</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-2">
            {presentCount} on-time &bull; {lateCount} late &bull; {absentCount} absent
          </p>
        </div>

        {/* Metric 3: Month-to-Date Overtime */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              MTD Overtime
            </span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {mtdOTHours.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500">hours logged</span>
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-2">
            ৳{mtdOTPay.toLocaleString("en-US", { minimumFractionDigits: 2 })} (2.0x RMG rate)
          </p>
        </div>

        {/* Metric 4: Estimated Monthly Wage Liability */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              MTD Wage Liability
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold font-mono text-indigo-900">
              ৳{mtdTotalLiability.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-indigo-600 font-medium mt-2">
            Includes base + overtime - deductions
          </p>
        </div>
      </div>

      {/* Operations Grid: Department Distribution & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Department Distribution */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Factory className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Active Department Allocation</h3>
            </div>
            <Link
              href="/employees"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
            >
              <span>View Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {deptGroups.map((g) => (
              <div
                key={g.department}
                className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition"
              >
                <span className="text-xs font-semibold text-slate-500 uppercase block">
                  {g.department}
                </span>
                <span className="text-2xl font-bold text-slate-800 mt-1 block">
                  {g._count.id}
                </span>
                <span className="text-[11px] text-slate-400">workers assigned</span>
              </div>
            ))}
          </div>

          {unloggedCount > 0 && (
            <div className="mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800 font-medium">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{unloggedCount} active workers</strong> have not been logged on today&apos;s attendance ledger.
                </span>
              </div>
              <Link
                href="/attendance"
                className="font-bold underline text-amber-900 hover:text-amber-950"
              >
                Log Now
              </Link>
            </div>
          )}
        </div>

        {/* Right Col: Quick Access & Shift Schedule Overview */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
            Quick Actions
          </h3>

          <div className="space-y-2.5">
            <Link
              href="/attendance"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Daily Attendance</h4>
                  <p className="text-xs text-slate-400">Bulk check-in &amp; overtime calculation</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </Link>

            <Link
              href="/payroll"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Payroll Engine</h4>
                  <p className="text-xs text-slate-400">Review, recalculate &amp; lock wages</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </Link>

            <Link
              href="/shifts"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Production Shifts</h4>
                  <p className="text-xs text-slate-400">Standard hours &amp; grace periods</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </Link>

            <Link
              href="/employees"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Worker Directory</h4>
                  <p className="text-xs text-slate-400">Search, filter &amp; edit staff</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
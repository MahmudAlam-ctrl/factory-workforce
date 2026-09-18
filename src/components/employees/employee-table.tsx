"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleEmployeeStatus } from "@/app/actions/employee-actions";
import { EmployeeStatus } from "@prisma/client";
import { Search, Edit2, CheckCircle, XCircle, Plus, Filter } from "lucide-react";

interface EmployeeRow {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
  baseSalary: any;
  hourlyRate: any;
  status: EmployeeStatus;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
}

export function EmployeeTable({
  employees,
  departments,
}: {
  employees: EmployeeRow[];
  departments: string[];
}) {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = employees.filter((emp) => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchesDept = selectedDept === "ALL" || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  async function handleToggleStatus(id: string, currentStatus: EmployeeStatus) {
    setTogglingId(id);
    await toggleEmployeeStatus(id, currentStatus);
    setTogglingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Link
          href="/employees/new"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Code</th>
                <th className="px-4 py-3.5">Full Name</th>
                <th className="px-4 py-3.5">Department</th>
                <th className="px-4 py-3.5">Designation</th>
                <th className="px-4 py-3.5">Assigned Shift</th>
                <th className="px-4 py-3.5 text-right">Base Salary</th>
                <th className="px-4 py-3.5 text-right">OT Rate (1h)</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    No factory workers found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-700">
                      {emp.employeeCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {emp.department}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{emp.designation}</td>
                    <td className="px-4 py-3">
                      {emp.shift ? (
                        <div>
                          <span className="font-medium text-slate-800">{emp.shift.name}</span>
                          <span className="block text-xs text-slate-400 font-mono">
                            {emp.shift.startTime} - {emp.shift.endTime}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                      ৳{Number(emp.baseSalary).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 font-medium">
                      ৳{Number(emp.hourlyRate).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(emp.id, emp.status)}
                        disabled={togglingId === emp.id}
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition ${
                          emp.status === EmployeeStatus.ACTIVE
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                        }`}
                        title="Click to toggle status"
                      >
                        {emp.status === EmployeeStatus.ACTIVE ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>{emp.status}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/employees/${emp.id}`}
                        className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
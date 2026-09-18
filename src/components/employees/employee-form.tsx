"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, updateEmployee } from "@/app/actions/employee-actions";
import { DEPARTMENTS, DESIGNATIONS } from "@/types";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface ShiftOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isDefault: boolean;
}

interface EmployeeFormProps {
  initialData?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: string;
    designation: string;
    joiningDate: Date | string;
    baseSalary: any;
    hourlyRate: any;
    shiftId: string | null;
    status: "ACTIVE" | "INACTIVE";
  };
  shifts: ShiftOption[];
}

export function EmployeeForm({ initialData, shifts }: EmployeeFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialData);

  const [baseSalary, setBaseSalary] = useState<string>(
    initialData ? String(Number(initialData.baseSalary)) : "15000"
  );
  const [hourlyRate, setHourlyRate] = useState<string>(
    initialData
      ? String(Number(initialData.hourlyRate))
      : (15000 / 208).toFixed(2)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSalaryChange(val: string) {
    setBaseSalary(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      // Standard industrial 208 monthly hours baseline
      setHourlyRate((num / 208).toFixed(2));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    let result;
    if (isEditing && initialData) {
      result = await updateEmployee(initialData.id, formData);
    } else {
      result = await createEmployee(formData);
    }

    if (result.success) {
      router.push("/employees");
      router.refresh();
    } else {
      setError(result.error ?? "Failed to save employee profile");
      setLoading(false);
    }
  }

  const defaultShift = shifts.find((s) => s.isDefault);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link
          href="/employees"
          className="inline-flex items-center space-x-2 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee List</span>
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{loading ? "Saving..." : isEditing ? "Update Worker Profile" : "Register Worker"}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          1. Basic Identity & Department
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Employee Code *
            </label>
            <input
              type="text"
              name="employeeCode"
              required
              defaultValue={initialData?.employeeCode ?? ""}
              placeholder="e.g. EMP-1007"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              First Name *
            </label>
            <input
              type="text"
              name="firstName"
              required
              defaultValue={initialData?.firstName ?? ""}
              placeholder="e.g. Tariqul"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Last Name *
            </label>
            <input
              type="text"
              name="lastName"
              required
              defaultValue={initialData?.lastName ?? ""}
              placeholder="e.g. Islam"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Department *
            </label>
            <select
              name="department"
              required
              defaultValue={initialData?.department ?? "Sewing"}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Designation *
            </label>
            <input
              type="text"
              name="designation"
              required
              list="designation-suggestions"
              defaultValue={initialData?.designation ?? "Sewing Machine Operator"}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="designation-suggestions">
              {DESIGNATIONS.map((des) => (
                <option key={des} value={des} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Joining Date *
            </label>
            <input
              type="date"
              name="joiningDate"
              required
              defaultValue={
                initialData
                  ? new Date(initialData.joiningDate).toISOString().split("T")[0]
                  : new Date().toISOString().split("T")[0]
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 pt-4">
          2. Compensation & Shift Assignment
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Monthly Base Salary (৳) *
            </label>
            <input
              type="number"
              step="100"
              name="baseSalary"
              required
              value={baseSalary}
              onChange={(e) => handleSalaryChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Standard factory monthly pay
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Base Hourly Rate (৳/hr) *
            </label>
            <input
              type="number"
              step="0.01"
              name="hourlyRate"
              required
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Auto: (Base / 208 hrs). Multiplied by 2.0x for OT
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Assigned Shift
            </label>
            <select
              name="shiftId"
              defaultValue={initialData?.shiftId ?? defaultShift?.id ?? ""}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- No Specific Shift --</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.startTime} - {s.endTime})
                </option>
              ))}
            </select>
          </div>
        </div>

        {isEditing && (
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Employment Status
            </label>
            <select
              name="status"
              defaultValue={initialData?.status ?? "ACTIVE"}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ACTIVE">ACTIVE (On Payroll)</option>
              <option value="INACTIVE">INACTIVE (Separated / Resigned)</option>
            </select>
          </div>
        )}
      </div>
    </form>
  );
}
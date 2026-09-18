"use client";

import { useState } from "react";
import { deleteShift } from "@/app/actions/shift-actions";
import { Clock, Users, Trash2, CheckCircle2 } from "lucide-react";

interface ShiftItem {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  standardHours: any;
  gracePeriodMinutes: number;
  isDefault: boolean;
  _count: {
    employees: number;
  };
}

export function ShiftList({ shifts }: { shifts: ShiftItem[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this shift?")) return;
    setDeletingId(id);
    setError(null);
    const result = await deleteShift(id);
    if (!result.success) {
      setError(result.error ?? "Failed to delete shift");
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className={`rounded-xl border p-5 bg-white shadow-sm transition-all hover:shadow-md relative ${
              shift.isDefault ? "border-indigo-400 ring-1 ring-indigo-400" : "border-slate-200"
            }`}
          >
            {shift.isDefault && (
              <div className="absolute top-4 right-4 flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Default</span>
              </div>
            )}

            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">{shift.name}</h4>
                <p className="text-xs text-slate-500 font-mono">
                  {shift.startTime} — {shift.endTime}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-100 my-3 text-slate-600">
              <div>
                <span className="text-slate-400 block">Work Duration</span>
                <span className="font-semibold text-slate-800">
                  {Number(shift.standardHours)} hrs/day
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Lunch / Break</span>
                <span className="font-semibold text-slate-800">
                  {shift.breakMinutes} mins
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Grace Period</span>
                <span className="font-semibold text-slate-800">
                  {shift.gracePeriodMinutes} mins
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Assigned Workers</span>
                <span className="font-semibold text-indigo-600 flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>{shift._count.employees}</span>
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => handleDelete(shift.id)}
                disabled={deletingId === shift.id || shift.isDefault}
                className="text-slate-400 hover:text-rose-600 text-xs font-medium inline-flex items-center space-x-1 disabled:opacity-30 disabled:cursor-not-allowed"
                title={shift.isDefault ? "Cannot delete default shift" : "Delete shift"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingId === shift.id ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
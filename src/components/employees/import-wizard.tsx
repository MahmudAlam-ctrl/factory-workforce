"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAndProcessImport, commitImportBatch } from "@/app/actions/import-actions";
import { PythonCleaningOutput } from "@/services/import-employee.service";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Database,
  RefreshCw,
  Sliders,
  Check,
} from "lucide-react";

export function ImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, startTransition] = useTransition();

  const [importId, setImportId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PythonCleaningOutput | null>(null);
  const [importMode, setImportMode] = useState<"ADD_AND_UPDATE" | "ADD_ONLY" | "VALIDATE_ONLY">("ADD_AND_UPDATE");
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await uploadAndProcessImport(formData);
    setIsProcessing(false);

    if (res.success && res.preview) {
      setImportId(res.importId!);
      setPreview(res.preview);
    } else {
      setError(res.error || "Failed to process Excel spreadsheet.");
    }
  }

  function handleCommit() {
    if (!importId) return;
    setError(null);

    startTransition(async () => {
      const res = await commitImportBatch(importId, importMode);
      if (res.success) {
        setCommitResult(res);
      } else {
        setError(res.error || "Failed to commit import.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl text-sm font-medium bg-rose-50 text-rose-800 border border-rose-200 flex items-center space-x-2">
          <XCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: File Upload (if no preview yet) */}
      {!preview && !commitResult && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">Upload Workforce Excel Spreadsheet</h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports .xlsx files with flexible headers. Processed through Python + NumPy/pandas data cleaning pipeline.
            </p>
          </div>

          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-indigo-400 transition bg-slate-50/50">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="excel-file-input"
              />
              <label
                htmlFor="excel-file-input"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <Upload className="w-6 h-6 text-slate-400" />
                <span className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                  {file ? file.name : "Click to select .xlsx file"}
                </span>
                <span className="text-xs text-slate-400">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "Max file size: 10MB"}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!file || isProcessing}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-sm flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing with NumPy/pandas...</span>
                </>
              ) : (
                <>
                  <span>Upload &amp; Clean Spreadsheet</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Cleaned Data Preview & Commit Mode */}
      {preview && !commitResult && (
        <div className="space-y-6">
          {/* Counters Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase block">Total Rows</span>
              <span className="text-2xl font-extrabold text-slate-800 mt-1 block">
                {preview.totalRows}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <span className="text-xs font-semibold text-emerald-600 uppercase block">Ready to Import</span>
              <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
                {preview.validCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <span className="text-xs font-semibold text-amber-600 uppercase block">Warnings (Cleaned)</span>
              <span className="text-2xl font-extrabold text-amber-700 mt-1 block">
                {preview.warningCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
              <span className="text-xs font-semibold text-rose-600 uppercase block">Invalid / Rejected</span>
              <span className="text-2xl font-extrabold text-rose-700 mt-1 block">
                {preview.invalidCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm">
              <span className="text-xs font-semibold text-purple-600 uppercase block">Duplicates</span>
              <span className="text-2xl font-extrabold text-purple-700 mt-1 block">
                {preview.duplicateCount}
              </span>
            </div>
          </div>

          {/* Import Strategy Controls */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3 w-full md:w-auto">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <div>
                <span className="text-xs font-bold uppercase text-slate-400 block">Import Mode</span>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as any)}
                  className="text-sm font-semibold text-slate-800 bg-transparent border-b border-slate-300 focus:outline-none"
                >
                  <option value="ADD_AND_UPDATE">Add New + Update Existing (Recommended)</option>
                  <option value="ADD_ONLY">Add Only (Skip Existing Worker Codes)</option>
                  <option value="VALIDATE_ONLY">Dry Run (Validate Only)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
              <button
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Discard &amp; Re-upload
              </button>
              <button
                onClick={handleCommit}
                disabled={isCommitting || preview.validCount === 0}
                className="inline-flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
              >
                <Database className="w-4 h-4" />
                <span>
                  {isCommitting
                    ? "Importing..."
                    : `Confirm & Import (${preview.validCount} Workers)`}
                </span>
              </button>
            </div>
          </div>

          {/* Cleaned Records Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                Data Cleaning Preview (Python / pandas Transformation)
              </h4>
              <span className="text-xs text-slate-400">
                Showing all parsed records
              </span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">Row</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Phone</th>
                    <th className="px-3 py-2.5">Dept</th>
                    <th className="px-3 py-2.5">Designation</th>
                    <th className="px-3 py-2.5 text-right">Base Salary</th>
                    <th className="px-3 py-2.5 text-right">Hourly Rate</th>
                    <th className="px-3 py-2.5">Shift</th>
                    <th className="px-3 py-2.5">Validation Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r) => (
                    <tr key={r.rowNumber} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-2 font-mono text-slate-400">#{r.rowNumber}</td>
                      <td className="px-3 py-2">
                        {r.status === "VALID" && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" />
                            <span>VALID</span>
                          </span>
                        )}
                        {r.status === "WARNING" && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>WARNING</span>
                          </span>
                        )}
                        {r.status === "INVALID" && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>INVALID</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-indigo-700">
                        {r.cleanedData.employeeCode || "—"}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {r.cleanedData.firstName} {r.cleanedData.lastName}
                      </td>
                      <td className="px-3 py-2 text-slate-500 font-mono">
                        {r.cleanedData.phone || "—"}
                      </td>
                      <td className="px-3 py-2">{r.cleanedData.department}</td>
                      <td className="px-3 py-2 text-slate-500">{r.cleanedData.designation}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">
                        ৳{r.cleanedData.baseSalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">
                        ৳{r.cleanedData.hourlyRate.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {r.cleanedData.shiftName || "Default Shift"}
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-xs truncate text-[11px]">
                        {r.validationNotes.join("; ") || "OK"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Import Success Summary */}
      {commitResult && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900">Employee Import Completed!</h3>
            <p className="text-xs text-slate-500 mt-1">
              The workforce records have been processed and committed to PostgreSQL database.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 block">Created</span>
              <span className="text-xl font-bold text-emerald-800 mt-0.5 block">
                {commitResult.createdCount || 0}
              </span>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-blue-700 block">Updated</span>
              <span className="text-xl font-bold text-blue-800 mt-0.5 block">
                {commitResult.updatedCount || 0}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block">Skipped / Failed</span>
              <span className="text-xl font-bold text-slate-700 mt-0.5 block">
                {(commitResult.skippedCount || 0) + (commitResult.failedCount || 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <Link
              href="/employees"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Go to Employee Directory
            </Link>
            <button
              onClick={() => {
                setCommitResult(null);
                setPreview(null);
                setFile(null);
              }}
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
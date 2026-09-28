import { ImportWizard } from "@/components/employees/import-wizard";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

export const dynamic = "force-dynamic";

export default function EmployeeImportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/employees"
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            <span>Import Workforce from Excel</span>
          </h2>
          <p className="text-sm text-slate-500">
            Batch import operators and staff from .xlsx spreadsheet. Data is sanitized and validated using Python, NumPy, and pandas.
          </p>
        </div>
      </div>

      <ImportWizard />
    </div>
  );
}
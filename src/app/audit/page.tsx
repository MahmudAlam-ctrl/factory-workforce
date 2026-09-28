import { getRecentAuditLogs } from "@/services/audit.service";
import { AuditLogTable } from "@/components/audit/audit-log-table";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const logs = await getRecentAuditLogs(200);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            System Audit Trail
          </h2>
          <p className="text-sm text-slate-500">
            Immutable log of workforce updates, device synchronizations, payroll rule modifications, and report exports.
          </p>
        </div>
      </div>

      <AuditLogTable logs={logs} />
    </div>
  );
}
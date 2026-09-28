"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ShieldCheck, Filter, Search } from "lucide-react";

interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: string;
  metadata: string | null;
  createdAt: Date;
}

export function AuditLogTable({ logs }: { logs: AuditLogItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("ALL");

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.metadata && log.metadata.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEntity = selectedEntity === "ALL" || log.entity === selectedEntity;
    return matchesSearch && matchesEntity;
  });

  const entities = Array.from(new Set(logs.map((l) => l.entity)));

  function getActionBadge(action: string) {
    if (action.includes("CREATE") || action.includes("SYNC_SUCCESS")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (action.includes("UPDATE") || action.includes("EDIT")) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (action.includes("DELETE") || action.includes("FAIL") || action.includes("ERROR")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search action, entity, details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="ALL">All Entities ({logs.length})</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Details / Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                      {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{log.entity}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{log.entityId || "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{log.actor}</td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-md truncate font-mono text-[11px]">
                      {log.metadata || "—"}
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
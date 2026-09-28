"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveDeviceAction,
  testDeviceAction,
  syncDeviceAction,
  saveMappingAction,
} from "@/app/actions/device-actions";
import { format } from "date-fns";
import {
  Cpu,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Activity,
  Users,
  Radio,
  Clock,
  Save,
  X,
} from "lucide-react";

interface DeviceItem {
  id: string;
  name: string;
  deviceType: string;
  model: string | null;
  ipAddress: string;
  port: number;
  serialNumber: string | null;
  timezone: string;
  isEnabled: boolean;
  isMockMode: boolean;
  connectionStatus: string;
  lastSyncTime: Date | null;
  lastSyncResult: string | null;
  lastSyncCount: number;
  failedSyncCount: number;
  mappings: Array<{
    id: string;
    deviceUserId: string;
    employeeId: string | null;
    employee: { id: string; employeeCode: string; firstName: string; lastName: string } | null;
  }>;
  syncLogs: Array<{
    id: string;
    status: string;
    punchesFetched: number;
    punchesProcessed: number;
    errorMessage: string | null;
    startedAt: Date;
  }>;
}

interface EmployeeLookup {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

export function DeviceManager({
  devices,
  employees,
}: {
  devices: DeviceItem[];
  employees: EmployeeLookup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(
    devices.length > 0 ? devices[0].id : null
  );

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const activeDevice = devices.find((d) => d.id === activeDeviceId) || devices[0];

  // Mapping state
  const [newUserId, setNewUserId] = useState("");
  const [newEmpId, setNewEmpId] = useState("");

  async function handleAddDevice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await saveDeviceAction(formData);
      if (res.success) {
        setShowAddModal(false);
        setMessage({ type: "success", text: "Biometric attendance device registered successfully!" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error || "Failed to register device." });
      }
    });
  }

  async function handleTest(deviceId: string) {
    setMessage(null);
    setActionLoading(`test_${deviceId}`);
    const res = await testDeviceAction(deviceId);
    setActionLoading(null);

    if (res.success && res.result) {
      setMessage({ type: "success", text: res.result.message });
    } else {
      setMessage({ type: "error", text: res.error || (res as any).result?.message || "Connection test failed." });
    }
    router.refresh();
  }

  async function handleSync(deviceId: string) {
    setMessage(null);
    setActionLoading(`sync_${deviceId}`);
    const res = await syncDeviceAction(deviceId);
    setActionLoading(null);

    if (res.success && res.result) {
      setMessage({ type: "success", text: res.result.message });
    } else {
      setMessage({ type: "error", text: res.error || "Sync failed." });
    }
    router.refresh();
  }

  async function handleAddMapping() {
    if (!activeDevice || !newUserId || !newEmpId) return;
    setMessage(null);

    const res = await saveMappingAction(activeDevice.id, [
      { deviceUserId: newUserId, employeeId: newEmpId },
    ]);

    if (res.success) {
      setMessage({ type: "success", text: `Mapped Device User #${newUserId} successfully!` });
      setNewUserId("");
      setNewEmpId("");
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error || "Failed to save mapping." });
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Attendance Machine Terminals</h3>
          <p className="text-xs text-slate-500">
            Real-time TCP integration (port 4370) with ZKTeco standalone biometric terminals.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register New Device</span>
        </button>
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

      {/* Device Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {devices.map((device) => {
          const isSelected = activeDeviceId === device.id;
          const isTesting = actionLoading === `test_${device.id}`;
          const isSyncing = actionLoading === `sync_${device.id}`;

          return (
            <div
              key={device.id}
              onClick={() => setActiveDeviceId(device.id)}
              className={`p-5 rounded-xl border transition cursor-pointer relative bg-white shadow-sm ${
                isSelected
                  ? "border-indigo-600 ring-2 ring-indigo-500/20"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2.5 rounded-lg ${
                      device.isMockMode
                        ? "bg-amber-50 text-amber-600"
                        : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-tight">
                      {device.name}
                    </h4>
                    <span className="font-mono text-xs text-slate-500">
                      {device.ipAddress}:{device.port}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      device.isMockMode
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {device.isMockMode ? "MOCK / DEMO" : "REAL HARDWARE"}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      device.connectionStatus === "CONNECTED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : device.connectionStatus === "ERROR"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {device.connectionStatus}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1 text-slate-500">
                <div className="flex justify-between">
                  <span>Last Sync:</span>
                  <span className="font-medium text-slate-700">
                    {device.lastSyncTime
                      ? format(new Date(device.lastSyncTime), "yyyy-MM-dd HH:mm")
                      : "Never"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Punches Synced:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {device.lastSyncCount}
                  </span>
                </div>
                {device.lastSyncResult && (
                  <p className="text-[11px] text-slate-400 truncate pt-1">
                    {device.lastSyncResult}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTest(device.id);
                  }}
                  disabled={isTesting || isSyncing}
                  className="flex-1 py-1.5 px-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50 flex items-center justify-center space-x-1"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                  <span>{isTesting ? "Testing..." : "Test Link"}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSync(device.id);
                  }}
                  disabled={isTesting || isSyncing}
                  className="flex-1 py-1.5 px-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 flex items-center justify-center space-x-1 shadow-sm"
                >
                  <Radio className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Device Details: Mapping & Logs */}
      {activeDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          {/* Left 2 Cols: Employee ↔ Device Mapping */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">
                  Employee Device Mapping: {activeDevice.name}
                </h4>
              </div>
              <span className="text-xs text-slate-400">
                {activeDevice.mappings.length} configured mappings
              </span>
            </div>

            {/* Quick Add Mapping Row */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                placeholder="Device User ID (e.g. 101)"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                className="w-full sm:w-44 px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />

              <select
                value={newEmpId}
                onChange={(e) => setNewEmpId(e.target.value)}
                className="w-full sm:flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">Select Factory Employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} — {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddMapping}
                disabled={!newUserId || !newEmpId}
                className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 shrink-0"
              >
                Add Mapping
              </button>
            </div>

            {/* Mapping Table */}
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">Terminal User ID</th>
                    <th className="px-3 py-2.5">Mapped Employee Code</th>
                    <th className="px-3 py-2.5">Worker Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeDevice.mappings.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-slate-400 italic">
                        No employees mapped to this terminal yet.
                      </td>
                    </tr>
                  ) : (
                    activeDevice.mappings.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-mono font-bold text-slate-800">
                          #{m.deviceUserId}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-indigo-700">
                          {m.employee?.employeeCode || "Unassigned"}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Col: Sync Log History */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h4 className="font-bold text-slate-900 text-sm">Recent Synchronization Logs</h4>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {activeDevice.syncLogs.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  No synchronization runs recorded.
                </p>
              ) : (
                activeDevice.syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs space-y-1 font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">
                        {format(new Date(log.startedAt), "yyyy-MM-dd HH:mm:ss")}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      Punches: {log.punchesFetched} fetched, {log.punchesProcessed} processed
                    </p>
                    {log.errorMessage && (
                      <p className="text-rose-600 text-[11px] truncate font-sans">
                        {log.errorMessage}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Register Biometric Device</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Device Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Floor 2 Sewing Line Gate"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    name="ipAddress"
                    required
                    placeholder="192.168.1.201"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Port (Default: 4370) *
                  </label>
                  <input
                    type="number"
                    name="port"
                    defaultValue={4370}
                    required
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Device Mode *
                </label>
                <select
                  name="isMockMode"
                  defaultValue="false"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="false">Real Hardware (Connect via LAN Socket port 4370)</option>
                  <option value="true">Mock / Demo Mode (Simulate biometric punches offline)</option>
                </select>
                <span className="text-[11px] text-slate-400">
                  Select Mock Mode if no physical terminal is attached to your local network.
                </span>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isPending ? "Registering..." : "Register Device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
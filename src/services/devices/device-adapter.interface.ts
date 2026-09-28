export interface AttendanceDeviceConfig {
  id: string;
  name: string;
  deviceType: string; // "ZKTECO" | "MOCK"
  ipAddress: string;
  port: number;
  commKey?: string | null;
  serialNumber?: string | null;
  timezone: string;
  isEnabled: boolean;
  isMockMode: boolean;
}

export interface RawPunchEvent {
  deviceUserId: string;
  punchTime: Date;
  punchType?: "CHECK_IN" | "CHECK_OUT" | "BREAK_OUT" | "BREAK_IN" | "UNKNOWN";
  verifyType?: string;
  rawPayload?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs?: number;
  message: string;
  rawError?: string;
  isMock: boolean;
  deviceInfo?: {
    serialNumber?: string;
    firmwareVersion?: string;
    platform?: string;
    userCount?: number;
    logCount?: number;
  };
}

export interface SyncResult {
  punches: RawPunchEvent[];
  lastSyncTime: Date;
  message?: string;
}

export interface AttendanceDeviceAdapter {
  testConnection(device: AttendanceDeviceConfig): Promise<ConnectionTestResult>;
  fetchPunches(device: AttendanceDeviceConfig, lastSyncTime?: Date | null): Promise<SyncResult>;
}
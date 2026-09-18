import { AttendanceStatus } from "@prisma/client";

export interface CalculateAttendanceParams {
  dateStr: string; // "YYYY-MM-DD"
  checkInTime?: string | null; // "HH:mm"
  checkOutTime?: string | null; // "HH:mm"
  shift?: {
    startTime: string; // "08:00"
    endTime: string; // "17:00"
    breakMinutes: number; // 60
    standardHours: number | string | any; // 8.0
    gracePeriodMinutes: number; // 15
  } | null;
  manualStatus?: AttendanceStatus;
}

export interface AttendanceCalculationResult {
  checkIn: Date | null;
  checkOut: Date | null;
  regularHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
}

export function parseTimeToDate(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00.000Z`);
}

export function calculateAttendanceHoursAndStatus(
  params: CalculateAttendanceParams
): AttendanceCalculationResult {
  const { dateStr, checkInTime, checkOutTime, shift, manualStatus } = params;

  // 1. If explicitly ABSENT
  if (manualStatus === AttendanceStatus.ABSENT || (!checkInTime && !checkOutTime && manualStatus !== AttendanceStatus.HALF_DAY)) {
    return {
      checkIn: null,
      checkOut: null,
      regularHours: 0,
      overtimeHours: 0,
      status: AttendanceStatus.ABSENT,
    };
  }

  // 2. If HALF_DAY without check-in/out
  if (manualStatus === AttendanceStatus.HALF_DAY && (!checkInTime || !checkOutTime)) {
    const stdHours = shift ? Number(shift.standardHours) : 8.0;
    return {
      checkIn: null,
      checkOut: null,
      regularHours: Math.round((stdHours / 2) * 100) / 100,
      overtimeHours: 0,
      status: AttendanceStatus.HALF_DAY,
    };
  }

  if (!checkInTime || !checkOutTime) {
    return {
      checkIn: checkInTime ? parseTimeToDate(dateStr, checkInTime) : null,
      checkOut: checkOutTime ? parseTimeToDate(dateStr, checkOutTime) : null,
      regularHours: 0,
      overtimeHours: 0,
      status: manualStatus ?? AttendanceStatus.PRESENT,
    };
  }

  const checkIn = parseTimeToDate(dateStr, checkInTime);
  const checkOut = parseTimeToDate(dateStr, checkOutTime);

  // Time Inversion check: checkOut must not be earlier than checkIn
  if (checkOut.getTime() < checkIn.getTime()) {
    throw new Error("Validation error: checkOut time cannot be earlier than checkIn time.");
  }

  const durationMs = checkOut.getTime() - checkIn.getTime();
  const rawHours = durationMs / (1000 * 60 * 60);

  const breakMinutes = shift?.breakMinutes ?? 60;
  const breakHours = breakMinutes / 60;
  const standardHours = shift ? Number(shift.standardHours) : 8.0;

  // Working hours deducting lunch/break
  const netWorkingHours = Math.max(0, rawHours - breakHours);

  let regularHours = Math.min(netWorkingHours, standardHours);
  let overtimeHours = netWorkingHours > standardHours ? netWorkingHours - standardHours : 0;

  // Round to 2 decimal places
  regularHours = Math.round(regularHours * 100) / 100;
  overtimeHours = Math.round(overtimeHours * 100) / 100;

  // Status determination
  let determinedStatus = manualStatus ?? AttendanceStatus.PRESENT;

  // Evaluate grace period if not manually set to HALF_DAY
  if (manualStatus !== AttendanceStatus.HALF_DAY && shift) {
    const shiftStart = parseTimeToDate(dateStr, shift.startTime);
    const graceLimitMs = shiftStart.getTime() + shift.gracePeriodMinutes * 60 * 1000;

    if (checkIn.getTime() > graceLimitMs) {
      determinedStatus = AttendanceStatus.LATE;
    } else if (manualStatus !== AttendanceStatus.LATE) {
      determinedStatus = AttendanceStatus.PRESENT;
    }
  }

  return {
    checkIn,
    checkOut,
    regularHours,
    overtimeHours,
    status: determinedStatus,
  };
}
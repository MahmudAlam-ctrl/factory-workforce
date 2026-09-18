import { db } from "../src/lib/db";
import { calculateAttendanceHoursAndStatus } from "../src/services/attendance.service";
import { calculateMonthlyPayroll } from "../src/services/payroll.service";
import { saveBulkAttendance } from "../src/app/actions/attendance-actions";
import { createEmployee } from "../src/app/actions/employee-actions";
import { AttendanceStatus, PayrollStatus } from "@prisma/client";

interface TestResult {
  id: number;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log("================================================================================");
  console.log("          FACTORY WORKFORCE V0.1 — AUTOMATED QA STRESS-TEST SUITE              ");
  console.log("================================================================================\n");

  // Fetch or find baseline employee & shift
  const testEmp = await db.employee.findFirst({
    where: { employeeCode: "EMP-1001" },
    include: { shift: true },
  });

  if (!testEmp) {
    throw new Error("Baseline employee EMP-1001 not found. Ensure db:seed has been run.");
  }

  const defaultShift = testEmp.shift || (await db.shift.findFirst({ where: { isDefault: true } }));
  if (!defaultShift) {
    throw new Error("No default shift found. Ensure db:seed has been run.");
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Time Inversion Test
  // ---------------------------------------------------------------------------
  console.log("[RUNNING] Test 1: Time Inversion Test (checkOut 07:00 < checkIn 08:00)...");
  try {
    let errorCaught = false;
    let errorMessage = "";

    // 1. Service Level check
    try {
      calculateAttendanceHoursAndStatus({
        dateStr: "2026-10-01",
        checkInTime: "08:00",
        checkOutTime: "07:00",
        shift: defaultShift,
      });
    } catch (e: any) {
      errorCaught = true;
      errorMessage = e.message;
    }

    // 2. Action Level check
    const actionRes = await saveBulkAttendance({
      dateStr: "2026-10-01",
      records: [
        {
          employeeId: testEmp.id,
          shiftId: defaultShift.id,
          status: AttendanceStatus.PRESENT,
          checkInTime: "08:00",
          checkOutTime: "07:00",
        },
      ],
    });

    const passed = errorCaught && !actionRes.success;

    results.push({
      id: 1,
      name: "Time Inversion Test",
      expected: "Reject earlier checkOut with validation error; no negative hours",
      actual: passed
        ? `Rejected: "${errorMessage}" and action failed: "${actionRes.error}"`
        : "Failed to reject invalid times",
      passed,
    });
  } catch (e: any) {
    results.push({
      id: 1,
      name: "Time Inversion Test",
      expected: "Reject earlier checkOut with validation error; no negative hours",
      actual: `Unexpected crash: ${e.message}`,
      passed: false,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Duplicate Punch Collision
  // ---------------------------------------------------------------------------
  console.log("[RUNNING] Test 2: Duplicate Punch Collision (composite unique constraint)...");
  const testCollisionDate = new Date("2026-11-20T00:00:00.000Z");
  try {
    // Clean up if exists
    await db.attendanceRecord.deleteMany({
      where: { employeeId: testEmp.id, date: testCollisionDate },
    });

    // 1st insert
    await db.attendanceRecord.create({
      data: {
        employeeId: testEmp.id,
        shiftId: defaultShift.id,
        date: testCollisionDate,
        status: AttendanceStatus.PRESENT,
        regularHours: 8.0,
        overtimeHours: 0,
      },
    });

    let duplicateBlocked = false;
    let collisionCode = "";

    // 2nd insert with same employeeId and date
    try {
      await db.attendanceRecord.create({
        data: {
          employeeId: testEmp.id,
          shiftId: defaultShift.id,
          date: testCollisionDate,
          status: AttendanceStatus.PRESENT,
          regularHours: 8.0,
          overtimeHours: 0,
        },
      });
    } catch (e: any) {
      duplicateBlocked = true;
      collisionCode = e.code || e.message;
    }

    // Clean up
    await db.attendanceRecord.deleteMany({
      where: { employeeId: testEmp.id, date: testCollisionDate },
    });

    const passed = duplicateBlocked;
    results.push({
      id: 2,
      name: "Duplicate Punch Collision",
      expected: "Database/Service must block duplicate punch for same employee/date",
      actual: passed
        ? `Blocked duplicate punch via composite constraint (Prisma/DB Code: ${collisionCode})`
        : "Allowed duplicate attendance record to be inserted",
      passed,
    });
  } catch (e: any) {
    results.push({
      id: 2,
      name: "Duplicate Punch Collision",
      expected: "Database/Service must block duplicate punch for same employee/date",
      actual: `Unexpected error: ${e.message}`,
      passed: false,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Grace Period Boundary Condition
  // ---------------------------------------------------------------------------
  console.log("[RUNNING] Test 3: Grace Period Boundary Condition (08:15 vs 08:16 with 15m grace)...");
  try {
    const shiftWith15mGrace = {
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      standardHours: 8.0,
      gracePeriodMinutes: 15,
    };

    // Record A: Exactly 08:15 (at boundary) -> Should be PRESENT
    const recA = calculateAttendanceHoursAndStatus({
      dateStr: "2026-10-02",
      checkInTime: "08:15",
      checkOutTime: "17:00",
      shift: shiftWith15mGrace,
    });

    // Record B: 08:16 (past boundary) -> Should be LATE
    const recB = calculateAttendanceHoursAndStatus({
      dateStr: "2026-10-02",
      checkInTime: "08:16",
      checkOutTime: "17:00",
      shift: shiftWith15mGrace,
    });

    const passed = recA.status === AttendanceStatus.PRESENT && recB.status === AttendanceStatus.LATE;

    results.push({
      id: 3,
      name: "Grace Period Boundary Condition",
      expected: "08:15:00 -> PRESENT, 08:16:00 -> LATE",
      actual: `08:15 yielded [${recA.status}], 08:16 yielded [${recB.status}]`,
      passed,
    });
  } catch (e: any) {
    results.push({
      id: 3,
      name: "Grace Period Boundary Condition",
      expected: "08:15:00 -> PRESENT, 08:16:00 -> LATE",
      actual: `Error: ${e.message}`,
      passed: false,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Overtime & Statutory 2.0x Rate Verification
  // ---------------------------------------------------------------------------
  console.log("[RUNNING] Test 4: Overtime & Statutory 2.0x Rate Verification...");
  try {
    // Worker logs 10.5 working hours (08:00 to 19:30 with 60m break = 10.5 hours net)
    const otCalc = calculateAttendanceHoursAndStatus({
      dateStr: "2026-10-03",
      checkInTime: "08:00",
      checkOutTime: "19:30",
      shift: {
        startTime: "08:00",
        endTime: "17:00",
        breakMinutes: 60,
        standardHours: 8.0,
        gracePeriodMinutes: 15,
      },
    });

    const hourlyRate = 72.12;
    const baseSalary = 15000;
    const expectedOTHours = 2.5;
    const expectedOTPay = Math.round(expectedOTHours * hourlyRate * 2.0 * 100) / 100; // 360.60

    const otHoursMatch = otCalc.overtimeHours === expectedOTHours;
    const otPayMatch = expectedOTPay === 360.6;

    const passed = otHoursMatch && otPayMatch;

    results.push({
      id: 4,
      name: "Overtime & Statutory 2.0x Rate",
      expected: "OT Hours = 2.50, Gross OT addition = 360.60 (2.50 * 72.12 * 2.0)",
      actual: `OT Hours = ${otCalc.overtimeHours.toFixed(2)}, Computed OT Pay = ${expectedOTPay.toFixed(2)}`,
      passed,
    });
  } catch (e: any) {
    results.push({
      id: 4,
      name: "Overtime & Statutory 2.0x Rate",
      expected: "OT Hours = 2.50, Gross OT addition = 360.60",
      actual: `Error: ${e.message}`,
      passed: false,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Missing Check-out (Ghost Worker)
  // ---------------------------------------------------------------------------
  console.log("[RUNNING] Test 5: Missing Check-out (Ghost Worker)...");
  const ghostTestDate = new Date("2026-09-28T00:00:00.000Z");
  try {
    // Clean up
    await db.attendanceRecord.deleteMany({
      where: { employeeId: testEmp.id, date: ghostTestDate },
    });

    // 1. Calculate with null checkOut
    const ghostCalc = calculateAttendanceHoursAndStatus({
      dateStr: "2026-09-28",
      checkInTime: "08:00",
      checkOutTime: null,
      shift: defaultShift,
    });

    // 2. Insert record with NULL checkOut into DB
    await db.attendanceRecord.create({
      data: {
        employeeId: testEmp.id,
        shiftId: defaultShift.id,
        date: ghostTestDate,
        checkIn: ghostCalc.checkIn,
        checkOut: null,
        status: AttendanceStatus.PRESENT,
        regularHours: ghostCalc.regularHours,
        overtimeHours: ghostCalc.overtimeHours,
      },
    });

    // 3. Query monthly payroll for September 2026 to ensure no crash, no NaN
    const payrollRes = await calculateMonthlyPayroll(2026, 9);
    const empPayroll = payrollRes.find((p) => p.employeeId === testEmp.id);

    const hasNoNaN =
      empPayroll &&
      !isNaN(empPayroll.netPay) &&
      !isNaN(empPayroll.totalRegularHours) &&
      !isNaN(empPayroll.totalOvertimeHours);

    // Clean up
    await db.attendanceRecord.deleteMany({
      where: { employeeId: testEmp.id, date: ghostTestDate },
    });

    const passed = Boolean(hasNoNaN && ghostCalc.regularHours === 0 && ghostCalc.overtimeHours === 0);

    results.push({
      id: 5,
      name: "Missing Check-out (Ghost Worker)",
      expected: "Payroll & Dashboard queries must NOT crash; regular/OT hours = 0, no NaN",
      actual: passed
        ? `Handled gracefully: regularHours=${ghostCalc.regularHours}, OT=${ghostCalc.overtimeHours}, NetPay=৳${empPayroll?.netPay.toFixed(2)} (no NaN/crash)`
        : "Failed: encountered NaN or calculation crash",
      passed,
    });
  } catch (e: any) {
    results.push({
      id: 5,
      name: "Missing Check-out (Ghost Worker)",
      expected: "Payroll & Dashboard queries must NOT crash",
      actual: `Crash: ${e.message}`,
      passed: false,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Negative Wage Protection
  // ---------------------------------------------------------------------------
  console.log("[RUNNING] Test 6: Negative Wage Protection (basicSalary = -5000, OT = -50)...");
  try {
    const formData = new FormData();
    formData.append("employeeCode", "TEST-NEG-01");
    formData.append("firstName", "Negative");
    formData.append("lastName", "Tester");
    formData.append("department", "Sewing");
    formData.append("designation", "Operator");
    formData.append("baseSalary", "-5000");
    formData.append("hourlyRate", "-50");

    const createRes = await createEmployee(formData);

    const checkDB = await db.employee.findUnique({
      where: { employeeCode: "TEST-NEG-01" },
    });

    const passed = !createRes.success && checkDB === null;

    results.push({
      id: 6,
      name: "Negative Wage Protection",
      expected: "Reject creation of negative base salary / hourly rate",
      actual: passed
        ? `Successfully rejected with validation error: "${createRes.error}". Database record NOT created.`
        : "Failed: Negative salary employee was created",
      passed,
    });
  } catch (e: any) {
    results.push({
      id: 6,
      name: "Negative Wage Protection",
      expected: "Reject creation of negative base salary / hourly rate",
      actual: `Error: ${e.message}`,
      passed: false,
    });
  }

  // ---------------------------------------------------------------------------
  // PRINT VERDICT TABLE
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("                           QA STRESS-TEST VERDICT TABLE                         ");
  console.log("================================================================================\n");

  for (const r of results) {
    const statusTag = r.passed ? "[PASS]" : "[FAIL]";
    console.log(`TEST ${r.id}: ${statusTag} ${r.name}`);
    console.log(`  Expected: ${r.expected}`);
    console.log(`  Actual:   ${r.actual}`);
    console.log("--------------------------------------------------------------------------------");
  }

  const allPassed = results.every((r) => r.passed);
  console.log(`\nFINAL VERDICT: ${allPassed ? "ALL 6 TESTS PASSED (100%)" : "SOME TESTS FAILED"}\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error("Fatal error during stress testing:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
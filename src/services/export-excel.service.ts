import ExcelJS from "exceljs";
import { format } from "date-fns";

export async function generateEmployeesExcel(employees: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FactoryWorkforce";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Workers Directory");

  worksheet.columns = [
    { header: "Employee Code", key: "code", width: 16 },
    { header: "First Name", key: "firstName", width: 16 },
    { header: "Last Name", key: "lastName", width: 16 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Department", key: "department", width: 18 },
    { header: "Designation", key: "designation", width: 26 },
    { header: "Joining Date", key: "joiningDate", width: 15 },
    { header: "Status", key: "status", width: 12 },
    { header: "Assigned Shift", key: "shift", width: 18 },
    { header: "Base Salary (BDT)", key: "baseSalary", width: 18 },
    { header: "Hourly Rate (BDT)", key: "hourlyRate", width: 18 },
  ];

  // Header row styling
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Slate-800
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  for (const emp of employees) {
    const row = worksheet.addRow({
      code: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone || "—",
      department: emp.department,
      designation: emp.designation,
      joiningDate: format(new Date(emp.joiningDate), "yyyy-MM-dd"),
      status: emp.status,
      shift: emp.shift?.name || "Unassigned",
      baseSalary: Number(emp.baseSalary),
      hourlyRate: Number(emp.hourlyRate),
    });

    row.getCell("baseSalary").numFmt = "#,##0.00";
    row.getCell("hourlyRate").numFmt = "#,##0.00";
    row.alignment = { vertical: "middle" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateAttendanceExcel(records: any[], dateStr: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Attendance ${dateStr}`);

  worksheet.columns = [
    { header: "Worker ID", key: "code", width: 15 },
    { header: "Employee Name", key: "name", width: 24 },
    { header: "Department", key: "department", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Shift", key: "shift", width: 16 },
    { header: "Check In", key: "checkIn", width: 12 },
    { header: "Check Out", key: "checkOut", width: 12 },
    { header: "Regular Hrs", key: "regularHours", width: 14 },
    { header: "Overtime Hrs", key: "overtimeHours", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Source", key: "source", width: 12 },
    { header: "Remarks", key: "remarks", width: 24 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF312E81" }, // Indigo-900
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  for (const r of records) {
    const formatTime = (d: Date | null) => (d ? format(new Date(d), "HH:mm") : "—");

    const row = worksheet.addRow({
      code: r.employee?.employeeCode || r.employeeCode,
      name: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.name,
      department: r.employee?.department || r.department,
      date: dateStr,
      shift: r.shift?.name || "General Shift",
      checkIn: formatTime(r.checkIn),
      checkOut: formatTime(r.checkOut),
      regularHours: Number(r.regularHours || 0),
      overtimeHours: Number(r.overtimeHours || 0),
      status: r.status,
      source: r.source || "MANUAL",
      remarks: r.remarks || "—",
    });

    row.getCell("regularHours").numFmt = "0.00";
    row.getCell("overtimeHours").numFmt = "0.00";
    row.alignment = { vertical: "middle" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generatePayrollExcel(
  payrollItems: any[],
  year: number,
  month: number
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Payroll ${year}-${String(month).padStart(2, "0")}`);

  worksheet.columns = [
    { header: "Employee Code", key: "code", width: 15 },
    { header: "Full Name", key: "name", width: 24 },
    { header: "Department", key: "department", width: 18 },
    { header: "Designation", key: "designation", width: 24 },
    { header: "Base Salary (BDT)", key: "baseSalary", width: 18 },
    { header: "Present Days", key: "presentDays", width: 14 },
    { header: "Absent Days", key: "absentDays", width: 14 },
    { header: "Regular Hrs", key: "regHours", width: 14 },
    { header: "OT Hours", key: "otHours", width: 14 },
    { header: "OT Multiplier", key: "otMultiplier", width: 14 },
    { header: "Overtime Pay (BDT)", key: "otPay", width: 18 },
    { header: "Deductions (BDT)", key: "deductions", width: 18 },
    { header: "Net Payable (BDT)", key: "netPay", width: 20 },
    { header: "Payroll Status", key: "status", width: 14 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF065F46" }, // Emerald-800
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  for (const item of payrollItems) {
    const row = worksheet.addRow({
      code: item.employeeCode,
      name: item.name,
      department: item.department,
      designation: item.designation,
      baseSalary: item.baseSalary,
      presentDays: item.presentDays,
      absentDays: item.absentDays,
      regHours: item.totalRegularHours,
      otHours: item.totalOvertimeHours,
      otMultiplier: `${item.overtimeMultiplier || 1.5}x`,
      otPay: item.overtimePay,
      deductions: item.deductions,
      netPay: item.netPay,
      status: item.status,
    });

    row.getCell("baseSalary").numFmt = "#,##0.00";
    row.getCell("regHours").numFmt = "0.00";
    row.getCell("otHours").numFmt = "0.00";
    row.getCell("otPay").numFmt = "#,##0.00";
    row.getCell("deductions").numFmt = "#,##0.00";
    row.getCell("netPay").numFmt = "#,##0.00";
    row.alignment = { vertical: "middle" };
  }

  // Summary Totals Row
  const totalBase = payrollItems.reduce((s, r) => s + r.baseSalary, 0);
  const totalOT = payrollItems.reduce((s, r) => s + r.overtimePay, 0);
  const totalDed = payrollItems.reduce((s, r) => s + r.deductions, 0);
  const totalNet = payrollItems.reduce((s, r) => s + r.netPay, 0);

  const totalRow = worksheet.addRow({
    code: "TOTALS",
    name: `${payrollItems.length} Workers`,
    department: "",
    designation: "",
    baseSalary: totalBase,
    presentDays: "",
    absentDays: "",
    regHours: "",
    otHours: "",
    otMultiplier: "",
    otPay: totalOT,
    deductions: totalDed,
    netPay: totalNet,
    status: "",
  });

  totalRow.font = { bold: true };
  totalRow.getCell("baseSalary").numFmt = "#,##0.00";
  totalRow.getCell("otPay").numFmt = "#,##0.00";
  totalRow.getCell("deductions").numFmt = "#,##0.00";
  totalRow.getCell("netPay").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
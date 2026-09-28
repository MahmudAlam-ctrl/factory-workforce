import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export async function generateEmployeesPdf(employees: any[]): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 842, 60, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FactoryWorkforce", 40, 36);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Garment Manufacturing Workforce Directory", 200, 36);
  doc.text(`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 660, 36);

  // Table Data
  const tableData = employees.map((emp) => [
    emp.employeeCode,
    `${emp.firstName} ${emp.lastName}`,
    emp.phone || "—",
    emp.department,
    emp.designation,
    format(new Date(emp.joiningDate), "yyyy-MM-dd"),
    emp.status,
    `BDT ${Number(emp.baseSalary).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `BDT ${Number(emp.hourlyRate).toFixed(2)}/hr`,
  ]);

  autoTable(doc, {
    startY: 80,
    head: [
      [
        "Code",
        "Full Name",
        "Phone",
        "Department",
        "Designation",
        "Join Date",
        "Status",
        "Base Salary",
        "Hourly Rate",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [49, 46, 129], textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 5 },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} | FactoryWorkforce System Report`,
        40,
        570
      );
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateAttendancePdf(records: any[], dateStr: string): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFillColor(49, 46, 129); // Indigo-900
  doc.rect(0, 0, 842, 60, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FactoryWorkforce", 40, 36);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Daily Attendance Ledger — ${dateStr}`, 200, 36);
  doc.text(`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 660, 36);

  const formatTime = (d: Date | null) => (d ? format(new Date(d), "HH:mm") : "—");

  const tableData = records.map((r) => [
    r.employee?.employeeCode || r.employeeCode,
    r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.name,
    r.employee?.department || r.department,
    r.shift?.name || "General Shift",
    formatTime(r.checkIn),
    formatTime(r.checkOut),
    `${Number(r.regularHours || 0).toFixed(1)}h`,
    Number(r.overtimeHours || 0) > 0 ? `+${Number(r.overtimeHours).toFixed(1)}h` : "0h",
    r.status,
    r.source || "MANUAL",
  ]);

  autoTable(doc, {
    startY: 80,
    head: [
      [
        "Worker ID",
        "Employee Name",
        "Department",
        "Shift",
        "Check In",
        "Check Out",
        "Regular",
        "Overtime",
        "Status",
        "Source",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 5 },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} | FactoryWorkforce System Report`,
        40,
        570
      );
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

export async function generatePayrollPdf(
  payrollItems: any[],
  year: number,
  month: number
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFillColor(6, 95, 70); // Emerald-800
  doc.rect(0, 0, 842, 60, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FactoryWorkforce", 40, 36);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Monthly Payroll Summary — ${year}-${String(month).padStart(2, "0")}`, 200, 36);
  doc.text(`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 660, 36);

  const totalBase = payrollItems.reduce((s, r) => s + r.baseSalary, 0);
  const totalOT = payrollItems.reduce((s, r) => s + r.overtimePay, 0);
  const totalNet = payrollItems.reduce((s, r) => s + r.netPay, 0);

  // Summary Metrics Banner
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Workers: ${payrollItems.length}   |   Total Base: BDT ${totalBase.toLocaleString("en-US", { minimumFractionDigits: 2 })}   |   Total OT: BDT ${totalOT.toLocaleString("en-US", { minimumFractionDigits: 2 })}   |   Net Liability: BDT ${totalNet.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    40,
    78
  );

  const tableData = payrollItems.map((item) => [
    item.employeeCode,
    item.name,
    item.department,
    item.designation,
    `BDT ${item.baseSalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `${item.presentDays}P / ${item.absentDays}A`,
    `${item.totalOvertimeHours.toFixed(1)}h (${item.overtimeMultiplier || 1.5}x)`,
    `BDT ${item.overtimePay.toFixed(2)}`,
    item.deductions > 0 ? `-BDT ${item.deductions.toFixed(2)}` : "BDT 0.00",
    `BDT ${item.netPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    item.status,
  ]);

  autoTable(doc, {
    startY: 92,
    head: [
      [
        "Code",
        "Employee Name",
        "Department",
        "Designation",
        "Base Salary",
        "Attendance",
        "OT Hours",
        "OT Pay",
        "Deductions",
        "Net Payable",
        "Status",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [6, 95, 70], textColor: 255, fontSize: 8.5, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 5 },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} | FactoryWorkforce System Report`,
        40,
        570
      );
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateIndividualPaySlipPdf(
  item: any,
  year: number,
  month: number
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  // Border & Header
  doc.setDrawColor(200);
  doc.rect(30, 30, 535, 780);

  doc.setFillColor(30, 41, 59);
  doc.rect(30, 30, 535, 60, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FactoryWorkforce Garment Co. Ltd.", 45, 58);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Monthly Salary Pay Slip", 45, 74);
  doc.text(`Period: ${year}-${String(month).padStart(2, "0")}`, 440, 74);

  // Worker Info Block
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Employee Details", 45, 115);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Employee Code: ${item.employeeCode}`, 45, 132);
  doc.text(`Full Name: ${item.name}`, 45, 147);
  doc.text(`Department: ${item.department}`, 45, 162);
  doc.text(`Designation: ${item.designation}`, 45, 177);

  doc.text(`Working Days: ${item.totalWorkingDays}`, 320, 132);
  doc.text(`Present: ${item.presentDays} days`, 320, 147);
  doc.text(`Absent: ${item.absentDays} days`, 320, 162);
  doc.text(`Status: ${item.status}`, 320, 177);

  // Line Items Table
  autoTable(doc, {
    startY: 200,
    head: [["Earnings Item", "Hours / Units", "Rate", "Amount (BDT)"]],
    body: [
      ["Base Monthly Salary", "Full Month", "Contractual", item.baseSalary.toFixed(2)],
      [
        "Overtime Wages",
        `${item.totalOvertimeHours.toFixed(1)} hrs`,
        `BDT ${(item.hourlyRate * (item.overtimeMultiplier || 1.5)).toFixed(2)} (${item.overtimeMultiplier || 1.5}x)`,
        item.overtimePay.toFixed(2),
      ],
      [
        "Absence Deductions",
        `${item.absentDays} unexcused days`,
        `BDT ${(item.baseSalary / item.totalWorkingDays).toFixed(2)}/day`,
        item.deductions > 0 ? `-${item.deductions.toFixed(2)}` : "0.00",
      ],
    ],
    foot: [["NET DISBURSEMENT", "", "", `BDT ${item.netPay.toFixed(2)}`]],
    theme: "grid",
    headStyles: { fillColor: [49, 46, 129], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: [49, 46, 129], fontStyle: "bold", fontSize: 11 },
    margin: { left: 45, right: 45 },
  });

  // Footer notes & signature lines
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("System-generated electronic pay slip. Valid without manual signature.", 45, 730);

  doc.setDrawColor(180);
  doc.line(45, 770, 160, 770);
  doc.text("Employee Signature", 60, 782);

  doc.line(380, 770, 495, 770);
  doc.text("Authorized Payroll Officer", 385, 782);

  return Buffer.from(doc.output("arraybuffer"));
}
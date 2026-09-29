import { db } from "@/lib/db";
import { logAuditAction } from "@/services/audit.service";
import { EmployeeStatus } from "@prisma/client";
import { spawn } from "child_process";
import path from "path";

const PYTHON_PATH = process.env.PYTHON_PATH || "C:\\Users\\Mahmud Alam\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";

export interface CleanedRowData {
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  department: string;
  designation: string;
  joiningDate: string;
  baseSalary: number;
  hourlyRate: number;
  status: "ACTIVE" | "INACTIVE";
  shiftName?: string | null;
}

export interface PythonCleaningOutput {
  success: boolean;
  error?: string;
  totalRows: number;
  validCount: number;
  warningCount: number;
  invalidCount: number;
  duplicateCount: number;
  columnsDetected: string[];
  columnMapping: Record<string, string>;
  rows: Array<{
    rowNumber: number;
    rawData: Record<string, any>;
    cleanedData: CleanedRowData;
    status: "VALID" | "WARNING" | "INVALID";
    validationNotes: string[];
  }>;
}

const SYNONYMS: Record<string, string[]> = {
  employeeCode: ["employeecode", "employee_code", "employee id", "employeeid", "emp id", "empid", "code", "id", "worker id"],
  firstName: ["firstname", "first_name", "first name"],
  lastName: ["lastname", "last_name", "last name", "surname"],
  fullName: ["fullname", "full_name", "name", "employee name", "worker name"],
  phone: ["phone", "mobile", "mobile no", "mobile_no", "cell", "contact"],
  department: ["department", "dept", "section"],
  designation: ["designation", "position", "role", "job title", "title"],
  joiningDate: ["joiningdate", "joining_date", "join date", "join_date", "doj", "date of join"],
  baseSalary: ["basesalary", "base_salary", "basic salary", "basicsalary", "salary", "gross salary", "monthly salary", "wage"],
  hourlyRate: ["hourlyrate", "hourly_rate", "rate", "ot rate", "overtime rate"],
  status: ["status", "employment status", "active", "state"],
  shiftName: ["shift", "shift name", "assigned shift", "schedule"]
};

export async function runNativeCleaningPipeline(
  excelFilePath: string,
  customMapping?: Record<string, string>
): Promise<PythonCleaningOutput> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelFilePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    return {
      success: false,
      error: "Uploaded Excel spreadsheet contains no data rows.",
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      columnsDetected: [],
      columnMapping: {},
      rows: [],
    };
  }

  const headerRow = worksheet.getRow(1);
  const detectedCols: string[] = [];
  const colIndexToName = new Map<number, string>();

  headerRow.eachCell((cell: any, colNumber: number) => {
    const val = String(cell?.value || "").trim();
    if (val) {
      detectedCols.push(val);
      colIndexToName.set(colNumber, val);
    }
  });

  const mapping: Record<string, string> = {};
  const cleanedCols = new Map<string, string>();
  for (const c of detectedCols) {
    cleanedCols.set(c, c.toLowerCase().replace(/[^a-z0-9]/g, ""));
  }

  for (const [col, colClean] of cleanedCols.entries()) {
    for (const [field, aliases] of Object.entries(SYNONYMS)) {
      if (Object.values(mapping).includes(field)) continue;
      let matched = false;
      for (const alias of aliases) {
        if (colClean === alias.replace(/[^a-z0-9]/g, "")) {
          mapping[col] = field;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
  }

  if (customMapping) {
    Object.assign(mapping, customMapping);
  }

  const invertedMapping: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapping)) {
    invertedMapping[v] = k;
  }

  const seenCodes = new Set<string>();
  const rowsOutput: PythonCleaningOutput["rows"] = [];
  let validCount = 0;
  let warningCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rawData: Record<string, any> = {};
    let hasData = false;

    colIndexToName.forEach((colName, colIdx) => {
      let val = row.getCell(colIdx).value;
      if (val && typeof val === "object" && "result" in val) {
        val = (val as any).result;
      }
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        hasData = true;
      }
      rawData[colName] = val;
    });

    if (!hasData) continue;

    const warnings: string[] = [];
    const errors: string[] = [];

    const getVal = (field: string) => {
      const colName = invertedMapping[field];
      return colName ? rawData[colName] : null;
    };

    let codeStr = String(getVal("employeeCode") || "").trim();
    if (codeStr.endsWith(".0")) codeStr = codeStr.slice(0, -2);
    if (!codeStr) {
      errors.push("Missing Employee Code");
    } else if (seenCodes.has(codeStr)) {
      errors.push(`Duplicate Employee Code '${codeStr}' in spreadsheet`);
      duplicateCount++;
    } else {
      seenCodes.add(codeStr);
    }

    let firstName = String(getVal("firstName") || "").trim();
    let lastName = String(getVal("lastName") || "").trim();
    const fullName = String(getVal("fullName") || "").trim();

    if (!firstName && fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(" ") || ".";
      warnings.push("Split Full Name into First and Last name");
    } else if (!firstName) {
      firstName = "Worker";
      warnings.push("Missing First Name; defaulted to 'Worker'");
    }
    if (!lastName) lastName = ".";

    const toTitle = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    firstName = toTitle(firstName);
    lastName = toTitle(lastName);

    const dept = toTitle(String(getVal("department") || "").trim() || "Sewing");
    const designation = toTitle(String(getVal("designation") || "").trim() || "Operator");

    let phoneStr = String(getVal("phone") || "").trim().replace(/[^0-9+]/g, "");
    if (phoneStr.length < 7) phoneStr = "";

    const rawDoj = getVal("joiningDate");
    let dojStr = new Date().toISOString().split("T")[0];
    if (rawDoj instanceof Date) {
      dojStr = rawDoj.toISOString().split("T")[0];
    } else if (typeof rawDoj === "string" && rawDoj.trim()) {
      const parsedD = new Date(rawDoj.trim());
      if (!isNaN(parsedD.getTime())) {
        dojStr = parsedD.toISOString().split("T")[0];
      }
    }

    const rawSal = getVal("baseSalary");
    let baseSalary = 0;
    if (rawSal !== null && rawSal !== undefined) {
      const cleanNum = String(rawSal).replace(/[^0-9.]/g, "");
      baseSalary = parseFloat(cleanNum) || 0;
    }
    if (baseSalary <= 0) {
      errors.push("Missing or invalid Base Salary");
    }

    const rawRate = getVal("hourlyRate");
    let hourlyRate = 0;
    if (rawRate !== null && rawRate !== undefined) {
      const cleanRate = String(rawRate).replace(/[^0-9.]/g, "");
      hourlyRate = parseFloat(cleanRate) || 0;
    }
    if (hourlyRate <= 0 && baseSalary > 0) {
      hourlyRate = Math.round((baseSalary / 208) * 100) / 100;
      warnings.push(`Calculated hourly rate ৳${hourlyRate.toFixed(2)} (Base / 208)`);
    }

    const rawStatus = String(getVal("status") || "").trim().toUpperCase();
    const statusVal = rawStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const shiftName = getVal("shiftName") ? String(getVal("shiftName")).trim() : null;

    let rowStatus: "VALID" | "WARNING" | "INVALID" = "VALID";
    if (errors.length > 0) {
      rowStatus = "INVALID";
      invalidCount++;
    } else if (warnings.length > 0) {
      rowStatus = "WARNING";
      warningCount++;
    } else {
      validCount++;
    }

    rowsOutput.push({
      rowNumber: r,
      rawData,
      cleanedData: {
        employeeCode: codeStr,
        firstName,
        lastName,
        phone: phoneStr || null,
        department: dept,
        designation,
        joiningDate: dojStr,
        baseSalary,
        hourlyRate,
        status: statusVal,
        shiftName,
      },
      status: rowStatus,
      validationNotes: [...errors, ...warnings],
    });
  }

  return {
    success: true,
    totalRows: rowsOutput.length,
    validCount,
    warningCount,
    invalidCount,
    duplicateCount,
    columnsDetected: detectedCols,
    columnMapping: mapping,
    rows: rowsOutput,
  };
}

export async function runPythonCleaningPipeline(
  excelFilePath: string,
  customMapping?: Record<string, string>
): Promise<PythonCleaningOutput> {
  // If Python is available, execute Python cleaning script
  try {
    const scriptPath = path.resolve(process.cwd(), "scripts", "clean_employee_import.py");
    const args = [scriptPath, "--input", excelFilePath];
    if (customMapping) {
      args.push("--mapping", JSON.stringify(customMapping));
    }

    const result = await new Promise<PythonCleaningOutput>((resolve, reject) => {
      const pyProcess = spawn(PYTHON_PATH, args);

      let stdout = "";
      let stderr = "";

      pyProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pyProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      pyProcess.on("error", (err) => {
        reject(err);
      });

      pyProcess.on("close", (code) => {
        if (code !== 0 && !stdout) {
          return reject(new Error(`Python data cleaning failed (${code}): ${stderr}`));
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Failed to parse Python cleaning output: ${stdout || stderr}`));
        }
      });
    });

    if (result && result.success) {
      return result;
    }
  } catch (err) {
    console.warn("Python environment not available on host, utilizing native cleaning engine:", err);
  }

  // Pure TypeScript fallback for cloud environments without Python (Cloudflare, Vercel, etc.)
  return runNativeCleaningPipeline(excelFilePath, customMapping);
}

export async function processAndStageEmployeeImport(
  filePath: string,
  fileName: string,
  fileSize: number,
  customMapping?: Record<string, string>
) {
  const cleaningResult = await runPythonCleaningPipeline(filePath, customMapping);

  if (!cleaningResult.success) {
    throw new Error(cleaningResult.error || "Failed to clean Excel data.");
  }

  // Stage import record in database
  const stagedImport = await db.employeeImport.create({
    data: {
      fileName,
      fileSize,
      totalRows: cleaningResult.totalRows,
      successfulRows: cleaningResult.validCount,
      failedRows: cleaningResult.invalidCount,
      status: "PREVIEW",
      rows: {
        create: cleaningResult.rows.map((r) => ({
          rowNumber: r.rowNumber,
          rawData: JSON.stringify(r.rawData),
          cleanedData: JSON.stringify(r.cleanedData),
          employeeCode: r.cleanedData.employeeCode || null,
          status: r.status,
          validationNotes: r.validationNotes.join("; "),
        })),
      },
    },
    include: {
      rows: true,
    },
  });

  return {
    importId: stagedImport.id,
    cleaningResult,
  };
}

export async function commitEmployeeImport(
  importId: string,
  mode: "ADD_ONLY" | "ADD_AND_UPDATE" | "VALIDATE_ONLY" = "ADD_AND_UPDATE"
) {
  const importRecord = await db.employeeImport.findUnique({
    where: { id: importId },
    include: { rows: true },
  });

  if (!importRecord) {
    throw new Error("Import batch not found");
  }

  if (importRecord.status === "COMMITTED") {
    throw new Error("This import batch has already been committed to the database.");
  }

  // Fetch shifts for lookup
  const shifts = await db.shift.findMany();
  const shiftMap = new Map(shifts.map((s) => [s.name.toLowerCase(), s.id]));
  const defaultShift = shifts.find((s) => s.isDefault) || shifts[0];

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of importRecord.rows) {
    if (row.status === "INVALID") {
      failedCount++;
      continue;
    }

    const data: CleanedRowData = JSON.parse(row.cleanedData);
    if (!data.employeeCode) {
      failedCount++;
      continue;
    }

    if (mode === "VALIDATE_ONLY") {
      continue;
    }

    // Resolve shift
    let assignedShiftId: string | null = null;
    if (data.shiftName && shiftMap.has(data.shiftName.toLowerCase())) {
      assignedShiftId = shiftMap.get(data.shiftName.toLowerCase())!;
    } else if (defaultShift) {
      assignedShiftId = defaultShift.id;
    }

    const existingEmp = await db.employee.findUnique({
      where: { employeeCode: data.employeeCode },
    });

    if (existingEmp) {
      if (mode === "ADD_ONLY") {
        skippedCount++;
        continue;
      }

      // ADD_AND_UPDATE mode
      await db.employee.update({
        where: { id: existingEmp.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || existingEmp.phone,
          department: data.department,
          designation: data.designation,
          joiningDate: new Date(data.joiningDate),
          baseSalary: data.baseSalary,
          hourlyRate: data.hourlyRate,
          shiftId: assignedShiftId || existingEmp.shiftId,
          status: data.status === "ACTIVE" ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE,
        },
      });
      updatedCount++;
    } else {
      // Create new
      await db.employee.create({
        data: {
          employeeCode: data.employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || null,
          department: data.department,
          designation: data.designation,
          joiningDate: new Date(data.joiningDate),
          baseSalary: data.baseSalary,
          hourlyRate: data.hourlyRate,
          shiftId: assignedShiftId,
          status: data.status === "ACTIVE" ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE,
        },
      });
      createdCount++;
    }
  }

  // Update import status
  await db.employeeImport.update({
    where: { id: importId },
    data: {
      status: mode === "VALIDATE_ONLY" ? "VALIDATED" : "COMMITTED",
      importMode: mode,
      createdCount,
      updatedCount,
      skippedRows: skippedCount,
      failedRows: failedCount,
      successfulRows: createdCount + updatedCount,
    },
  });

  await logAuditAction({
    action: "EMPLOYEE_IMPORT",
    entity: "EmployeeImport",
    entityId: importId,
    metadata: {
      fileName: importRecord.fileName,
      mode,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
    },
  });

  return {
    success: true,
    createdCount,
    updatedCount,
    skippedCount,
    failedCount,
  };
}
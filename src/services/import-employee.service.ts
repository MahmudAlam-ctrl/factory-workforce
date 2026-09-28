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

export async function runPythonCleaningPipeline(
  excelFilePath: string,
  customMapping?: Record<string, string>
): Promise<PythonCleaningOutput> {
  const scriptPath = path.resolve(process.cwd(), "scripts", "clean_employee_import.py");

  const args = [scriptPath, "--input", excelFilePath];
  if (customMapping) {
    args.push("--mapping", JSON.stringify(customMapping));
  }

  return new Promise((resolve, reject) => {
    const pyProcess = spawn(PYTHON_PATH, args);

    let stdout = "";
    let stderr = "";

    pyProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pyProcess.stderr.on("data", (data) => {
      stderr += data.toString();
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
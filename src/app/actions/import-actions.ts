"use server";

import {
  processAndStageEmployeeImport,
  commitEmployeeImport,
} from "@/services/import-employee.service";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import os from "os";

export async function uploadAndProcessImport(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No Excel file uploaded" };
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return { success: false, error: "File must be an Excel spreadsheet (.xlsx)" };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to temp folder for Python worker
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `fw_import_${Date.now()}_${file.name}`);
    await fs.writeFile(tempFilePath, buffer);

    const mappingRaw = formData.get("mapping");
    const customMapping = mappingRaw ? JSON.parse(String(mappingRaw)) : undefined;

    const staged = await processAndStageEmployeeImport(
      tempFilePath,
      file.name,
      file.size,
      customMapping
    );

    // Clean up temp file
    await fs.unlink(tempFilePath).catch(() => {});

    return {
      success: true,
      importId: staged.importId,
      preview: staged.cleaningResult,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process Excel import";
    return { success: false, error: message };
  }
}

export async function commitImportBatch(
  importId: string,
  mode: "ADD_ONLY" | "ADD_AND_UPDATE" | "VALIDATE_ONLY" = "ADD_AND_UPDATE"
) {
  try {
    const res = await commitEmployeeImport(importId, mode);

    revalidatePath("/employees");
    revalidatePath("/dashboard");

    return { ...res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to commit employee import";
    return { success: false, error: message };
  }
}
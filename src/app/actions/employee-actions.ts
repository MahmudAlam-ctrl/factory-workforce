"use server";

import { db } from "@/lib/db";
import { EmployeeStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const EmployeeSchema = z.object({
  employeeCode: z.string().min(3, "Employee Code must be at least 3 characters"),
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  department: z.string().min(2, "Department is required"),
  designation: z.string().min(2, "Designation is required"),
  joiningDate: z.string().default(() => new Date().toISOString()),
  baseSalary: z.coerce.number().positive("Base salary must be positive"),
  hourlyRate: z.coerce.number().positive("Hourly rate must be positive"),
  shiftId: z.string().nullable().optional(),
});

export async function createEmployee(formData: FormData) {
  try {
    const rawData = {
      employeeCode: formData.get("employeeCode"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      department: formData.get("department"),
      designation: formData.get("designation"),
      joiningDate: formData.get("joiningDate") || new Date().toISOString().split("T")[0],
      baseSalary: formData.get("baseSalary"),
      hourlyRate: formData.get("hourlyRate"),
      shiftId: formData.get("shiftId") ? String(formData.get("shiftId")) : null,
    };

    const parsed = EmployeeSchema.parse(rawData);

    // Check unique employeeCode
    const existing = await db.employee.findUnique({
      where: { employeeCode: parsed.employeeCode },
    });

    if (existing) {
      return { success: false, error: `Employee code "${parsed.employeeCode}" is already taken.` };
    }

    await db.employee.create({
      data: {
        employeeCode: parsed.employeeCode,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        department: parsed.department,
        designation: parsed.designation,
        joiningDate: new Date(parsed.joiningDate),
        baseSalary: parsed.baseSalary,
        hourlyRate: parsed.hourlyRate,
        shiftId: parsed.shiftId || null,
        status: EmployeeStatus.ACTIVE,
      },
    });

    revalidatePath("/employees");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Validation failed" };
    }
    const message = err instanceof Error ? err.message : "Failed to create employee";
    return { success: false, error: message };
  }
}

export async function updateEmployee(id: string, formData: FormData) {
  try {
    const rawData = {
      employeeCode: formData.get("employeeCode"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      department: formData.get("department"),
      designation: formData.get("designation"),
      joiningDate: formData.get("joiningDate"),
      baseSalary: formData.get("baseSalary"),
      hourlyRate: formData.get("hourlyRate"),
      shiftId: formData.get("shiftId") ? String(formData.get("shiftId")) : null,
    };

    const parsed = EmployeeSchema.parse(rawData);

    const statusVal = formData.get("status") === "INACTIVE" ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE;

    await db.employee.update({
      where: { id },
      data: {
        employeeCode: parsed.employeeCode,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        department: parsed.department,
        designation: parsed.designation,
        joiningDate: new Date(parsed.joiningDate),
        baseSalary: parsed.baseSalary,
        hourlyRate: parsed.hourlyRate,
        shiftId: parsed.shiftId || null,
        status: statusVal,
      },
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Validation failed" };
    }
    const message = err instanceof Error ? err.message : "Failed to update employee";
    return { success: false, error: message };
  }
}

export async function toggleEmployeeStatus(id: string, currentStatus: EmployeeStatus) {
  try {
    const nextStatus = currentStatus === EmployeeStatus.ACTIVE ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE;
    await db.employee.update({
      where: { id },
      data: { status: nextStatus },
    });

    revalidatePath("/employees");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to toggle status";
    return { success: false, error: message };
  }
}
import { PrismaClient, EmployeeStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding initial factory data...");

  // 1. Create Default Shifts
  const generalShift = await prisma.shift.upsert({
    where: { name: "General Shift" },
    update: {},
    create: {
      name: "General Shift",
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      standardHours: 8.0,
      gracePeriodMinutes: 15,
      isDefault: true,
    },
  });

  const morningShift = await prisma.shift.upsert({
    where: { name: "Morning Shift" },
    update: {},
    create: {
      name: "Morning Shift",
      startTime: "07:00",
      endTime: "16:00",
      breakMinutes: 60,
      standardHours: 8.0,
      gracePeriodMinutes: 15,
      isDefault: false,
    },
  });

  const eveningShift = await prisma.shift.upsert({
    where: { name: "Evening Shift" },
    update: {},
    create: {
      name: "Evening Shift",
      startTime: "14:00",
      endTime: "23:00",
      breakMinutes: 60,
      standardHours: 8.0,
      gracePeriodMinutes: 15,
      isDefault: false,
    },
  });

  console.log("Seeded Shifts:", [generalShift.name, morningShift.name, eveningShift.name]);

  // 2. Create Garment Factory Workers
  const employees = [
    {
      employeeCode: "EMP-1001",
      firstName: "Tariqul",
      lastName: "Islam",
      department: "Sewing",
      designation: "Sewing Machine Operator",
      baseSalary: 15000.0,
      hourlyRate: 72.12,
      shiftId: generalShift.id,
    },
    {
      employeeCode: "EMP-1002",
      firstName: "Rina",
      lastName: "Akter",
      department: "Sewing",
      designation: "Sewing Machine Operator",
      baseSalary: 14500.0,
      hourlyRate: 69.71,
      shiftId: generalShift.id,
    },
    {
      employeeCode: "EMP-1003",
      firstName: "Jahid",
      lastName: "Hasan",
      department: "Cutting",
      designation: "Cutting Helper",
      baseSalary: 12500.0,
      hourlyRate: 60.1,
      shiftId: generalShift.id,
    },
    {
      employeeCode: "EMP-1004",
      firstName: "Nasima",
      lastName: "Begum",
      department: "Quality",
      designation: "Quality Inspector",
      baseSalary: 16000.0,
      hourlyRate: 76.92,
      shiftId: generalShift.id,
    },
    {
      employeeCode: "EMP-1005",
      firstName: "Selim",
      lastName: "Reza",
      department: "Sewing",
      designation: "Line Supervisor",
      baseSalary: 24000.0,
      hourlyRate: 115.38,
      shiftId: generalShift.id,
    },
    {
      employeeCode: "EMP-1006",
      firstName: "Monir",
      lastName: "Hossain",
      department: "Finishing",
      designation: "Iron Operator",
      baseSalary: 13500.0,
      hourlyRate: 64.9,
      shiftId: generalShift.id,
    },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { employeeCode: emp.employeeCode },
      update: {},
      create: {
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        department: emp.department,
        designation: emp.designation,
        baseSalary: emp.baseSalary,
        hourlyRate: emp.hourlyRate,
        shiftId: emp.shiftId,
        status: EmployeeStatus.ACTIVE,
      },
    });
  }

  console.log(`Seeded ${employees.length} factory employees.`);
  console.log("Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

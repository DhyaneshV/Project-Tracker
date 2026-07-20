import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config();

// ─── DynamoDB Client Setup ───────────────────────────────────────────────────

const region = process.env.AWS_REGION || "ap-south-1";
const client = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: true,
    convertClassInstanceToMap: true,
  },
});

const SALARY_STRUCTURES_TABLE = process.env.SALARY_STRUCTURES_TABLE || "SalaryStructures";
const PAYROLL_RUNS_TABLE = process.env.PAYROLL_RUNS_TABLE || "PayrollRuns";
const PAYSLIPS_TABLE = process.env.PAYSLIPS_TABLE || "Payslips";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SalaryStructure {
  userId: string;
  orgId: string;
  basicPay: number;
  hraPercentage: number; // default 40
  conveyanceAllowance: number;
  medicalAllowance: number;
  specialAllowance: number;
  pfEnabled: boolean;
  esiEnabled: boolean;
  ptEnabled: boolean;
  tdsPercentage: number;
  effectiveFrom?: string; // ISO date
  updatedAt: string; // ISO date
}

export interface PayslipEarning {
  label: string;
  amount: number;
}

export interface PayslipDeduction {
  label: string;
  amount: number;
}

export interface Payslip {
  userId: string;
  month: string; // YYYY-MM
  runId: string;
  employeeName: string;
  designation: string;
  department: string;
  earnings: PayslipEarning[];
  deductions: PayslipDeduction[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  workingDays: number;
  attendanceDays: number;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PAID";
  createdAt: string;
}

export interface PayrollRun {
  runId: string;
  orgId: string;
  month: string; // YYYY-MM
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PAID";
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  approvedAt?: string;
}

// ─── Employee Override for batch payroll ──────────────────────────────────────

export interface EmployeeOverride {
  userId: string;
  attendanceDays: number;
  totalWorkingDays: number;
  overtime?: number;
  bonus?: number;
  incentives?: number;
  employeeName?: string;
  designation?: string;
  department?: string;
}

// ─── Salary Structure CRUD ───────────────────────────────────────────────────

export async function setSalaryStructure(
  userId: string,
  structure: Omit<SalaryStructure, "userId" | "updatedAt">
): Promise<SalaryStructure> {
  if (!userId) throw new Error("userId is required");
  if (!structure.orgId) throw new Error("orgId is required");
  if (structure.basicPay == null || structure.basicPay < 0) {
    throw new Error("basicPay must be a non-negative number");
  }

  const item: SalaryStructure = {
    userId,
    orgId: structure.orgId,
    basicPay: structure.basicPay,
    hraPercentage: structure.hraPercentage ?? 40,
    conveyanceAllowance: structure.conveyanceAllowance ?? 0,
    medicalAllowance: structure.medicalAllowance ?? 0,
    specialAllowance: structure.specialAllowance ?? 0,
    pfEnabled: structure.pfEnabled ?? true,
    esiEnabled: structure.esiEnabled ?? false,
    ptEnabled: structure.ptEnabled ?? true,
    tdsPercentage: structure.tdsPercentage ?? 0,
    effectiveFrom: structure.effectiveFrom || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: SALARY_STRUCTURES_TABLE,
      Item: item,
    })
  );

  return item;
}

export async function getSalaryStructure(userId: string): Promise<SalaryStructure | null> {
  if (!userId) throw new Error("userId is required");

  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: SALARY_STRUCTURES_TABLE,
      Key: { userId },
    })
  );

  return (result.Item as SalaryStructure) || null;
}

export async function getAllSalaryStructures(orgId: string): Promise<SalaryStructure[]> {
  if (!orgId) throw new Error("orgId is required");

  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: SALARY_STRUCTURES_TABLE,
      IndexName: "orgId-index",
      KeyConditionExpression: "orgId = :orgId",
      ExpressionAttributeValues: { ":orgId": orgId },
    })
  );

  return (result.Items as SalaryStructure[]) || [];
}

// ─── Payroll Calculation Logic (Indian Standards) ────────────────────────────

export interface PayrollCalculationResult {
  grossPay: number;
  netPay: number;
  earnings: PayslipEarning[];
  deductions: PayslipDeduction[];
  totalDeductions: number;
}

export async function calculatePayroll(
  userId: string,
  month: string,
  attendanceDays: number,
  totalWorkingDays: number,
  overtime: number = 0,
  bonus: number = 0,
  incentives: number = 0
): Promise<PayrollCalculationResult> {
  if (!userId) throw new Error("userId is required");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("month must be in YYYY-MM format");
  }
  if (attendanceDays < 0 || totalWorkingDays <= 0) {
    throw new Error("Invalid attendance or working days");
  }
  if (attendanceDays > totalWorkingDays) {
    throw new Error("attendanceDays cannot exceed totalWorkingDays");
  }

  const structure = await getSalaryStructure(userId);
  if (!structure) {
    throw new Error(`Salary structure not found for userId: ${userId}`);
  }

  return computePayroll(structure, attendanceDays, totalWorkingDays, overtime, bonus, incentives);
}

function computePayroll(
  structure: SalaryStructure,
  attendanceDays: number,
  totalWorkingDays: number,
  overtime: number,
  bonus: number,
  incentives: number
): PayrollCalculationResult {
  const proRateFactor = attendanceDays / totalWorkingDays;

  // Earnings calculation
  const basicEarned = round(structure.basicPay * proRateFactor);
  const hra = round((structure.basicPay * structure.hraPercentage / 100) * proRateFactor);
  const conveyance = round(structure.conveyanceAllowance * proRateFactor);
  const medical = round(structure.medicalAllowance * proRateFactor);
  const special = round(structure.specialAllowance * proRateFactor);

  const earnings: PayslipEarning[] = [
    { label: "Basic Pay", amount: basicEarned },
    { label: "HRA", amount: hra },
    { label: "Conveyance Allowance", amount: conveyance },
    { label: "Medical Allowance", amount: medical },
    { label: "Special Allowance", amount: special },
  ];

  if (overtime > 0) earnings.push({ label: "Overtime", amount: round(overtime) });
  if (bonus > 0) earnings.push({ label: "Bonus", amount: round(bonus) });
  if (incentives > 0) earnings.push({ label: "Incentives", amount: round(incentives) });

  const grossPay = round(basicEarned + hra + conveyance + medical + special + overtime + bonus + incentives);

  // Deductions calculation
  const deductions: PayslipDeduction[] = [];
  let totalDeductions = 0;

  // PF: 12% of basic, capped at basic 15000 (max PF = 1800/month)
  if (structure.pfEnabled) {
    const pfBasic = Math.min(basicEarned, 15000 * proRateFactor);
    const pf = round(pfBasic * 0.12);
    deductions.push({ label: "Provident Fund (PF)", amount: pf });
    totalDeductions += pf;
  }

  // ESI: 0.75% of gross if gross <= 21000/month
  if (structure.esiEnabled && grossPay <= 21000) {
    const esi = round(grossPay * 0.0075);
    deductions.push({ label: "ESI", amount: esi });
    totalDeductions += esi;
  }

  // PT: Professional Tax (Karnataka) - 200/month if gross > 15000
  if (structure.ptEnabled && grossPay > 15000) {
    const pt = 200;
    deductions.push({ label: "Professional Tax (PT)", amount: pt });
    totalDeductions += pt;
  }

  // TDS: percentage of gross as set by HR
  if (structure.tdsPercentage > 0) {
    const tds = round(grossPay * structure.tdsPercentage / 100);
    deductions.push({ label: "TDS (Income Tax)", amount: tds });
    totalDeductions += tds;
  }

  totalDeductions = round(totalDeductions);
  const netPay = round(grossPay - totalDeductions);

  return { grossPay, netPay, earnings, deductions, totalDeductions };
}

// ─── Monthly Payroll Run ─────────────────────────────────────────────────────

export async function runMonthlyPayroll(
  orgId: string,
  month: string,
  runBy: string,
  employeeOverrides: EmployeeOverride[]
): Promise<PayrollRun> {
  if (!orgId) throw new Error("orgId is required");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("month must be in YYYY-MM format");
  }
  if (!runBy) throw new Error("runBy is required");
  if (!employeeOverrides || employeeOverrides.length === 0) {
    throw new Error("employeeOverrides must contain at least one employee");
  }

  const runId = `PR-${randomUUID()}`;
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  // Process each employee
  for (const override of employeeOverrides) {
    const structure = await getSalaryStructure(override.userId);
    if (!structure) {
      console.warn(`Skipping userId ${override.userId}: no salary structure found`);
      continue;
    }

    const result = computePayroll(
      structure,
      override.attendanceDays,
      override.totalWorkingDays,
      override.overtime || 0,
      override.bonus || 0,
      override.incentives || 0
    );

    const payslip: Payslip = {
      userId: override.userId,
      month,
      runId,
      employeeName: override.employeeName || "",
      designation: override.designation || "",
      department: override.department || "",
      earnings: result.earnings,
      deductions: result.deductions,
      grossPay: result.grossPay,
      totalDeductions: result.totalDeductions,
      netPay: result.netPay,
      workingDays: override.totalWorkingDays,
      attendanceDays: override.attendanceDays,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: PAYSLIPS_TABLE,
        Item: payslip,
      })
    );

    totalGross += result.grossPay;
    totalDeductions += result.totalDeductions;
    totalNet += result.netPay;
  }

  const payrollRun: PayrollRun = {
    runId,
    orgId,
    month,
    status: "PENDING_APPROVAL",
    totalEmployees: employeeOverrides.length,
    totalGross: round(totalGross),
    totalDeductions: round(totalDeductions),
    totalNet: round(totalNet),
    createdBy: runBy,
    createdAt: new Date().toISOString(),
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: PAYROLL_RUNS_TABLE,
      Item: payrollRun,
    })
  );

  return payrollRun;
}

// ─── Approve Payroll Run ─────────────────────────────────────────────────────

export async function approvePayrollRun(
  runId: string,
  approvedBy: string
): Promise<PayrollRun> {
  if (!runId) throw new Error("runId is required");
  if (!approvedBy) throw new Error("approvedBy is required");

  const existing = await getPayrollRun(runId);
  if (!existing) {
    throw new Error(`Payroll run not found: ${runId}`);
  }
  if (existing.status !== "PENDING_APPROVAL") {
    throw new Error(`Cannot approve run with status: ${existing.status}. Must be PENDING_APPROVAL.`);
  }

  const approvedAt = new Date().toISOString();

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: PAYROLL_RUNS_TABLE,
      Key: { runId },
      UpdateExpression: "SET #status = :status, approvedBy = :approvedBy, approvedAt = :approvedAt",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "APPROVED",
        ":approvedBy": approvedBy,
        ":approvedAt": approvedAt,
      },
    })
  );

  return {
    ...existing,
    status: "APPROVED",
    approvedBy,
    approvedAt,
  };
}

// ─── Get Payroll Run ─────────────────────────────────────────────────────────

export async function getPayrollRun(runId: string): Promise<PayrollRun | null> {
  if (!runId) throw new Error("runId is required");

  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: PAYROLL_RUNS_TABLE,
      Key: { runId },
    })
  );

  return (result.Item as PayrollRun) || null;
}

// ─── Get Payroll History ─────────────────────────────────────────────────────

export async function getPayrollHistory(orgId: string): Promise<PayrollRun[]> {
  if (!orgId) throw new Error("orgId is required");

  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: PAYROLL_RUNS_TABLE,
      IndexName: "orgId-index",
      KeyConditionExpression: "orgId = :orgId",
      ExpressionAttributeValues: { ":orgId": orgId },
      ScanIndexForward: false, // newest first
    })
  );

  return (result.Items as PayrollRun[]) || [];
}

// ─── Get Payslip ─────────────────────────────────────────────────────────────

export async function getPayslip(userId: string, month: string): Promise<Payslip | null> {
  if (!userId) throw new Error("userId is required");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("month must be in YYYY-MM format");
  }

  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: PAYSLIPS_TABLE,
      Key: { userId, month },
    })
  );

  return (result.Item as Payslip) || null;
}

// ─── Get All Payslips for User ───────────────────────────────────────────────

export async function getPayslipsForUser(userId: string): Promise<Payslip[]> {
  if (!userId) throw new Error("userId is required");

  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: PAYSLIPS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      ScanIndexForward: false, // newest first
    })
  );

  return (result.Items as Payslip[]) || [];
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

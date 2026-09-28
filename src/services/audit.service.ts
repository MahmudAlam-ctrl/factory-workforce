import { db } from "@/lib/db";

export interface LogAuditParams {
  action: string;
  entity: string;
  entityId?: string | null;
  actor?: string;
  metadata?: Record<string, any> | string | null;
}

export async function logAuditAction(params: LogAuditParams) {
  try {
    const metaString =
      typeof params.metadata === "object" && params.metadata !== null
        ? JSON.stringify(params.metadata)
        : typeof params.metadata === "string"
        ? params.metadata
        : null;

    return await db.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        actor: params.actor || "Admin",
        metadata: metaString,
      },
    });
  } catch (err) {
    console.error("Failed to record audit log:", err);
    return null;
  }
}

export async function getRecentAuditLogs(limit = 100) {
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
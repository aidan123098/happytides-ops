import type { AuditEntityType, Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AuditInput = {
  actor?: SessionUser;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  request?: Request;
};

const sensitiveKeys = new Set(["password", "passwordHash", "token", "tokenHash", "secret", "secretHash", "accessToken", "webhookSignatureKey"]);

function redact(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;

  return JSON.parse(
    JSON.stringify(value, (key, nestedValue) => {
      if (sensitiveKeys.has(key)) {
        return "[REDACTED]";
      }

      return nestedValue;
    })
  ) as Prisma.InputJsonValue;
}

export async function writeAuditLog(input: AuditInput, tx: Prisma.TransactionClient = prisma) {
  return tx.auditLog.create({
    data: {
      actorId: input.actor?.id,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: redact(input.before),
      after: redact(input.after),
      metadata: redact(input.metadata),
      ipAddress: input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: input.request?.headers.get("user-agent")
    }
  });
}

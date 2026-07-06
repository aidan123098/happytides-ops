import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth-constants";

export type Permission =
  | "dashboard:read"
  | "products:manage"
  | "inventory:read"
  | "inventory:manage"
  | "inventory:release"
  | "customers:read"
  | "customers:manage"
  | "orders:create"
  | "orders:read"
  | "orders:manage"
  | "orders:cancel"
  | "payments:read"
  | "payments:record"
  | "refunds:create"
  | "reports:read"
  | "exports:create"
  | "users:manage"
  | "integrations:manage"
  | "settings:manage"
  | "audit:read";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: RoleName[];
};

const tokenPrefix = "hts_";
const offlineDevUserId = "dev-offline-owner";
const offlineDevToken = `${tokenPrefix}offline_dev`;
const offlineDevUser: SessionUser = {
  id: offlineDevUserId,
  name: "Local Dev Owner",
  email: "owner@happytides.local",
  roles: ["OWNER" as RoleName]
};
const hostedDemoEmail = "aidan@happytides.co";
const hostedDemoPassword = "aidan";
const hostedDemoUser: SessionUser = {
  id: "hosted-demo-owner",
  name: "Aidan",
  email: hostedDemoEmail,
  roles: ["OWNER" as RoleName]
};

const rolePermissions: Record<RoleName, Permission[]> = {
  OWNER: [
    "dashboard:read",
    "products:manage",
    "inventory:read",
    "inventory:manage",
    "inventory:release",
    "customers:read",
    "customers:manage",
    "orders:create",
    "orders:read",
    "orders:manage",
    "orders:cancel",
    "payments:read",
    "payments:record",
    "refunds:create",
    "reports:read",
    "exports:create",
    "users:manage",
    "integrations:manage",
    "settings:manage",
    "audit:read"
  ],
  OPERATIONS_ADMIN: [
    "dashboard:read",
    "products:manage",
    "inventory:read",
    "inventory:manage",
    "inventory:release",
    "customers:read",
    "customers:manage",
    "orders:create",
    "orders:read",
    "orders:manage",
    "orders:cancel",
    "payments:read",
    "payments:record",
    "reports:read",
    "exports:create",
    "integrations:manage",
    "settings:manage",
    "audit:read"
  ],
  SALES: ["dashboard:read", "customers:read", "customers:manage", "orders:create", "orders:read", "orders:manage", "payments:read", "reports:read"],
  WAREHOUSE: ["dashboard:read", "inventory:read", "inventory:manage", "orders:read", "orders:manage"],
  FINANCE: ["dashboard:read", "customers:read", "orders:read", "payments:read", "payments:record", "refunds:create", "reports:read", "exports:create"],
  VIEWER: ["dashboard:read", "customers:read", "orders:read", "inventory:read", "payments:read", "reports:read"],
  WHOLESALE_PORTAL: ["orders:read", "payments:read"],
  ADMIN: [
    "dashboard:read",
    "products:manage",
    "inventory:read",
    "inventory:manage",
    "customers:read",
    "customers:manage",
    "orders:create",
    "orders:read",
    "orders:manage",
    "payments:read",
    "reports:read"
  ],
  STAFF: ["dashboard:read", "customers:read", "orders:create", "orders:read", "inventory:read"]
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isDatabaseUnavailable(error: unknown) {
  return error instanceof Error && error.message.includes("Can't reach database server");
}

function canUseOfflineDevAuth() {
  return process.env.NODE_ENV !== "production";
}

function canUseHostedDemoAuth() {
  return process.env.NODE_ENV === "production" && !process.env.DATABASE_URL;
}

function publicUser(user: {
  id: string;
  name: string;
  displayName: string | null;
  email: string;
  roles: Array<{ role: { name: RoleName } }>;
}): SessionUser {
  return {
    id: user.id,
    name: user.displayName || user.name,
    email: user.email,
    roles: user.roles.map((role) => role.role.name)
  };
}

export async function authenticateStaffUser(email: string, password: string, request?: Request): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (canUseHostedDemoAuth()) {
    return normalizedEmail === hostedDemoEmail && password === hostedDemoPassword ? hostedDemoUser : null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { roles: { include: { role: true } } }
    });

    const passwordMatches = Boolean(user?.passwordHash) && (await bcrypt.compare(password, user?.passwordHash ?? ""));
    const active = Boolean(user && user.active && user.status === "ACTIVE" && !user.archivedAt);
    const success = Boolean(user && passwordMatches && active);

    await prisma.loginAttempt.create({
      data: {
        userId: user?.id,
        email: normalizedEmail,
        success,
        reason: success ? null : active ? "invalid_credentials" : "inactive_or_missing_user",
        ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request?.headers.get("user-agent")
      }
    });

    if (!success || !user) {
      return null;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastActiveAt: new Date() }
    });

    return publicUser(user);
  } catch (error) {
    if (canUseOfflineDevAuth() && isDatabaseUnavailable(error) && normalizedEmail && password) {
      return { ...offlineDevUser, email: normalizedEmail };
    }
    throw error;
  }
}

export async function createSessionToken(user: SessionUser, request?: Request) {
  if (canUseOfflineDevAuth() && user.id === offlineDevUserId) {
    return offlineDevToken;
  }
  if (canUseHostedDemoAuth() && user.id === hostedDemoUser.id) {
    return offlineDevToken;
  }

  const token = `${tokenPrefix}${crypto.randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request?.headers.get("user-agent")
    }
  });

  return token;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || !token.startsWith(tokenPrefix)) return null;
  if (canUseOfflineDevAuth() && token === offlineDevToken) return offlineDevUser;
  if (canUseHostedDemoAuth() && token === offlineDevToken) return hostedDemoUser;

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          include: { roles: { include: { role: true } } }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    if (!session.user.active || session.user.status !== "ACTIVE" || session.user.archivedAt) {
      return null;
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { lastActiveAt: new Date() }
    });

    return publicUser(session.user);
  } catch (error) {
    if (canUseOfflineDevAuth() && isDatabaseUnavailable(error)) return offlineDevUser;
    throw error;
  }
}

export async function revokeSessionToken(token: string | undefined) {
  if (!token) return;
  if (canUseOfflineDevAuth() && token === offlineDevToken) return;
  if (canUseHostedDemoAuth() && token === offlineDevToken) return;

  try {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  } catch (error) {
    if (!canUseOfflineDevAuth() || !isDatabaseUnavailable(error)) throw error;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = await verifySessionToken(token);

  if (!user && canUseOfflineDevAuth() && token) {
    return offlineDevUser;
  }

  return user;
}

export function hasPermission(user: SessionUser, permission: Permission) {
  return user.roles.some((role) => rolePermissions[role]?.includes(permission));
}

export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }

  return user;
}

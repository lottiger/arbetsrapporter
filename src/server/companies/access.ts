import "server-only";
import type { Db } from "mongodb";
import type { AppAuth } from "../auth/factory.ts";

export type CompanyRole = "reporter" | "company_admin" | "billing";
export type Organization = { _id: string; name: string; status: "active" | "suspended"; createdAt: Date };
export type Membership = {
  _id: string;
  organizationId: string;
  userId: string;
  roles: CompanyRole[];
  status: "active" | "suspended";
  createdAt: Date;
};

export class AccessError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(status === 401 ? "Du behöver logga in." : "Du saknar åtkomst till företaget eller funktionen.");
    this.status = status;
  }
}

export async function requireSession(auth: AppAuth, headers: Headers) {
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!session) throw new AccessError(401);
  return session;
}

export async function listCompanies(auth: AppAuth, db: Db, headers: Headers) {
  const session = await requireSession(auth, headers);
  const memberships = await db.collection<Membership>("memberships").find({
    userId: session.user.id, status: "active",
  }).toArray();
  const companies = await db.collection<Organization>("organizations").find({
    _id: { $in: memberships.map((member) => member.organizationId) }, status: "active",
  }).sort({ name: 1 }).toArray();
  return companies.map((company) => ({
    id: company._id,
    name: company.name,
    roles: memberships.find((member) => member.organizationId === company._id)!.roles,
  }));
}

export async function requireCompanyAccess(
  auth: AppAuth,
  db: Db,
  headers: Headers,
  organizationId: string,
  allowedRoles?: readonly CompanyRole[],
) {
  const session = await requireSession(auth, headers);
  if (!organizationId || organizationId.length > 80) throw new AccessError(403);
  const membership = await db.collection<Membership>("memberships").findOne({
    organizationId, userId: session.user.id, status: "active",
  });
  if (!membership || !membership.roles.length ||
    (allowedRoles && !membership.roles.some((role) => allowedRoles.includes(role)))) {
    throw new AccessError(403);
  }
  const company = await db.collection<Organization>("organizations").findOne({
    _id: organizationId, status: "active",
  });
  if (!company) throw new AccessError(403);
  return { user: session.user, membership, company };
}

export function homeForRoles(roles: readonly CompanyRole[]) {
  if (roles.includes("company_admin")) return "/admin/granskning";
  if (roles.includes("reporter")) return "/rapportor";
  if (roles.includes("billing")) return "/admin/underlag";
  return "/ingen-behorighet";
}

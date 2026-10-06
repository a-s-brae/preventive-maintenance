// Who can do what. Three roles:
//   ADMIN      supervisors — everything, including setup and reviewing requests
//   TECH       maintenance — see everything and do / record the work
//   REQUESTER  everyone else — report problems and follow their own requests
import type { Role } from "@prisma/client";

const RULES = {
  /** Report a problem. */
  report: ["ADMIN", "TECH", "REQUESTER"],
  /** See work orders, assets, PM schedules, parts, history. */
  view: ["ADMIN", "TECH"],
  /** Create and do work orders: start, complete, log time, use parts, add photos,
   *  mark equipment down/up, record meters, start a PM early, restock parts. */
  work: ["ADMIN", "TECH"],
  /** Approve or reject requests. */
  review: ["ADMIN"],
  /** Set up the system: assets, locations, PM schedules, the parts list, deleting things. */
  manage: ["ADMIN"],
  /** Manage people and their roles. */
  people: ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof RULES;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (RULES[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", TECH: "Technician", REQUESTER: "Requester" };

export const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Everything, including setup (assets, PM schedules, parts list), reviewing requests and managing people.",
  TECH: "Sees everything; creates and completes work orders, logs time and parts, marks equipment down and up.",
  REQUESTER: "Reports problems and follows their own requests.",
};

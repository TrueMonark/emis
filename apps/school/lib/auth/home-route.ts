import { Role } from "@school/shared/types/prisma-enums";
import { getRoleRoute } from "./role-routes";

/** What sign-in and /api/auth/me say about where a person works (Phase 4). */
export interface SignedInPerson {
  role: Role | string;
  hasDefaultPassword?: boolean;
  school?: { id: string; name: string; setupComplete: boolean } | null;
  office?: {
    officeId: string;
    officeName: string;
    officeType: "HQ" | "PROVINCIAL" | "DISTRICT";
    role: "OFFICE_HEAD" | "OFFICER";
    title: string | null;
  } | null;
}

/**
 * Where a person goes after signing in:
 * - on a one-time password → choose their own first;
 * - education office staff (no school) → the office pages;
 * - a school still in first-time setup → the setup wizard;
 * - everyone else → their role's dashboard.
 */
export function homeRouteFor(person: SignedInPerson): string {
  if (person.hasDefaultPassword) return "/change-password";
  if (!person.school && person.office) return "/office";
  if (person.school && !person.school.setupComplete) return "/setup";
  return getRoleRoute(person.role as Role);
}

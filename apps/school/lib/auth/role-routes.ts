import { Role } from "@school/shared/types/prisma-enums";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";

/**
 * Role-based routing configuration
 * Maps user roles to their default dashboard routes
 * NOTE: HOD removed - HOD is a position, not a role
 * HOD dashboard access requires position-based check via Department.hodTeacherId
 */
export const ROLE_ROUTES: Record<Role, string> = {
  ADMIN: "/admin",
  HEAD_TEACHER: "/admin",
  DEPUTY_HEAD: "/admin", // same screens and rights as the head teacher
  CLERK: "/admin",
  TEACHER: "/teacher",
};

/**
 * Get the default route for a given role
 */
export function getRoleRoute(role: Role): string {
  return ROLE_ROUTES[role] || "/admin";
}

/**
 * Check if a user role has access to a given route prefix
 * NOTE: /hod routes require position-based check, not included here
 */
export function canAccessRoute(role: Role, routePrefix: string): boolean {
  if (routePrefix.startsWith("/admin")) {
    return isAdminRole(role);
  }

  if (routePrefix.startsWith("/teacher")) {
    return role === "TEACHER" || isSchoolLeader(role);
  }

  // /hod routes: allow TEACHER role — actual HOD position check is done
  // by the individual pages/APIs via Department.hodTeacherId
  if (routePrefix.startsWith("/hod")) {
    return role === "TEACHER" || isSchoolLeader(role);
  }

  return false;
}

/**
 * Roles that have access to admin routes
 */
export const ADMIN_ROLES: Role[] = ["ADMIN", "HEAD_TEACHER", "DEPUTY_HEAD", "CLERK"];

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

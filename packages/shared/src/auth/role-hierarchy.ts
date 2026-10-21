/**
 * Role Hierarchy and Permission System
 *
 * This module implements a hierarchical role system where higher roles
 * automatically inherit all permissions from lower roles.
 *
 * IMPORTANT: HOD is NOT a role - it's a position derived from Department.hodTeacherId
 * HOD-specific access is granted via UserPermission table, not role hierarchy.
 *
 * Hierarchy (highest to lowest):
 * HEAD_TEACHER = DEPUTY_HEAD -> the school's leadership: full access to the school, same rights
 *   (decided 2026-10-12). ADMIN is the old name for the head's account and is treated the same;
 *   school memberships no longer use it.
 * TEACHER -> Teaching and classroom management
 * CLERK -> Administrative tasks (parallel to TEACHER)
 * FINANCE -> School fees and money only (bursar); below everything else, no teaching or learner
 *   records. Its API access is limited to /api/finance/* (see auth/finance-access.ts).
 *
 * For "is this person in charge of the school?" use isSchoolLeader(), never a check for one
 * specific leadership role.
 */

import { Role } from '../types/prisma-enums';

/**
 * Role hierarchy levels
 * Higher number = more authority
 * NOTE: HOD removed - it's a position, not a role
 */
export const ROLE_HIERARCHY = {
  ADMIN: 4,
  HEAD_TEACHER: 4,
  DEPUTY_HEAD: 4, // same rights as the head teacher
  TEACHER: 1,
  CLERK: 1, // Same level as teacher, different permissions
  FINANCE: 0, // fees only: never passes a teacher/clerk check
} as const;

/** The school's leadership roles: all have the same rights. */
export const SCHOOL_LEADER_ROLES: readonly Role[] = [Role.ADMIN, Role.HEAD_TEACHER, Role.DEPUTY_HEAD];

/** Whether the role is one of the school's leaders (head teacher, deputy head, or old ADMIN). */
export function isSchoolLeader(role: Role | string | null | undefined): boolean {
  return !!role && (SCHOOL_LEADER_ROLES as readonly string[]).includes(role);
}

/**
 * Check if roleA has equal or higher authority than roleB
 *
 * @example
 * hasRoleAuthority('HOD', 'TEACHER') // true - HOD is higher than TEACHER
 * hasRoleAuthority('TEACHER', 'HOD') // false - TEACHER is lower than HOD
 * hasRoleAuthority('CLERK', 'TEACHER') // true - Same level
 */
export function hasRoleAuthority(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Get all roles that a user effectively has through hierarchy
 *
 * @example
 * getEffectiveRoles('DEPUTY_HEAD') // ['DEPUTY_HEAD', 'TEACHER']
 * getEffectiveRoles('HEAD_TEACHER') // ['HEAD_TEACHER', 'DEPUTY_HEAD', 'TEACHER']
 */
export function getEffectiveRoles(role: Role): Role[] {
  const level = ROLE_HIERARCHY[role];
  const effectiveRoles: Role[] = [role];

  // Build list of inherited roles based on hierarchy: a school leader has every leadership role
  // and the teacher role.
  if (level >= ROLE_HIERARCHY.HEAD_TEACHER) {
    for (const leader of SCHOOL_LEADER_ROLES) {
      if (!effectiveRoles.includes(leader)) effectiveRoles.push(leader);
    }
    effectiveRoles.push(Role.TEACHER);
  }

  return effectiveRoles;
}

/**
 * Check if user can access a specific route based on role hierarchy
 *
 * Note: For server-side user database queries, see role-hierarchy.server.ts
 * Note: /hod routes require separate position-based checks (not role-based)
 *
 * @example
 * // DEPUTY_HEAD trying to access /teacher/dashboard
 * canAccessRoute('DEPUTY_HEAD', '/teacher/dashboard') // true
 *
 * // TEACHER trying to access /deputy-head/dashboard
 * canAccessRoute('TEACHER', '/deputy-head/dashboard') // false
 */
export function canAccessRoute(userRole: Role, route: string): boolean {
  // Determine required role from route
  if (route.startsWith('/admin')) {
    return hasRoleAuthority(userRole, Role.ADMIN);
  }
  if (route.startsWith('/head-teacher')) {
    return hasRoleAuthority(userRole, Role.HEAD_TEACHER);
  }
  if (route.startsWith('/deputy-head')) {
    return hasRoleAuthority(userRole, Role.DEPUTY_HEAD);
  }
  if (route.startsWith('/teacher')) {
    return hasRoleAuthority(userRole, Role.TEACHER);
  }
  if (route.startsWith('/clerk')) {
    return hasRoleAuthority(userRole, Role.CLERK);
  }
  // NOTE: /hod routes removed - HOD access is position-based, not role-based
  // HOD route checks should use position helpers instead

  // Public route
  return true;
}

/**
 * Get default dashboard route for a user based on their role
 * With hierarchy, users can access multiple dashboards
 * This returns the primary/default one
 * NOTE: HOD dashboard access requires position check, not role
 */
export function getDefaultDashboard(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return '/admin/overview';
    case Role.HEAD_TEACHER:
      return '/head-teacher/dashboard';
    case Role.DEPUTY_HEAD:
      return '/deputy-head/dashboard';
    case Role.TEACHER:
      return '/teacher/dashboard';
    case Role.CLERK:
      return '/admin/overview'; // Clerks use admin interface
    default:
      return '/';
  }
}

/**
 * Get all accessible dashboard routes for a user based on role hierarchy
 * NOTE: HOD dashboard not included - requires separate position-based check
 *
 * @example
 * getAccessibleDashboards('DEPUTY_HEAD')
 * // Returns: [{ label: 'Deputy Head', route: '/deputy-head/dashboard', role: 'DEPUTY_HEAD' }, { label: 'Teacher', route: '/teacher/dashboard', role: 'TEACHER' }]
 */
export function getAccessibleDashboards(role: Role): Array<{ label: string; route: string; role: Role }> {
  const effectiveRoles = getEffectiveRoles(role);
  const dashboards: Array<{ label: string; route: string; role: Role }> = [];

  if (effectiveRoles.includes(Role.ADMIN)) {
    dashboards.push({ label: 'Admin', route: '/admin/overview', role: Role.ADMIN });
  }
  if (effectiveRoles.includes(Role.HEAD_TEACHER)) {
    dashboards.push({ label: 'Head Teacher', route: '/head-teacher/dashboard', role: Role.HEAD_TEACHER });
  }
  if (effectiveRoles.includes(Role.DEPUTY_HEAD)) {
    dashboards.push({ label: 'Deputy Head', route: '/deputy-head/dashboard', role: Role.DEPUTY_HEAD });
  }
  if (effectiveRoles.includes(Role.TEACHER)) {
    dashboards.push({ label: 'Teacher', route: '/teacher/dashboard', role: Role.TEACHER });
  }
  if (effectiveRoles.includes(Role.CLERK)) {
    dashboards.push({ label: 'Administration', route: '/admin/overview', role: Role.CLERK });
  }
  // NOTE: HOD dashboard requires position check - use position helpers to add HOD dashboard

  return dashboards;
}

/**
 * Role-specific permissions
 * Define what each role can do (before hierarchy inheritance)
 * NOTE: HOD removed - HOD permissions are granted via UserPermission table
 */
export const ROLE_PERMISSIONS = {
  ADMIN: [
    'manage_users',
    'manage_system_settings',
    'view_all_data',
    'delete_records',
    'manage_roles_permissions',
  ],
  HEAD_TEACHER: [
    'close_academic_year',
    'approve_promotions',
    'manage_staff',
    'view_all_reports',
    'manage_school_settings',
  ],
  DEPUTY_HEAD: [
    'manage_discipline',
    'approve_leave_requests',
    'view_department_reports',
    'assign_class_teachers',
  ],
  TEACHER: [
    'record_attendance',
    'create_assessments',
    'enter_marks',
    'view_my_classes',
    'generate_report_cards',
    'update_timetable',
  ],
  CLERK: [
    'manage_students',
    'manage_parents',
    'enroll_students',
    'manage_classes',
    'view_records',
  ],
  FINANCE: ['manage_school_fees'],
} as const;

/**
 * Get all permissions a role has (including inherited from lower roles)
 */
export function getEffectivePermissions(role: Role): string[] {
  const effectiveRoles = getEffectiveRoles(role);
  const allPermissions = new Set<string>();

  for (const effectiveRole of effectiveRoles) {
    const permissions = ROLE_PERMISSIONS[effectiveRole] || [];
    permissions.forEach(permission => allPermissions.add(permission));
  }

  return Array.from(allPermissions);
}

/**
 * Check if a role has a specific permission (including inherited)
 */
export function roleHasPermission(role: Role, permission: string): boolean {
  const permissions = getEffectivePermissions(role);
  return permissions.includes(permission);
}

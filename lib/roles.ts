export type UserRole = 'user' | 'employee' | 'business';

export function rolesForPrimaryRole(primary: UserRole): UserRole[] {
  if (primary === 'employee') return ['employee', 'user'];
  return [primary];
}

export function normalizeRoles(
  primaryRole: string | null | undefined,
  roles: string[] | null | undefined
): UserRole[] {
  const valid = (r: string): r is UserRole =>
    r === 'user' || r === 'employee' || r === 'business';

  if (roles?.length) {
    const parsed = roles.filter(valid);
    if (parsed.length > 0) return [...new Set(parsed)];
  }

  if (primaryRole === 'provider') return ['employee', 'user'];
  if (primaryRole && valid(primaryRole)) {
    return rolesForPrimaryRole(primaryRole);
  }

  return [];
}

export function primaryRoleFromRoles(roles: UserRole[]): UserRole | null {
  if (roles.includes('employee')) return 'employee';
  if (roles.includes('business')) return 'business';
  if (roles.includes('user')) return 'user';
  return null;
}

export function hasRole(roles: UserRole[], role: UserRole): boolean {
  return roles.includes(role);
}

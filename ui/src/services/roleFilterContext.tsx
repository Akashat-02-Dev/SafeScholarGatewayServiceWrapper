import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './authService';

export type RoleFilterType = 'all' | 'teacher' | 'student' | 'institute';

export interface RoleTheme {
  name: string;
  themeColor: 'blue' | 'green' | 'violet' | 'amber' | 'slate';
  badgeLabel: string;
  gradient: string;
  badgeClass: string;
  borderClass: string;
  glowClass: string;
  hoverBorder: string;
  dotColor: string;
}

export const ROLE_THEMES: Record<string, RoleTheme> = {
  teacher: {
    name: 'Educator / Teacher',
    themeColor: 'blue',
    badgeLabel: 'Teacher (Blue)',
    gradient: 'from-blue-600 to-indigo-600',
    badgeClass: 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    borderClass: 'border-blue-200/80 dark:border-blue-900/60',
    glowClass: 'from-blue-500/10 via-indigo-500/5 to-transparent',
    hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-500',
    dotColor: 'bg-blue-500',
  },
  student: {
    name: 'Student / Learner',
    themeColor: 'green',
    badgeLabel: 'Student (Green)',
    gradient: 'from-emerald-600 to-teal-600',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    borderClass: 'border-emerald-200/80 dark:border-emerald-900/60',
    glowClass: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500',
    dotColor: 'bg-emerald-500',
  },
  institute: {
    name: 'Institute Management',
    themeColor: 'violet',
    badgeLabel: 'Institute Mgmt (Violet/Pink)',
    gradient: 'from-purple-600 via-fuchsia-600 to-pink-600',
    badgeClass: 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-pink-300 border-purple-200 dark:border-pink-800',
    borderClass: 'border-purple-200/80 dark:border-pink-900/60',
    glowClass: 'from-purple-500/12 via-pink-500/8 to-transparent',
    hoverBorder: 'hover:border-purple-400 dark:hover:border-pink-500',
    dotColor: 'bg-fuchsia-500',
  },
  superadmin: {
    name: 'Super Admin',
    themeColor: 'amber',
    badgeLabel: 'Super Admin (Amber)',
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    borderClass: 'border-amber-200/80 dark:border-amber-900/60',
    glowClass: 'from-amber-500/10 via-orange-500/5 to-transparent',
    hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-500',
    dotColor: 'bg-amber-500',
  },
  all: {
    name: 'Unified Workspace',
    themeColor: 'slate',
    badgeLabel: 'All Roles',
    gradient: 'from-slate-700 to-slate-900',
    badgeClass: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-700',
    borderClass: 'border-slate-200 dark:border-zinc-800',
    glowClass: 'from-blue-500/5 via-purple-500/5 to-emerald-500/5',
    hoverBorder: 'hover:border-slate-400',
    dotColor: 'bg-slate-400',
  },
};

interface RoleFilterContextValue {
  roleFilter: RoleFilterType;
  setRoleFilter: (filter: RoleFilterType) => void;
  isSuperAdmin: boolean;
  effectiveRole: 'teacher' | 'student' | 'institute' | 'all';
  activeTheme: RoleTheme;
}

const RoleFilterContext = createContext<RoleFilterContextValue>({
  roleFilter: 'all',
  setRoleFilter: () => {},
  isSuperAdmin: false,
  effectiveRole: 'all',
  activeTheme: ROLE_THEMES.all,
});

const STORAGE_KEY = 'safescholar_superadmin_role_filter';

export const RoleFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { me, hasRole, hasPermission } = useAuth();
  const isSuperAdmin = Boolean(
    me?.isSysAdmin || 
    hasRole('sysadmin') || 
    hasRole('superadmin') || 
    hasRole('super_admin') || 
    hasPermission('SUPER_ADMIN') ||
    me?.email?.toLowerCase() === 'admin@safescholar.com'
  );

  const [roleFilter, setRoleFilterState] = useState<RoleFilterType>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY) as RoleFilterType | null;
    if (saved && ['all', 'teacher', 'student', 'institute'].includes(saved)) {
      return saved;
    }
    return 'all';
  });

  const setRoleFilter = (filter: RoleFilterType) => {
    setRoleFilterState(filter);
    sessionStorage.setItem(STORAGE_KEY, filter);
  };

  // Determine effective role:
  // If Super Admin, respect the roleFilter. If not Super Admin, match their actual role.
  let effectiveRole: 'teacher' | 'student' | 'institute' | 'all' = 'all';
  if (isSuperAdmin) {
    effectiveRole = roleFilter;
  } else if (hasRole('teacher') || hasRole('educator')) {
    effectiveRole = 'teacher';
  } else if (hasRole('student')) {
    effectiveRole = 'student';
  } else if (hasRole('admin') || hasRole('institute')) {
    effectiveRole = 'institute';
  }

  const activeTheme = ROLE_THEMES[effectiveRole] || ROLE_THEMES.all;

  return (
    <RoleFilterContext.Provider
      value={{
        roleFilter,
        setRoleFilter,
        isSuperAdmin,
        effectiveRole,
        activeTheme,
      }}
    >
      {children}
    </RoleFilterContext.Provider>
  );
};

export const useRoleFilter = () => useContext(RoleFilterContext);

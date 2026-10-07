import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './authService';

export type RoleFilterType = 'all' | 'teacher' | 'student' | 'institute';

interface RoleFilterContextValue {
  roleFilter: RoleFilterType;
  setRoleFilter: (filter: RoleFilterType) => void;
  isSuperAdmin: boolean;
  effectiveRole: 'teacher' | 'student' | 'institute' | 'all';
}

const RoleFilterContext = createContext<RoleFilterContextValue>({
  roleFilter: 'all',
  setRoleFilter: () => {},
  isSuperAdmin: false,
  effectiveRole: 'all',
});

const STORAGE_KEY = 'safescholar_superadmin_role_filter';

export const RoleFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { me, hasRole } = useAuth();
  const isSuperAdmin = Boolean(me?.isSysAdmin || hasRole('sysadmin'));

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

  return (
    <RoleFilterContext.Provider
      value={{
        roleFilter,
        setRoleFilter,
        isSuperAdmin,
        effectiveRole,
      }}
    >
      {children}
    </RoleFilterContext.Provider>
  );
};

export const useRoleFilter = () => useContext(RoleFilterContext);

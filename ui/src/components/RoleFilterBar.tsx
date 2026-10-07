import React from 'react';
import { useRoleFilter, type RoleFilterType } from '../services/roleFilterContext';
import { motion } from 'framer-motion';
import { Layers, GraduationCap, Backpack, Building2, ShieldCheck } from 'lucide-react';

export const RoleFilterBar: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { roleFilter, setRoleFilter, isSuperAdmin } = useRoleFilter();

  if (!isSuperAdmin) return null;

  const filters: { id: RoleFilterType; label: string; icon: React.ComponentType<any>; color: string }[] = [
    { id: 'all', label: 'All Roles', icon: Layers, color: 'from-slate-600 to-slate-800' },
    { id: 'teacher', label: 'Teachers', icon: GraduationCap, color: 'from-blue-600 to-indigo-600' },
    { id: 'student', label: 'Students', icon: Backpack, color: 'from-emerald-600 to-teal-600' },
    { id: 'institute', label: 'Institute Mgmt', icon: Building2, color: 'from-purple-600 to-pink-600' },
  ];

  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-2xl bg-white/70 dark:bg-zinc-900/80 backdrop-blur-xl border border-blue-900/10 dark:border-white/10 shadow-sm ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
      <div className="hidden lg:flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
        <ShieldCheck size={14} className="text-amber-500" />
        <span>View As:</span>
      </div>
      
      {filters.map((f) => {
        const Icon = f.icon;
        const isActive = roleFilter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setRoleFilter(f.id)}
            className={`relative flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl font-medium transition-all duration-200 select-none ${
              isActive
                ? 'text-white shadow-md'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="active-role-filter-indicator"
                className={`absolute inset-0 rounded-xl bg-gradient-to-r ${f.color} -z-10`}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Icon size={14} className={isActive ? 'text-white' : 'opacity-70'} />
            <span className="font-semibold whitespace-nowrap">{f.label}</span>
          </button>
        );
      })}
    </div>
  );
};

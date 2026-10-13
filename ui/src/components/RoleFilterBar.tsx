import React from 'react';
import { useRoleFilter, type RoleFilterType } from '../services/roleFilterContext';
import { motion } from 'framer-motion';
import { Layers, GraduationCap, Backpack, Building2, ShieldCheck } from 'lucide-react';

export const RoleFilterBar: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { roleFilter, setRoleFilter, isSuperAdmin } = useRoleFilter();

  if (!isSuperAdmin) return null;

  const filters: { 
    id: RoleFilterType; 
    label: string; 
    icon: React.ComponentType<any>; 
    color: string;
    dotColor: string;
    hoverClass: string;
  }[] = [
    { 
      id: 'all', 
      label: 'All Roles',
      icon: Layers, 
      color: 'from-amber-600 via-orange-600 to-amber-700', 
      dotColor: 'bg-amber-400',
      hoverClass: 'hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10'
    },
    { 
      id: 'teacher', 
      label: 'Teachers', 
      icon: GraduationCap, 
      color: 'from-blue-600 to-indigo-600 shadow-blue-500/25', 
      dotColor: 'bg-blue-300',
      hoverClass: 'hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10'
    },
    { 
      id: 'student', 
      label: 'Students', 
      icon: Backpack, 
      color: 'from-emerald-600 to-teal-600 shadow-emerald-500/25', 
      dotColor: 'bg-emerald-300',
      hoverClass: 'hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10'
    },
    { 
      id: 'institute', 
      label: 'Institute Mgmt',
      icon: Building2, 
      color: 'from-purple-600 via-fuchsia-600 to-pink-600 shadow-purple-500/25', 
      dotColor: 'bg-pink-300',
      hoverClass: 'hover:text-purple-600 dark:hover:text-pink-400 hover:bg-purple-500/10'
    },
  ];

  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-2xl bg-white/80 dark:bg-zinc-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-sm ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
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
            title={`Filter view for ${f.label}`}
            className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-medium transition-all duration-200 select-none ${
              isActive
                ? 'text-white shadow-md font-bold'
                : `text-slate-600 dark:text-zinc-400 ${f.hoverClass}`
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="active-role-filter-indicator"
                className={`absolute inset-0 rounded-xl bg-gradient-to-r ${f.color} -z-10`}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`w-1.5 h-1.5 rounded-full ${f.dotColor} ${isActive ? 'animate-pulse' : 'opacity-70'}`} />
            <Icon size={14} className={isActive ? 'text-white' : 'opacity-80'} />
            <span className="whitespace-nowrap">{f.label}</span>
          </button>
        );
      })}
    </div>
  );
};

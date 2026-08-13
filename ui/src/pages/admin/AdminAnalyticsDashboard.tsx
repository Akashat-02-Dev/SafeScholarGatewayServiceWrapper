import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { FeatureGuard } from '../../components/FeatureGuard';

interface AnalyticsData {
  name: string;
  teachers: number;
  students: number;
  violations: number;
}

export const AdminAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData[]>([]);

  useEffect(() => {
    // Mock fetch telemetry data
    setData([
      { name: 'Jan', teachers: 400, students: 2400, violations: 20 },
      { name: 'Feb', teachers: 300, students: 1398, violations: 15 },
      { name: 'Mar', teachers: 200, students: 9800, violations: 50 },
      { name: 'Apr', teachers: 278, students: 3908, violations: 25 },
      { name: 'May', teachers: 189, students: 4800, violations: 30 },
      { name: 'Jun', teachers: 239, students: 3800, violations: 10 },
      { name: 'Jul', teachers: 349, students: 4300, violations: 18 },
    ]);
  }, []);

  return (
    <FeatureGuard featureName="analytics_dashboard">
      <div className="p-4 sm:p-6 min-h-[calc(100vh-120px)] w-full max-w-7xl mx-auto flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-serif">
          Super Admin Analytics
        </h1>

        {/* CSS Grid for Glassmorphic Widget Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 min-w-0">
          
          <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/10 p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col min-h-0 min-w-0 h-96">
            <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100">System Adoption (MAU)</h2>
            <div className="flex-1 min-h-0 min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-zinc-700/50" vertical={false} />
                  <XAxis dataKey="name" stroke="currentColor" className="text-slate-400 dark:text-slate-500 text-xs font-semibold" tickLine={false} axisLine={false} />
                  <YAxis stroke="currentColor" className="text-slate-400 dark:text-slate-500 text-xs font-semibold" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'rgba(0, 0, 0, 0.05)', borderRadius: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', color: '#1e293b', fontWeight: 600 }}
                    itemStyle={{ fontWeight: 700 }}
                    cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '3 3' }}
                    wrapperClassName="dark:!bg-zinc-800/90 dark:!border-white/10 dark:!text-slate-100"
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="students" stroke="#3b82f6" activeDot={{ r: 6, strokeWidth: 0 }} strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="teachers" stroke="#0ea5e9" activeDot={{ r: 6, strokeWidth: 0 }} strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/10 p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col min-h-0 min-w-0 h-96">
            <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100">Risk & Safety Violations</h2>
            <div className="flex-1 min-h-0 min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-zinc-700/50" vertical={false} />
                  <XAxis dataKey="name" stroke="currentColor" className="text-slate-400 dark:text-slate-500 text-xs font-semibold" tickLine={false} axisLine={false} />
                  <YAxis stroke="currentColor" className="text-slate-400 dark:text-slate-500 text-xs font-semibold" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'rgba(0, 0, 0, 0.05)', borderRadius: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', color: '#1e293b', fontWeight: 600 }}
                    itemStyle={{ fontWeight: 700 }}
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    wrapperClassName="dark:!bg-zinc-800/90 dark:!border-white/10 dark:!text-slate-100"
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }} />
                  <Bar dataKey="violations" fill="#f43f5e" radius={[6, 6, 6, 6]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </FeatureGuard>
  );
};

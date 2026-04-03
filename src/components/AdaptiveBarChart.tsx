import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  LabelList
} from 'recharts';
import { TrendingUp, ChevronRight, Maximize2, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface DataPoint {
  name: string;
  PnL: number;
}

interface AdaptiveBarChartProps {
  data: DataPoint[];
  onViewAll?: () => void;
}

export const AdaptiveBarChart: React.FC<AdaptiveBarChartProps> = ({ data, onViewAll }) => {
  // 1. Adaptive Data Rendering Logic
  const processedData = useMemo(() => {
    // Sort by PnL descending for a "Leaderboard" feel
    const sorted = [...data].sort((a, b) => b.PnL - a.PnL);
    if (sorted.length <= 10) return sorted;

    const top5 = sorted.slice(0, 5);
    const bottom5 = sorted.slice(-5);
    
    // If there are many players, we show top 5 and bottom 5 to highlight extremes
    return [...top5, ...bottom5];
  }, [data]);

  const maxAbsPnL = useMemo(() => {
    return Math.max(...processedData.map(d => Math.abs(d.PnL)), 1);
  }, [processedData]);

  return (
    <div className="glass-card p-6 rounded-3xl flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp size={20} className="text-orange-400" /> 戰力分佈圖 🃏
        </h2>
        {data.length > 10 && (
          <button 
            onClick={onViewAll}
            className="text-xs font-bold text-orange-400 flex items-center gap-1 hover:bg-orange-400/10 px-3 py-1.5 rounded-full transition-colors"
          >
            查看全部 <Maximize2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide touch-pan-y">
        {processedData.map((item, index) => {
          const percentage = (Math.abs(item.PnL) / maxAbsPnL) * 100;
          const isPositive = item.PnL >= 0;

          return (
            <motion.div 
              key={item.name + index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group"
            >
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-sm font-bold text-zinc-500 group-hover:text-inherit transition-colors truncate max-w-[150px]">
                  {item.name}
                </span>
                <span className={cn(
                  "text-xs font-mono font-bold",
                  isPositive ? "text-green-400" : "text-red-400"
                )}>
                  {item.PnL > 0 ? `+${item.PnL}` : item.PnL}
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-500/10 rounded-full overflow-hidden relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: index * 0.05 }}
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isPositive ? "bg-gradient-to-r from-green-500/50 to-green-400 shadow-[0_0_10px_rgba(74,222,128,0.3)]" : "bg-gradient-to-r from-red-500/50 to-red-400 shadow-[0_0_10px_rgba(248,113,113,0.3)]"
                  )}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-600 mt-4 text-center italic">
        * 顯示累計最威同埋最水嘅損友
      </p>
    </div>
  );
};

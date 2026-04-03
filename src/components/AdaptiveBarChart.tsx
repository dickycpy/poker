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
  const [showTooltip, setShowTooltip] = useState<{ name: string, value: number } | null>(null);

  // 1. Adaptive Data Rendering Logic
  const processedData = useMemo(() => {
    if (data.length <= 15) return data;

    // Sort by absolute value to find "most significant" players, 
    // but keep original PnL for display
    const sorted = [...data].sort((a, b) => Math.abs(b.PnL) - Math.abs(a.PnL));
    const top6 = sorted.slice(0, 6);
    const others = sorted.slice(6);
    const othersPnL = others.reduce((sum, item) => sum + item.PnL, 0);

    return [
      ...top6,
      { name: '其他 (Others)', PnL: othersPnL, isOthers: true }
    ];
  }, [data]);

  // 2. Chart Behavior Logic (Vertical vs Horizontal)
  const isHorizontalLayout = useMemo(() => {
    const labelThreshold = 10;
    return processedData.some(d => d.name.length > labelThreshold);
  }, [processedData]);

  // 3. Scrolling Experience Logic
  const chartWidth = useMemo(() => {
    if (processedData.length <= 6 || isHorizontalLayout) return '100%';
    // Minimum bar width 60px + padding
    return `${processedData.length * 70}px`;
  }, [processedData.length, isHorizontalLayout]);

  const renderTooltip = (props: any) => {
    const { active, payload } = props;
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-card p-3 rounded-xl shadow-2xl">
          <p className="font-bold text-zinc-100">{data.name}</p>
          <p className={cn("font-mono font-bold", data.PnL >= 0 ? "text-green-400" : "text-red-400")}>
            {data.PnL > 0 ? `+${data.PnL}` : data.PnL}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6 rounded-3xl flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp size={20} className="text-orange-400" /> 戰力分佈圖
        </h2>
        {data.length > 15 && (
          <button 
            onClick={onViewAll}
            className="text-xs font-bold text-orange-400 flex items-center gap-1 hover:bg-orange-400/10 px-3 py-1.5 rounded-full transition-colors"
          >
            查看全部 <Maximize2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden">
        {/* Scroll Hint */}
        {processedData.length > 6 && !isHorizontalLayout && (
          <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-zinc-900 to-transparent pointer-events-none z-10 flex items-center justify-end pr-2">
            <motion.div 
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-zinc-500"
            >
              <ChevronRight size={20} />
            </motion.div>
          </div>
        )}

        <div className={cn(
          "h-full",
          !isHorizontalLayout ? "overflow-x-auto scrollbar-hide" : "overflow-y-auto"
        )}>
          <div style={{ width: chartWidth, height: '100%', minHeight: isHorizontalLayout ? `${processedData.length * 50}px` : 'auto' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={processedData} 
                layout={isHorizontalLayout ? 'vertical' : 'horizontal'}
                margin={{ top: 10, right: 30, left: isHorizontalLayout ? 60 : 0, bottom: 20 }}
                onClick={(data: any) => {
                  if (data && data.activePayload && data.activePayload.length > 0) {
                    const p = data.activePayload[0].payload;
                    setShowTooltip({ name: p.name, value: p.PnL });
                  }
                }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#27272a" 
                  vertical={isHorizontalLayout} 
                  horizontal={!isHorizontalLayout} 
                />
                
                {isHorizontalLayout ? (
                  <>
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="#71717a" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      width={80}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const label = payload.value.length > 10 ? payload.value.substring(0, 8) + '...' : payload.value;
                        return (
                          <text x={x} y={y} dy={4} textAnchor="end" fill="#71717a" fontSize={12} className="font-medium">
                            {label}
                          </text>
                        );
                      }}
                    />
                  </>
                ) : (
                  <>
                    <XAxis 
                      dataKey="name" 
                      stroke="#71717a" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      interval={0}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const label = payload.value.length > 8 ? payload.value.substring(0, 6) + '...' : payload.value;
                        return (
                          <text x={x} y={y} dy={16} textAnchor="middle" fill="#71717a" fontSize={11} className="font-medium">
                            {label}
                          </text>
                        );
                      }}
                    />
                    <YAxis 
                      stroke="#71717a" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                    />
                  </>
                )}

                <Tooltip content={renderTooltip} cursor={{ fill: '#27272a', opacity: 0.4 }} />
                
                <Bar 
                  dataKey="PnL" 
                  radius={isHorizontalLayout ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                  barSize={isHorizontalLayout ? 30 : 40}
                >
                  {processedData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.PnL >= 0 ? '#4ade80' : '#f87171'} 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ))}
                  {/* Label on bar for mobile accessibility */}
                  <LabelList 
                    dataKey="PnL" 
                    position={isHorizontalLayout ? "right" : "top"} 
                    fill="#71717a" 
                    fontSize={10}
                    formatter={(val: number) => val === 0 ? '' : val}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Swipe Hint Text */}
      {processedData.length > 6 && !isHorizontalLayout && (
        <p className="text-[10px] text-zinc-600 mt-2 text-center flex items-center justify-center gap-1">
          <Info size={10} /> 左右滑動查看更多損友
        </p>
      )}

      {/* Detail Modal / Bottom Sheet for Tap Interaction */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-x-0 bottom-0 z-[100] p-4 md:hidden"
          >
            <div className="glass-card rounded-t-3xl p-6 shadow-2xl">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold">{showTooltip.name}</h3>
                <button onClick={() => setShowTooltip(null)} className="text-zinc-500"><X size={24} /></button>
              </div>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "px-4 py-2 rounded-2xl font-mono text-xl font-bold",
                  showTooltip.value >= 0 ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                )}>
                  {showTooltip.value > 0 ? `+${showTooltip.value}` : showTooltip.value}
                </div>
                <p className="text-zinc-400 text-sm italic">
                  {showTooltip.value > 0 ? "今日你最威！" : "提款機你好。"}
                </p>
              </div>
            </div>
            <div className="fixed inset-0 bg-black/60 -z-10" onClick={() => setShowTooltip(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

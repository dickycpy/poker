/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  getDocs,
  getDocFromCache,
  getDocFromServer,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Player, GameRecord, getNickname } from './types';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { AdaptiveBarChart } from './components/AdaptiveBarChart';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  History, 
  LayoutDashboard, 
  LogOut, 
  LogIn,
  UserPlus,
  Trophy,
  Skull,
  Coins,
  Edit2,
  Check,
  X,
  Calendar,
  ArrowUpDown,
  HandCoins,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Copy,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

const INITIAL_PLAYER_NAMES = ['掌門', '蕃茄', 'Dicky', 'Hauyi', 'Hugo', 'Ken', 'Kiki', 'Leo Law', 'Matthew'];

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg-color)] text-inherit p-10 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Liquid Glass Background Elements */}
          <div className="glass-blob blob-1" />
          <div className="glass-blob blob-2" />
          <div className="glass-blob blob-3" />
          
          <div className="glass-card p-10 rounded-3xl max-w-lg w-full">
            <h1 className="text-4xl font-bold text-red-400 mb-4 italic tracking-tighter">死咗機呀！</h1>
            <pre className="bg-black/40 backdrop-blur-md p-4 rounded-xl text-[10px] text-left max-w-full overflow-auto mb-6 border border-zinc-500/10 text-zinc-400">
              {this.state.error?.toString()}
            </pre>
            <p className="text-zinc-400 mb-8 text-sm">通常係 Firebase 設定或者網域授權問題。檢查下 Console 啦損友。</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-xl"
            >
              重試一次
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'record' | 'players' | 'settle'>('dashboard');
  
  // Form states
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const [showAllStats, setShowAllStats] = useState(false);
  const [isSplashed, setIsSplashed] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [recordSortBy, setRecordSortBy] = useState<'date' | 'name'>('date');
  const [recordSortOrder, setRecordSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPlayerId, setFilterPlayerId] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [settleDate, setSettleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.remove('light');
    } else {
      root.classList.add('light');
    }
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsNavVisible(false);
      } else {
        setIsNavVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    // Test Firestore Connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Firebase 連線失敗：請檢查 firebase-applet-config.json 是否正確，或網域是否已授權。");
        }
      }
    };
    testConnection();

    const playersUnsubscribe = onSnapshot(
      query(collection(db, 'players'), orderBy('createdAt', 'asc')),
      (snapshot) => {
        const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        setPlayers(playersData);
        
        // Seed initial players if empty
        if (playersData.length === 0) {
          INITIAL_PLAYER_NAMES.forEach(async (name) => {
            try {
              await addDoc(collection(db, 'players'), {
                name,
                createdAt: Date.now()
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'players');
            }
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'players');
      }
    );

    const recordsUnsubscribe = onSnapshot(
      query(collection(db, 'records'), orderBy('date', 'desc')),
      (snapshot) => {
        const recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameRecord));
        setRecords(recordsData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'records');
      }
    );

    return () => {
      playersUnsubscribe();
      recordsUnsubscribe();
    };
  }, []);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId || !amount || !date) return;
    if (parseFloat(amount) === 0) {
      alert('0 蚊入嚟做乜？玩泥沙呀？');
      return;
    }

    try {
      await addDoc(collection(db, 'records'), {
        playerId: selectedPlayerId,
        amount: parseFloat(amount),
        date,
        createdAt: Date.now()
      });
      setAmount('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // Keep date and player for quick entry
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'records');
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    try {
      await addDoc(collection(db, 'players'), {
        name: newPlayerName.trim(),
        createdAt: Date.now()
      });
      setNewPlayerName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'players');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('真係要刪除？輸咗唔認數呀？')) return;
    try {
      await deleteDoc(doc(db, 'records', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `records/${id}`);
    }
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (!confirm(`真係要踢走 ${name}？佢仲爭緊錢喎！`)) return;
    try {
      await deleteDoc(doc(db, 'players', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `players/${id}`);
    }
  };

  const handleUpdatePlayer = async (id: string) => {
    if (!editingPlayerName.trim()) return;
    try {
      await updateDoc(doc(db, 'players', id), {
        name: editingPlayerName.trim()
      });
      setEditingPlayerId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `players/${id}`);
    }
  };

  // Data processing for dashboard
  const stats = useMemo(() => {
    const playerStats = players.map(player => {
      const playerRecords = records.filter(r => r.playerId === player.id);
      const totalPnL = playerRecords.reduce((sum, r) => sum + r.amount, 0);
      return {
        id: player.id,
        name: player.name,
        totalPnL,
        gamesPlayed: playerRecords.length,
      };
    }).sort((a, b) => b.totalPnL - a.totalPnL);

    return playerStats;
  }, [players, records]);

  const chartData = useMemo(() => {
    return stats.map(s => ({
      name: s.name,
      PnL: s.totalPnL
    }));
  }, [stats]);

  const sortedRecords = useMemo(() => {
    let filtered = [...records];
    if (filterPlayerId !== 'all') {
      filtered = filtered.filter(r => r.playerId === filterPlayerId);
    }

    return filtered.sort((a, b) => {
      if (recordSortBy === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return recordSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        const playerA = players.find(p => p.id === a.playerId)?.name || '';
        const playerB = players.find(p => p.id === b.playerId)?.name || '';
        return recordSortOrder === 'desc' 
          ? playerB.localeCompare(playerA) 
          : playerA.localeCompare(playerB);
      }
    });
  }, [records, players, recordSortBy, recordSortOrder, filterPlayerId]);

  const totalSum = useMemo(() => {
    return stats.reduce((sum, s) => sum + s.totalPnL, 0);
  }, [stats]);

  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(records.map(r => r.date)));
    // Ensure today is in the list if it's the default
    const today = format(new Date(), 'yyyy-MM-dd');
    if (!dates.includes(today)) {
      dates.push(today);
    }
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [records]);

  const settleStats = useMemo(() => {
    const filteredRecords = records.filter(r => r.date === settleDate);
    return players.map(player => {
      const playerRecords = filteredRecords.filter(r => r.playerId === player.id);
      const totalPnL = playerRecords.reduce((sum, r) => sum + r.amount, 0);
      return {
        id: player.id,
        name: player.name,
        totalPnL,
      };
    }).filter(s => s.totalPnL !== 0);
  }, [players, records, settleDate]);

  const settleTotalSum = useMemo(() => {
    return settleStats.reduce((sum, s) => sum + s.totalPnL, 0);
  }, [settleStats]);

  const settlementTransactions = useMemo(() => {
    const givers = settleStats.filter(s => s.totalPnL < 0).map(s => ({ name: s.name, balance: Math.abs(s.totalPnL) }));
    const receivers = settleStats.filter(s => s.totalPnL > 0).map(s => ({ name: s.name, balance: s.totalPnL }));

    // Sort descending to minimize number of transactions
    givers.sort((a, b) => b.balance - a.balance);
    receivers.sort((a, b) => b.balance - a.balance);

    const transactions: { from: string; to: string; amount: number }[] = [];
    let gIdx = 0;
    let rIdx = 0;

    // Use a copy to not mutate the original objects in useMemo
    const gList = givers.map(g => ({ ...g }));
    const rList = receivers.map(r => ({ ...r }));

    while (gIdx < gList.length && rIdx < rList.length) {
      const giver = gList[gIdx];
      const receiver = rList[rIdx];
      const amount = Math.min(giver.balance, receiver.balance);

      if (amount > 0) {
        transactions.push({
          from: giver.name,
          to: receiver.name,
          amount: amount
        });
      }

      giver.balance -= amount;
      receiver.balance -= amount;

      if (giver.balance <= 0.01) gIdx++; // Handle floating point precision
      if (receiver.balance <= 0.01) rIdx++;
    }

    return transactions;
  }, [settleStats]);

  const handleCopySettlement = () => {
    const text = settlementTransactions.map(t => `${t.from} ➔ $${t.amount} ➔ ${t.to}`).join('\n');
    const dateStr = format(new Date(settleDate), 'yyyy年MM月dd日');
    navigator.clipboard.writeText(`味真香慈善啤王大賽 - 找數清單 (${dateStr}) 🃏\n\n${text}\n\n大家快啲找數啦！💸`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait">
        {isSplashed ? (
          <motion.div 
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 h-[100dvh] w-screen z-[200] bg-[var(--bg-color)] flex flex-col items-center justify-center p-6 text-center overflow-hidden"
            onClick={() => setIsSplashed(false)}
          >
            {/* Liquid Glass Background Elements */}
            <div className="glass-blob blob-1" />
            <div className="glass-blob blob-2" />
            <div className="glass-blob blob-3" />
            
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="relative flex flex-col items-center"
              >
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-4 italic leading-tight">
                  味真香<br />
                  <span className="text-orange-500">慈善啤王大賽 🃏</span>
                </h1>
                <p className="text-orange-400/80 font-bold text-xl mb-12 italic tracking-widest">
                  小賭怡情 大賭變李嘉誠
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 1 }}
                className="mt-8"
              >
                <button className="group flex flex-col items-center gap-3">
                  <div className="px-10 py-2 rounded-full flex items-center justify-center transition-all active:scale-95">
                    <span className="text-xs font-bold tracking-[0.5em] text-zinc-500 group-hover:text-zinc-300 uppercase transition-colors">點擊開始</span>
                  </div>
                </button>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-[100dvh] bg-transparent font-sans pb-24 relative"
          >
            {/* Liquid Glass Background Elements */}
            <div className="glass-blob blob-1" />
            <div className="glass-blob blob-2" />
            <div className="glass-blob blob-3" />

            {/* Header */}
            <header className="p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex justify-between items-center border-b border-zinc-500/10 sticky top-0 backdrop-blur-xl z-50">
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <h1 className="text-2xl font-black tracking-tighter text-orange-500 italic">味真香慈善啤王大賽 🃏</h1>
                <p className="text-xs text-zinc-500 italic">小賭怡情 大賭變李嘉誠 ♠️♥️♦️♣️</p>
              </motion.div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
                    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
                    setTheme(next);
                  }}
                  className="p-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors"
                  title={`切換主題 (目前: ${theme})`}
                >
                  {theme === 'light' && <Sun size={20} />}
                  {theme === 'dark' && <Moon size={20} />}
                  {theme === 'system' && <Monitor size={20} />}
                </button>
              </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
              <div className="touch-pan-y">
                <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                  <motion.div 
                    key="dashboard"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-6 rounded-3xl"
                      >
                        <div className="flex items-center gap-2 text-green-400 mb-4">
                          <h2 className="text-xl font-bold">慈善啤王三巨頭 🏆</h2>
                        </div>
                        <div className="space-y-4">
                          {stats.slice(0, 3).map((s, i) => (
                            <motion.div 
                              key={s.id} 
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: 0.2 + i * 0.1 }}
                              className="flex justify-between items-center"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-black text-zinc-700">0{i+1}</span>
                                <div>
                                  <p className="font-bold">{s.name}</p>
                                  <p className="text-xs text-zinc-500 italic">{getNickname(i, stats.length, s.totalPnL, s.id)}</p>
                                </div>
                              </div>
                              <p className="text-green-500 font-mono font-bold">+{s.totalPnL}</p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>

                      <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-6 rounded-3xl"
                      >
                        <div className="flex items-center gap-2 text-red-400 mb-4">
                          <h2 className="text-xl font-bold">All-time 提款機 🏧</h2>
                        </div>
                        <div className="space-y-4">
                          {[...stats].reverse().slice(0, 3).map((s, i) => (
                            <motion.div 
                              key={s.id} 
                              initial={{ x: 10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: 0.3 + i * 0.1 }}
                              className="flex justify-between items-center"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-black text-zinc-700">0{i+1}</span>
                                <div>
                                  <p className="font-bold">{s.name}</p>
                                  <p className="text-xs text-zinc-500 italic">{getNickname(stats.length - 1 - i, stats.length, s.totalPnL, s.id)}</p>
                                </div>
                              </div>
                              <p className="text-red-500 font-mono font-bold">{s.totalPnL}</p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    </div>

                    {/* Chart */}
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="h-[400px]"
                    >
                      <AdaptiveBarChart 
                        data={chartData} 
                        onViewAll={() => setShowAllStats(true)} 
                      />
                    </motion.div>

                    {/* Recent History */}
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="glass-card p-6 rounded-3xl"
                    >
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-bold flex items-center gap-2">
                            <History size={20} className="text-orange-400" /> 最近戰報 📜
                          </h2>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                if (recordSortBy === 'date') {
                                  setRecordSortOrder(recordSortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setRecordSortBy('date');
                                  setRecordSortOrder('desc');
                                }
                              }}
                              className={cn(
                                "text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all flex items-center gap-1",
                                recordSortBy === 'date' 
                                  ? "bg-orange-500/20 border-orange-500/50 text-orange-400" 
                                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                              )}
                            >
                              日期 {recordSortBy === 'date' && (recordSortOrder === 'desc' ? '↓' : '↑')}
                            </button>
                          </div>
                        </div>
                        
                        {/* Player Filter Dropdown */}
                        <div className="relative">
                          <select 
                            value={filterPlayerId}
                            onChange={(e) => setFilterPlayerId(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-base font-bold text-zinc-300 focus:outline-none focus:border-orange-500/50 appearance-none transition-all"
                          >
                            <option value="all">所有損友 (All Players)</option>
                            {players.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                            <Users size={14} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {sortedRecords.slice(0, 10).map((r, idx) => {
                          const player = players.find(p => p.id === r.playerId);
                          return (
                            <motion.div 
                              key={r.id} 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.6 + idx * 0.05 }}
                              className="flex justify-between items-center p-3 bg-zinc-500/10 backdrop-blur-sm rounded-xl border border-zinc-500/10 group"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                                  r.amount >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                )}>
                                  {player?.name[0]}
                                </div>
                                <div>
                                  <p className="font-bold">{player?.name || '未知生物'}</p>
                                  <p className="text-xs text-zinc-500">{r.date}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 md:gap-4">
                                <p className={cn("font-mono font-bold", r.amount >= 0 ? "text-green-500" : "text-red-500")}>
                                  {r.amount > 0 ? `+${r.amount}` : r.amount}
                                </p>
                                <button 
                                  onClick={() => handleDeleteRecord(r.id)}
                                  className="p-2 text-zinc-600 hover:text-red-500 transition-all md:opacity-0 md:group-hover:opacity-100"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {activeTab === 'record' && (
                  <motion.div 
                    key="record"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card p-6 md:p-8 rounded-3xl max-w-md mx-auto relative"
                  >
                    <AnimatePresence>
                      {showSuccess && (
                        <motion.div
                          initial={{ opacity: 0, y: -100 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -100 }}
                          className="fixed top-24 left-0 right-0 z-[100] flex justify-center px-6 pointer-events-none"
                        >
                          <div className="glass-card text-green-400 px-8 py-3 rounded-full font-bold text-base shadow-2xl flex items-center gap-3 border border-green-500/30 backdrop-blur-2xl">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Check size={20} />
                            </div>
                            入帳成功！
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <h2 className="text-2xl font-bold mb-8 text-center italic">入帳啦！🃏 (或者入土🪦)</h2>
                    <form onSubmit={handleAddRecord} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">日期</label>
                        <div className="relative">
                          <input 
                            type="date" 
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full glass-input rounded-xl p-4 focus:outline-none focus:border-orange-500 transition-colors box-border appearance-none text-white text-base"
                            style={{ WebkitAppearance: 'none' }}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                            <Calendar size={20} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">邊位水魚？</label>
                        <select 
                          value={selectedPlayerId}
                          onChange={(e) => setSelectedPlayerId(e.target.value)}
                          className="w-full glass-input rounded-xl p-4 focus:outline-none focus:border-orange-500 transition-colors appearance-none text-base"
                        >
                          <option value="">揀返個名先...</option>
                          {players.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">贏/輸幾多？ (輸就入負數啦)</label>
                        <div className="relative">
                          <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                          <input 
                            type="number" 
                            placeholder="例如: 500 或 -200"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full glass-input rounded-xl p-4 pl-12 focus:outline-none focus:border-orange-500 transition-colors text-base"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                      >
                        確認入帳
                      </button>
                    </form>
                  </motion.div>
                )}

                {activeTab === 'players' && (
                  <motion.div 
                    key="players"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="glass-card p-6 rounded-3xl">
                      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <UserPlus size={20} className="text-orange-400" /> 新增損友 👥
                      </h2>
                      <form onSubmit={handleAddPlayer} className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="入個名嚟..."
                          value={newPlayerName}
                          onChange={(e) => setNewPlayerName(e.target.value)}
                          className="flex-1 glass-input rounded-xl p-4 focus:outline-none focus:border-orange-500 transition-colors text-base"
                        />
                        <button 
                          type="submit"
                          className="bg-white text-black font-bold px-6 rounded-xl hover:bg-orange-500 hover:text-white transition-all active:scale-95"
                        >
                          <Plus size={24} />
                        </button>
                      </form>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {players.map((p, i) => (
                        <motion.div 
                          key={p.id} 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="glass-card p-4 rounded-2xl flex justify-between items-center gap-2"
                        >
                          {editingPlayerId === p.id ? (
                            <div className="flex-1 flex gap-2">
                              <input 
                                type="text"
                                value={editingPlayerName}
                                onChange={(e) => setEditingPlayerName(e.target.value)}
                                className="flex-1 glass-input rounded-lg px-2 py-1 text-base focus:outline-none focus:border-orange-500"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleUpdatePlayer(p.id)}
                                className="text-green-500 hover:text-green-400"
                              >
                                <Check size={18} />
                              </button>
                              <button 
                                onClick={() => setEditingPlayerId(null)}
                                className="text-zinc-500 hover:text-zinc-400"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="font-bold truncate">{p.name}</span>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => {
                                    setEditingPlayerId(p.id);
                                    setEditingPlayerName(p.name);
                                  }}
                                  className="p-2 text-zinc-600 hover:text-orange-500 transition-colors"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeletePlayer(p.id, p.name)}
                                  className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'settle' && (
                  <motion.div 
                    key="settle"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="glass-card p-6 rounded-3xl">
                      <div className="flex flex-col gap-6 mb-8">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-bold flex items-center gap-2">
                            <HandCoins size={20} className="text-orange-400" /> 找數計算機 💸
                          </h2>
                          {settlementTransactions.length > 0 && (
                            <button 
                              onClick={handleCopySettlement}
                              className={cn(
                                "text-xs font-bold px-4 py-2 rounded-full flex items-center gap-2 transition-all",
                                copied ? "bg-green-500 text-white" : "bg-orange-500 text-white hover:bg-orange-600"
                              )}
                            >
                              {copied ? <Check size={14} /> : <Copy size={14} />}
                              {copied ? "已複製" : "複製清單"}
                            </button>
                          )}
                        </div>

                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                            <Calendar size={18} />
                          </div>
                          <select 
                            value={settleDate}
                            onChange={(e) => setSettleDate(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-base font-bold text-zinc-200 focus:outline-none focus:border-orange-500/50 appearance-none transition-all"
                          >
                            {availableDates.map(d => (
                              <option key={d} value={d}>{d} {d === format(new Date(), 'yyyy-MM-dd') ? '(今日)' : ''}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {settleTotalSum !== 0 && settleStats.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
                          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                          <div className="text-sm text-red-200">
                            <p className="font-bold mb-1">數目唔對！(Total: {settleTotalSum > 0 ? `+${settleTotalSum}` : settleTotalSum})</p>
                            <p className="text-xs opacity-80">今日嘅數好似入錯咗，或者有人未入齊。總和應該係 0。</p>
                          </div>
                        </div>
                      )}

                      {settlementTransactions.length > 0 ? (
                        <div className="space-y-4">
                          {settlementTransactions.map((t, i) => (
                            <motion.div 
                              key={i}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex items-center justify-between p-4 bg-zinc-500/10 rounded-2xl border border-zinc-500/10"
                            >
                              <div className="flex flex-col">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest mb-1">俾錢嗰個</span>
                                <span className="font-bold text-lg">{t.from}</span>
                              </div>
                              
                              <div className="flex flex-col items-center px-4">
                                <div className="text-orange-500 font-black text-xl mb-1">${t.amount}</div>
                                <ArrowRight size={20} className="text-zinc-400" />
                              </div>

                              <div className="flex flex-col items-end">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest mb-1">收錢嗰個</span>
                                <span className="font-bold text-lg">{t.to}</span>
                              </div>
                            </motion.div>
                          ))}
                          
                          <div className="pt-6 border-t border-zinc-500/10">
                            <div className="flex items-center gap-2 text-zinc-500 text-xs italic justify-center">
                              <CheckCircle2 size={14} />
                              <span>跟住上面咁找數，大家就兩清啦！</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-16">
                          <div className="w-20 h-20 bg-zinc-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <HandCoins size={40} className="text-zinc-400" />
                          </div>
                          <p className="text-zinc-400 font-black text-lg uppercase tracking-widest">NO DEBTS FOUND</p>
                          <p className="text-xs text-zinc-600 mt-2 max-w-[200px] mx-auto">
                            {settleDate === format(new Date(), 'yyyy-MM-dd') 
                              ? "今日暫時仲未有數要找，快啲去開波啦！" 
                              : "呢一日冇任何入帳紀錄。"}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>

            {/* View All Stats Modal */}
            <AnimatePresence>
              {showAllStats && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAllStats(false)} />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="glass-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative z-10"
                  >
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                      <h2 className="text-xl font-bold flex items-center gap-2 italic">
                        全員戰力榜
                      </h2>
                      <button onClick={() => setShowAllStats(false)} className="text-zinc-500 hover:text-white">
                        <X size={24} />
                      </button>
                    </div>
                    <div className="p-6 max-h-[70vh] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-white/10">
                            <th className="pb-4 font-medium">排名</th>
                            <th className="pb-4 font-medium">損友</th>
                            <th className="pb-4 font-medium text-right">場數</th>
                            <th className="pb-4 font-medium text-right">總 PnL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {stats.map((s, i) => (
                            <tr key={s.id} className="group">
                              <td className="py-4 text-zinc-500 font-mono">{i + 1}</td>
                              <td className="py-4 font-bold">{s.name}</td>
                              <td className="py-4 text-right text-zinc-400">{s.gamesPlayed}</td>
                              <td className={cn(
                                "py-4 text-right font-mono font-bold",
                                s.totalPnL >= 0 ? "text-green-400" : "text-red-400"
                              )}>
                                {s.totalPnL > 0 ? `+${s.totalPnL}` : s.totalPnL}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-6 bg-white/5 text-center">
                      <p className="text-xs text-zinc-500 italic">"贏就一齊贏，輸就你一個輸。"</p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Nav */}
            <motion.nav 
              initial={{ y: 0 }}
              animate={{ y: isNavVisible ? 0 : 100 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md glass-card rounded-full p-1.5 flex gap-1 shadow-2xl z-50"
            >
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2 py-3 rounded-full transition-all",
                  activeTab === 'dashboard' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-white"
                )}
              >
                <LayoutDashboard size={18} className="shrink-0" />
                <span className="text-[10px] font-bold whitespace-nowrap">戰報</span>
              </button>
              <button 
                onClick={() => setActiveTab('settle')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2 py-3 rounded-full transition-all",
                  activeTab === 'settle' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-white"
                )}
              >
                <HandCoins size={18} className="shrink-0" />
                <span className="text-[10px] font-bold whitespace-nowrap">找數</span>
              </button>
              <button 
                onClick={() => setActiveTab('record')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2 py-3 rounded-full transition-all",
                  activeTab === 'record' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-white"
                )}
              >
                <Plus size={18} className="shrink-0" />
                <span className="text-[10px] font-bold whitespace-nowrap">入帳</span>
              </button>
              <button 
                onClick={() => setActiveTab('players')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2 py-3 rounded-full transition-all",
                  activeTab === 'players' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-white"
                )}
              >
                <Users size={18} className="shrink-0" />
                <span className="text-[10px] font-bold whitespace-nowrap">損友</span>
              </button>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}

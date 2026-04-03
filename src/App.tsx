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
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signIn, logOut } from './firebase';
import { Player, GameRecord, getNickname } from './types';
import { cn } from './lib/utils';
import { format } from 'date-fns';
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
  Coins
} from 'lucide-react';

const INITIAL_PLAYER_NAMES = ['Arial', 'Ben', 'Charmain', 'David', 'Eric', 'Fiona', 'Gary', 'Helen'];

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white p-10 flex flex-col items-center justify-center text-center">
          <h1 className="text-4xl font-bold text-red-500 mb-4">死咗機呀！(App Crashed)</h1>
          <pre className="bg-zinc-900 p-4 rounded-lg text-xs text-left max-w-full overflow-auto mb-6 border border-zinc-800">
            {this.state.error?.toString()}
          </pre>
          <p className="text-zinc-400 mb-6">通常係 Firebase 設定或者網域授權問題。檢查下 Console 啦損友。</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black px-6 py-2 rounded-full font-bold"
          >
            重試一次
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'record' | 'players'>('dashboard');
  
  // Form states
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });

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

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const playersUnsubscribe = onSnapshot(
      query(collection(db, 'players'), orderBy('createdAt', 'asc')),
      (snapshot) => {
        const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        setPlayers(playersData);
        
        // Seed initial players if empty
        if (playersData.length === 0) {
          INITIAL_PLAYER_NAMES.forEach(async (name) => {
            await addDoc(collection(db, 'players'), {
              name,
              createdAt: Date.now()
            });
          });
        }
      }
    );

    const recordsUnsubscribe = onSnapshot(
      query(collection(db, 'records'), orderBy('date', 'desc')),
      (snapshot) => {
        const recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameRecord));
        setRecords(recordsData);
      }
    );

    return () => {
      playersUnsubscribe();
      recordsUnsubscribe();
    };
  }, [user]);

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
      // Keep date and player for quick entry
    } catch (err) {
      console.error('Error adding record:', err);
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
      console.error('Error adding player:', err);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('真係要刪除？輸咗唔認數呀？')) return;
    try {
      await deleteDoc(doc(db, 'records', id));
    } catch (err) {
      console.error('Error deleting record:', err);
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

  if (!isAuthReady) return <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">載入中... (如果卡住咗，請檢查 Console)</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white p-6 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md"
        >
          <h1 className="text-5xl font-black mb-4 tracking-tighter text-orange-500 italic">輸死你 POKER</h1>
          <p className="text-zinc-400 mb-8 text-lg">
            專門記錄邊個係贏家，邊個係提款機。<br/>
            入嚟啦，睇下今日邊個送錢。
          </p>
          <button 
            onClick={signIn}
            className="flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-orange-500 hover:text-white transition-all active:scale-95"
          >
            <LogIn size={20} /> 用 Google 登入認命
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-24">
        {/* Header */}
        <header className="p-6 flex justify-between items-center border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-orange-500 italic">輸死你 POKER</h1>
            <p className="text-xs text-zinc-500">今日邊個係水魚？</p>
          </div>
          <button onClick={logOut} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <LogOut size={20} />
          </button>
        </header>

        <main className="p-4 max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Top Winners/Losers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                    <div className="flex items-center gap-2 text-green-500 mb-4">
                      <Trophy size={24} />
                      <h2 className="text-xl font-bold">今日賭神 (Top 3)</h2>
                    </div>
                    <div className="space-y-4">
                      {stats.slice(0, 3).map((s, i) => (
                        <div key={s.id} className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-zinc-700">0{i+1}</span>
                            <div>
                              <p className="font-bold">{s.name}</p>
                              <p className="text-xs text-zinc-500 italic">{getNickname(i, stats.length, s.totalPnL)}</p>
                            </div>
                          </div>
                          <p className="text-green-500 font-mono font-bold">+{s.totalPnL}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                    <div className="flex items-center gap-2 text-red-500 mb-4">
                      <Skull size={24} />
                      <h2 className="text-xl font-bold">提款機 (Bottom 3)</h2>
                    </div>
                    <div className="space-y-4">
                      {[...stats].reverse().slice(0, 3).map((s, i) => (
                        <div key={s.id} className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-zinc-700">0{i+1}</span>
                            <div>
                              <p className="font-bold">{s.name}</p>
                              <p className="text-xs text-zinc-500 italic">{getNickname(stats.length - 1 - i, stats.length, s.totalPnL)}</p>
                            </div>
                          </div>
                          <p className="text-red-500 font-mono font-bold">{s.totalPnL}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 h-[400px]">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <TrendingUp size={20} className="text-orange-500" /> 戰力分佈圖
                  </h2>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#71717a" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="#71717a" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                        itemStyle={{ color: '#f97316' }}
                      />
                      <Bar dataKey="PnL" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.PnL >= 0 ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Recent History */}
                <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <History size={20} className="text-orange-500" /> 最近戰報
                  </h2>
                  <div className="space-y-3">
                    {records.slice(0, 10).map(r => {
                      const player = players.find(p => p.id === r.playerId);
                      return (
                        <div key={r.id} className="flex justify-between items-center p-3 bg-zinc-950 rounded-xl border border-zinc-800 group">
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
                          <div className="flex items-center gap-4">
                            <p className={cn("font-mono font-bold", r.amount >= 0 ? "text-green-500" : "text-red-500")}>
                              {r.amount > 0 ? `+${r.amount}` : r.amount}
                            </p>
                            <button 
                              onClick={() => handleDeleteRecord(r.id)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-red-500 transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'record' && (
              <motion.div 
                key="record"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 max-w-md mx-auto"
              >
                <h2 className="text-2xl font-bold mb-8 text-center italic">入帳啦！(或者入土)</h2>
                <form onSubmit={handleAddRecord} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">日期</label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">邊位水魚？</label>
                    <select 
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-orange-500 transition-colors appearance-none"
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
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 pl-12 focus:outline-none focus:border-orange-500 transition-colors"
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
                <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <UserPlus size={20} className="text-orange-500" /> 新增損友
                  </h2>
                  <form onSubmit={handleAddPlayer} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="入個名嚟..."
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                    <button 
                      type="submit"
                      className="bg-white text-black font-bold px-6 rounded-xl hover:bg-orange-500 hover:text-white transition-all active:scale-95"
                    >
                      <Plus size={24} />
                    </button>
                  </form>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {players.map(p => (
                    <div key={p.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center">
                      <span className="font-bold">{p.name}</span>
                      <button 
                        onClick={async () => {
                          if (confirm(`真係要踢走 ${p.name}？佢仲爭緊錢喎！`)) {
                            await deleteDoc(doc(db, 'players', p.id));
                          }
                        }}
                        className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full p-2 flex gap-1 shadow-2xl z-50">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full transition-all",
              activeTab === 'dashboard' ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-white"
            )}
          >
            <LayoutDashboard size={20} />
            <span className="text-sm font-bold">戰報</span>
          </button>
          <button 
            onClick={() => setActiveTab('record')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full transition-all",
              activeTab === 'record' ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-white"
            )}
          >
            <Plus size={20} />
            <span className="text-sm font-bold">入帳</span>
          </button>
          <button 
            onClick={() => setActiveTab('players')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full transition-all",
              activeTab === 'players' ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-white"
            )}
          >
            <Users size={20} />
            <span className="text-sm font-bold">損友</span>
          </button>
        </nav>
      </div>
    </ErrorBoundary>
  );
}

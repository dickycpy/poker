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
  X
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'record' | 'players'>('dashboard');
  
  // Form states
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const [showAllStats, setShowAllStats] = useState(false);

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

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-24">
        {/* Header */}
        <header className="p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex justify-between items-center border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-orange-500 italic">味真香慈善啤王大賽</h1>
            <p className="text-xs text-zinc-500">今日邊個係水魚？</p>
          </div>
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
                <div className="h-[400px]">
                  <AdaptiveBarChart 
                    data={chartData} 
                    onViewAll={() => setShowAllStats(true)} 
                  />
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {players.map(p => (
                    <div key={p.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center gap-2">
                      {editingPlayerId === p.id ? (
                        <div className="flex-1 flex gap-2">
                          <input 
                            type="text"
                            value={editingPlayerName}
                            onChange={(e) => setEditingPlayerName(e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
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
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative z-10"
              >
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                  <h2 className="text-xl font-bold flex items-center gap-2 italic">
                    <Trophy size={20} className="text-orange-500" /> 全員戰力榜
                  </h2>
                  <button onClick={() => setShowAllStats(false)} className="text-zinc-500 hover:text-white">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                        <th className="pb-4 font-medium">排名</th>
                        <th className="pb-4 font-medium">損友</th>
                        <th className="pb-4 font-medium text-right">場數</th>
                        <th className="pb-4 font-medium text-right">總 PnL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {stats.map((s, i) => (
                        <tr key={s.id} className="group">
                          <td className="py-4 text-zinc-500 font-mono">{i + 1}</td>
                          <td className="py-4 font-bold">{s.name}</td>
                          <td className="py-4 text-right text-zinc-400">{s.gamesPlayed}</td>
                          <td className={cn(
                            "py-4 text-right font-mono font-bold",
                            s.totalPnL >= 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {s.totalPnL > 0 ? `+${s.totalPnL}` : s.totalPnL}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-6 bg-zinc-950/50 text-center">
                  <p className="text-xs text-zinc-500 italic">"贏就一齊贏，輸就你一個輸。"</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Nav */}
        <nav className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full p-1.5 flex gap-1 shadow-2xl z-50">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-full transition-all",
              activeTab === 'dashboard' ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-white"
            )}
          >
            <LayoutDashboard size={20} className="shrink-0" />
            <span className="text-sm font-bold whitespace-nowrap">戰報</span>
          </button>
          <button 
            onClick={() => setActiveTab('record')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-full transition-all",
              activeTab === 'record' ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-white"
            )}
          >
            <Plus size={20} className="shrink-0" />
            <span className="text-sm font-bold whitespace-nowrap">入帳</span>
          </button>
          <button 
            onClick={() => setActiveTab('players')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-full transition-all",
              activeTab === 'players' ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-white"
            )}
          >
            <Users size={20} className="shrink-0" />
            <span className="text-sm font-bold whitespace-nowrap">損友</span>
          </button>
        </nav>
      </div>
    </ErrorBoundary>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Shield, 
  Cpu, 
  History, 
  Settings,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Zap
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { CandlestickChart } from './components/CandlestickChart';

interface Trade {
  id: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number;
  amount: number;
  profit: number;
  status: string;
  strategy: string;
  timestamp: string;
}

interface MarketData {
  id: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

interface Stats {
  totalTrades: number;
  totalProfit: number;
  winRate: number;
  balance: number;
}

export default function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [stats, setStats] = useState<Stats>({ totalTrades: 0, totalProfit: 0, winRate: 0, balance: 10000 });
  const [insights, setInsights] = useState<{ insight: string, confidence: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [gridLevels, setGridLevels] = useState<{ price: number, type: 'BUY' | 'SELL', status: 'PENDING' | 'ACTIVE' }[]>([]);
  const [binanceStatus, setBinanceStatus] = useState<{ connected: boolean, loading: boolean, error?: string }>({ connected: false, loading: false });
  
  // New state for API key configuration
  const [config, setConfig] = useState({ apiKey: '', apiSecret: '' });
  const [validation, setValidation] = useState<{ apiKey?: string, apiSecret?: string }>({});
  const [isConfiguring, setIsConfiguring] = useState(false);

  const validateKeys = () => {
    const errors: { apiKey?: string, apiSecret?: string } = {};
    const keyRegex = /^[a-zA-Z0-9]{64}$/;
    
    if (!config.apiKey) {
      errors.apiKey = 'API Key is required';
    } else if (!keyRegex.test(config.apiKey)) {
      errors.apiKey = 'Invalid format. Binance API keys are typically 64 alphanumeric characters.';
    }

    if (!config.apiSecret) {
      errors.apiSecret = 'API Secret is required';
    } else if (!keyRegex.test(config.apiSecret)) {
      errors.apiSecret = 'Invalid format. Binance API secrets are typically 64 alphanumeric characters.';
    }

    setValidation(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfigure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateKeys()) return;

    setIsConfiguring(true);
    try {
      const res = await fetch('/api/binance/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (res.ok) {
        await checkBinance();
        alert('Configuration updated successfully! The system will now attempt to use these credentials.');
      } else {
        const data = await res.json();
        setBinanceStatus(prev => ({ ...prev, error: data.error || 'Failed to update configuration.' }));
      }
    } catch (err) {
      setBinanceStatus(prev => ({ ...prev, error: 'Network error while configuring.' }));
    } finally {
      setIsConfiguring(false);
    }
  };

  const checkBinance = async () => {
    setBinanceStatus(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch('/api/binance/check');
      const data = await res.json();
      setBinanceStatus({ connected: data.connected, loading: false, error: data.error });
    } catch (err) {
      setBinanceStatus({ connected: false, loading: false, error: 'Failed to reach server.' });
    }
  };

  useEffect(() => {
    checkBinance();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tradesRes, marketRes, statsRes, insightsRes] = await Promise.all([
          fetch('/api/trades'),
          fetch('/api/market-data'),
          fetch('/api/stats'),
          fetch('/api/insights')
        ]);
        
        // Check if any response is not OK (e.g., 404, 500)
        if (!tradesRes.ok || !marketRes.ok || !statsRes.ok || !insightsRes.ok) {
          throw new Error('One or more API calls failed');
        }

        // Check if content-type is JSON
        const isJson = (res: Response) => res.headers.get('content-type')?.includes('application/json');
        if (!isJson(tradesRes) || !isJson(marketRes) || !isJson(statsRes) || !isJson(insightsRes)) {
          throw new Error('Server returned HTML instead of JSON (likely 404 fallback)');
        }

        const [tradesData, marketData, statsData, insightsData] = await Promise.all([
          tradesRes.json(),
          marketRes.json(),
          statsRes.json(),
          insightsRes.json()
        ]);
        
        setTrades(tradesData);
        setMarketData(marketData);
        setStats(statsData);
        setInsights(insightsData);

        // Generate simulated grid levels based on latest price
        const latestPrice = marketData.filter((d: any) => d.symbol === selectedSymbol).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.close;
        if (latestPrice) {
          const newGrid = [];
          const step = latestPrice * 0.005; // 0.5% step
          for (let i = 1; i <= 3; i++) {
            newGrid.push({ price: latestPrice + (step * i), type: 'SELL' as const, status: 'PENDING' as const });
            newGrid.push({ price: latestPrice - (step * i), type: 'BUY' as const, status: 'PENDING' as const });
          }
          setGridLevels(newGrid.sort((a, b) => b.price - a.price));
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const filteredMarketData = marketData
    .filter(d => d.symbol === selectedSymbol)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30">
      {/* Sidebar / Navigation */}
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#0A0A0A] border-r border-white/5 flex flex-col items-center py-8 gap-8 z-50">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Zap className="text-black fill-current" size={24} />
        </div>
        
        <div className="flex flex-col gap-4 flex-1">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={20} />} label="Dashboard" />
          <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="History" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Settings" />
        </div>

        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=trader" alt="Avatar" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20 min-h-screen">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-40">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Cpu className="text-emerald-500" size={20} />
              AI TRADING SYSTEM 
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${binanceStatus.connected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                {binanceStatus.connected ? 'LIVE' : 'SIMULATION'}
              </span>
            </h1>
            <p className="text-xs text-zinc-500 font-mono">AUTONOMOUS REINFORCEMENT LEARNING ENGINE V2.4</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Total Balance</span>
              <motion.span 
                key={stats.balance}
                initial={{ scale: 1.1, color: '#10b981' }}
                animate={{ scale: 1, color: '#10b981' }}
                transition={{ duration: 0.5 }}
                className="text-lg font-mono font-bold"
              >
                ${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </motion.span>
            </div>
            <button className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-400 transition-colors">
              Deposit
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-12 gap-6"
              >
                {/* Balance Section */}
                <div className="col-span-12 bg-gradient-to-br from-[#0A0A0A] to-[#050505] border border-white/5 rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <Wallet size={16} />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Total Account Balance</span>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <motion.h2 
                        key={stats.balance}
                        initial={{ opacity: 0.5, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl font-mono font-bold tracking-tighter"
                      >
                        ${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </motion.h2>
                      <div className={`flex items-center gap-1 text-sm font-bold ${stats.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stats.totalProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {((stats.totalProfit / 10000) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-w-[160px]">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Available Funds</p>
                      <p className="text-lg font-mono font-bold">${(stats.balance * 0.85).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-w-[160px]">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Locked in Trades</p>
                      <p className="text-lg font-mono font-bold">${(stats.balance * 0.15).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="col-span-12 grid grid-cols-4 gap-6">
                  <StatCard label="Total Profit" value={`$${stats.totalProfit.toFixed(2)}`} trend={stats.totalProfit > 0 ? 'up' : 'down'} icon={<Wallet size={18} />} />
                  <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} trend="up" icon={<TrendingUp size={18} />} />
                  <StatCard label="Total Trades" value={stats.totalTrades.toString()} trend="neutral" icon={<Activity size={18} />} />
                  <StatCard label="Risk Level" value="Professional" trend="neutral" icon={<Shield size={18} />} />
                </div>

                {/* Main Chart */}
                <div className="col-span-12 lg:col-span-8 bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 h-[450px]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map(s => (
                        <button 
                          key={s}
                          onClick={() => setSelectedSymbol(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedSymbol === s ? 'bg-emerald-500 text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
                        >
                          {s.replace('USDT', '')}
                        </button>
                      ))}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-zinc-500 block">Current Price</span>
                      <span className="text-xl font-mono font-bold text-emerald-400">
                        ${filteredMarketData[filteredMarketData.length - 1]?.close.toLocaleString() || '0.00'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-[320px] w-full">
                    <CandlestickChart data={filteredMarketData} trades={trades} gridLevels={gridLevels} selectedSymbol={selectedSymbol} />
                  </div>
                </div>

                {/* Robot Entry Grid */}
                <div className="col-span-12 lg:col-span-4 bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 flex flex-col">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <Zap size={16} className="text-emerald-500" />
                    Robot Entry Grid
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 ml-auto">ACTIVE</span>
                  </h3>
                  
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                    {gridLevels.map((level, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${level.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {level.type === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{level.type} LIMIT</p>
                            <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-tighter">Level {idx + 1}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold">${level.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          <p className={`text-[10px] font-bold ${level.status === 'ACTIVE' ? 'text-emerald-500' : 'text-zinc-500'}`}>{level.status}</p>
                        </div>
                      </div>
                    ))}
                    {gridLevels.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600 py-12">
                        <Zap size={32} className="opacity-20 mb-2" />
                        <p className="text-xs italic">Calculating optimal grid levels...</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 mb-2">
                      <span>Grid Density</span>
                      <span className="text-emerald-500">0.5% Step</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-2/3"></div>
                    </div>
                  </div>
                </div>

                {/* AI Insights & Recent Activity */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 flex-1">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <Cpu size={16} className="text-emerald-500" />
                      AI Learning Engine
                    </h3>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <p className="text-xs text-emerald-400 font-medium mb-1">Active AI Strategy</p>
                        <p className="text-sm text-white font-bold">{trades[0]?.strategy || 'Trend Following + Mean Reversion'}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-xs text-zinc-500 font-medium mb-1">Market Sentiment</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">
                            {insights[0]?.confidence > 0.8 ? 'Strong Bullish' : insights[0]?.confidence > 0.5 ? 'Neutral/Bullish' : 'Consolidating'}
                          </span>
                          <span className="text-xs font-mono text-emerald-400">{(insights[0]?.confidence * 100 || 85).toFixed(0)}% Confidence</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${(insights[0]?.confidence * 100 || 85)}%` }}></div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-xs text-zinc-500 font-medium mb-2">Recent Insights</p>
                        <ul className="text-[11px] space-y-2 text-zinc-400">
                          {insights.slice(0, 3).map((insight, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-emerald-500">•</span>
                              {insight.insight}
                            </li>
                          ))}
                          {insights.length === 0 && (
                            <li className="text-zinc-600 italic">Analyzing market patterns...</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Trades Table */}
                <div className="col-span-12 bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <History size={16} className="text-emerald-500" />
                      Recent Operations
                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse ml-1"></span>
                    </h3>
                    <button onClick={() => setActiveTab('history')} className="text-xs text-emerald-500 hover:underline">View All</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-zinc-500 text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3 font-bold">Asset</th>
                          <th className="px-6 py-3 font-bold">Type</th>
                          <th className="px-6 py-3 font-bold">Entry</th>
                          <th className="px-6 py-3 font-bold">Exit</th>
                          <th className="px-6 py-3 font-bold">Profit</th>
                          <th className="px-6 py-3 font-bold">Status</th>
                          <th className="px-6 py-3 font-bold">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        <AnimatePresence initial={false}>
                          {trades.slice(0, 6).map((trade) => (
                            <motion.tr 
                              key={trade.id} 
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              layout
                              className="hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-6 py-4 font-bold">{trade.symbol}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                  {trade.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono">${trade.entry_price.toLocaleString()}</td>
                              <td className="px-6 py-4 font-mono">${trade.exit_price.toLocaleString()}</td>
                              <td className={`px-6 py-4 font-mono font-bold ${trade.profit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                              </td>
                              <td className="px-6 py-4">
                                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                  {trade.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-zinc-500">
                                {new Date(trade.timestamp).toLocaleTimeString()}
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-white/5">
                  <h2 className="text-2xl font-bold mb-2">Trade History</h2>
                  <p className="text-zinc-500 text-sm">Complete log of all autonomous operations executed by the AI.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-zinc-500 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="px-8 py-4 font-bold">ID</th>
                        <th className="px-8 py-4 font-bold">Asset</th>
                        <th className="px-8 py-4 font-bold">Type</th>
                        <th className="px-8 py-4 font-bold">Strategy</th>
                        <th className="px-8 py-4 font-bold">Profit/Loss</th>
                        <th className="px-8 py-4 font-bold">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {trades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-8 py-4 text-zinc-500 font-mono">#{trade.id}</td>
                          <td className="px-8 py-4 font-bold">{trade.symbol}</td>
                          <td className="px-8 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${trade.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {trade.type}
                            </span>
                          </td>
                          <td className="px-8 py-4 text-xs font-mono text-zinc-400">{trade.strategy}</td>
                          <td className={`px-8 py-4 font-mono font-bold ${trade.profit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                          </td>
                          <td className="px-8 py-4 text-xs text-zinc-500">
                            {new Date(trade.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-8">
                  <h2 className="text-2xl font-bold mb-6">System Configuration</h2>
                  
                  <div className="space-y-8">
                    <section>
                      <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">Risk Management</h3>
                      <div className="grid gap-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                          <div>
                            <p className="font-bold">Max Drawdown</p>
                            <p className="text-xs text-zinc-500">Stop all operations if loss exceeds this %</p>
                          </div>
                          <span className="font-mono text-emerald-400">15.0%</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                          <div>
                            <p className="font-bold">Position Sizing</p>
                            <p className="text-xs text-zinc-500">Percentage of balance per trade</p>
                          </div>
                          <span className="font-mono text-emerald-400">2.5%</span>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">API Integration</h3>
                      
                      <div className="space-y-4">
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${binanceStatus.connected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${binanceStatus.connected ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}>
                              <Zap size={20} />
                            </div>
                            <div>
                              <p className="font-bold">Binance Connection</p>
                              <p className="text-xs opacity-70">{binanceStatus.connected ? 'Connected and Active' : 'Disconnected / Simulation Mode'}</p>
                            </div>
                          </div>
                          <button 
                            onClick={checkBinance}
                            disabled={binanceStatus.loading}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            {binanceStatus.loading ? 'Checking...' : 'Check Connection'}
                          </button>
                        </div>

                        {binanceStatus.connected ? (
                          <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                            <h4 className="text-sm font-bold text-emerald-500 mb-2">Connection Verified</h4>
                            <p className="text-xs text-zinc-400">The system is successfully communicating with Binance using the provided credentials. Real-time data and execution are active.</p>
                          </div>
                        ) : (
                          <form onSubmit={handleConfigure} className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                            <h4 className="text-sm font-bold mb-4">Manual Configuration</h4>
                            
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 uppercase font-bold">Binance API Key</label>
                              <input 
                                type="password"
                                value={config.apiKey}
                                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                className={`w-full bg-black border ${validation.apiKey ? 'border-rose-500' : 'border-white/10'} rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors`}
                                placeholder="Enter 64-character API Key"
                              />
                              {validation.apiKey && <p className="text-[10px] text-rose-500 mt-1">{validation.apiKey}</p>}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 uppercase font-bold">Binance API Secret</label>
                              <input 
                                type="password"
                                value={config.apiSecret}
                                onChange={(e) => setConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                                className={`w-full bg-black border ${validation.apiSecret ? 'border-rose-500' : 'border-white/10'} rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors`}
                                placeholder="Enter 64-character API Secret"
                              />
                              {validation.apiSecret && <p className="text-[10px] text-rose-500 mt-1">{validation.apiSecret}</p>}
                            </div>

                            <button 
                              type="submit"
                              disabled={isConfiguring}
                              className="w-full bg-emerald-500 text-black font-bold py-2 rounded-lg text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50"
                            >
                              {isConfiguring ? 'Configuring...' : 'Apply Configuration'}
                            </button>

                            <div className="pt-4 border-t border-white/5">
                              <p className="text-[10px] text-zinc-500 leading-relaxed">
                                <span className="text-amber-500 font-bold">Note:</span> For maximum security, we recommend using the <strong>Secrets</strong> panel in the AI Studio editor. Keys entered here are used for the current session.
                              </p>
                            </div>
                          </form>
                        )}

                        {binanceStatus.error && binanceStatus.error !== 'API Keys not configured in Secrets.' && (
                          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-4">
                            <AlertCircle className="text-rose-500 shrink-0" size={20} />
                            <div>
                              <p className="text-sm font-bold text-rose-500">Connection Error</p>
                              <p className="text-xs text-rose-500/80 mt-1">{binanceStatus.error}</p>
                            </div>
                          </div>
                        )}
                        
                        {binanceStatus.error === 'API Keys not configured in Secrets.' && (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-4">
                            <AlertCircle className="text-amber-500 shrink-0" size={20} />
                            <div>
                              <p className="text-sm font-bold text-amber-500">Simulation Mode Active</p>
                              <p className="text-xs text-amber-500/80 mt-1">Real-time Binance data requires API keys. The system is currently running on high-fidelity simulated market data.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`group relative w-12 h-12 flex items-center justify-center rounded-xl transition-all ${active ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
    >
      {icon}
      <span className="absolute left-16 bg-white text-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

function StatCard({ label, value, trend, icon }: { label: string, value: string, trend: 'up' | 'down' | 'neutral', icon: React.ReactNode }) {
  return (
    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors">
          {icon}
        </div>
        {trend !== 'neutral' && (
          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {trend === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend === 'up' ? 'LIVE' : 'LIVE'}
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500 font-medium mb-1">{label}</p>
      <motion.p 
        key={value}
        initial={{ opacity: 0.5, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-mono font-bold"
      >
        {value}
      </motion.p>
    </div>
  );
}

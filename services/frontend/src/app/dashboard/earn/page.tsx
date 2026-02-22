'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { billingApi } from '@/lib/api';

export default function EarnPage() {
    const [earnedBalance, setEarnedBalance] = useState(0);
    const [totalBalance, setTotalBalance] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isRunning, setIsRunning] = useState(false);
    const [totalEarnedSession, setTotalEarnedSession] = useState(0);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchBalance = useCallback(async () => {
        try {
            const data = await billingApi.getCoins();
            setEarnedBalance(data.coin_balance_earned);
            setTotalBalance(data.coin_balance_total);
        } catch {
            console.error('Failed to fetch balance');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchBalance(); }, [fetchBalance]);

    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isRunning) {
            // Timer complete — earn coins!
            earnCoins();
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRunning, timeLeft]);

    const earnCoins = async () => {
        try {
            const result = await billingApi.earnCoins(10);
            setEarnedBalance(result.coin_balance_earned);
            setTotalBalance(result.coin_balance_total);
            setTotalEarnedSession(prev => prev + 10);
        } catch {
            console.error('Failed to earn coins');
        }
        // Reset timer
        setTimeLeft(60);
        setIsRunning(false);
    };

    const startTimer = () => {
        setTimeLeft(60);
        setIsRunning(true);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const progress = ((60 - timeLeft) / 60) * 100;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="h-8 w-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold gradient-text">Earn IronHostCoin</h1>
                <p className="text-muted-foreground mt-1">Start the timer and earn 10 IHC every minute</p>
            </div>

            {/* Balance Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card rounded-xl p-6 border border-emerald-500/20">
                    <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Earned Balance</p>
                    <p className="text-3xl font-bold text-emerald-400 mt-2">{earnedBalance} IHC</p>
                    <p className="text-xs text-muted-foreground mt-1">Permanent — never expires</p>
                </div>
                <div className="glass-card rounded-xl p-6 border border-primary-500/20">
                    <p className="text-xs text-primary-400 font-medium uppercase tracking-wider">Total Balance</p>
                    <p className="text-3xl font-bold gradient-text mt-2">{totalBalance} IHC</p>
                </div>
                <div className="glass-card rounded-xl p-6 border border-amber-500/20">
                    <p className="text-xs text-amber-400 font-medium uppercase tracking-wider">Earned This Session</p>
                    <p className="text-3xl font-bold text-amber-400 mt-2">{totalEarnedSession} IHC</p>
                </div>
            </div>

            {/* Timer */}
            <div className="glass-card rounded-xl p-8 border border-border/50 flex flex-col items-center">
                <div className="relative w-48 h-48 mb-8">
                    {/* Circular progress */}
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" stroke="currentColor" className="text-muted/20" strokeWidth="6" fill="none" />
                        <circle
                            cx="50" cy="50" r="45"
                            stroke="url(#gradient)"
                            strokeWidth="6" fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${Math.PI * 90}`}
                            strokeDashoffset={`${Math.PI * 90 * (1 - progress / 100)}`}
                            className="transition-all duration-1000"
                        />
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold text-foreground font-mono">{formatTime(timeLeft)}</span>
                        <span className="text-xs text-muted-foreground mt-1">{isRunning ? 'Earning...' : 'Ready'}</span>
                    </div>
                </div>

                {!isRunning ? (
                    <button
                        onClick={startTimer}
                        className="px-8 py-3 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-all text-lg"
                    >
                        Start Earning
                    </button>
                ) : (
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">Timer is running — wait for completion</p>
                        <p className="text-lg font-semibold text-amber-400 mt-2">+10 IHC in {formatTime(timeLeft)}</p>
                    </div>
                )}

                <p className="text-sm text-muted-foreground mt-6 text-center max-w-md">
                    Earned coins are <span className="text-emerald-400 font-medium">permanent</span> and will never expire.
                    Unlike monthly granted coins, your earned IHC is yours to keep forever.
                </p>
            </div>
        </div>
    );
}

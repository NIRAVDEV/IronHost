'use client';

import { useState, useEffect } from 'react';
import { billingApi, userApi, User } from '@/lib/api';

interface ResourceItem {
    id: string;
    name: string;
    cost_ihc: number;
    description: string;
    icon: string;
    category: 'ram' | 'cpu' | 'storage';
}

const COIN_PACKAGES = [
    { id: '100', amount: 100, price: '₹79', label: 'Starter', color: '#60a5fa' },
    { id: '500', amount: 500, price: '₹349', label: 'Pro', color: '#a78bfa', popular: true },
    { id: '2000', amount: 2000, price: '₹999', label: 'Mega', color: '#f59e0b' },
];

const RESOURCE_ITEMS: ResourceItem[] = [
    { id: 'ram_1gb', name: '1 GB RAM', cost_ihc: 20, description: 'Add 1 GB to your resource pool', icon: '🧠', category: 'ram' },
    { id: 'ram_4gb', name: '4 GB RAM', cost_ihc: 70, description: 'Add 4 GB to your resource pool', icon: '🧠', category: 'ram' },
    { id: 'cpu_1core', name: '1 CPU Core', cost_ihc: 30, description: 'Add 1 CPU core to your pool', icon: '⚡', category: 'cpu' },
    { id: 'storage_5gb', name: '5 GB Storage', cost_ihc: 15, description: 'Add 5 GB disk space', icon: '💾', category: 'storage' },
    { id: 'storage_20gb', name: '20 GB Storage', cost_ihc: 50, description: 'Add 20 GB disk space', icon: '💾', category: 'storage' },
];

export default function StorePage() {
    const [tab, setTab] = useState<'coins' | 'resources'>('coins');
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [successItem, setSuccessItem] = useState<string | null>(null);
    const [confetti, setConfetti] = useState(false);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const u = await userApi.getMe();
            setUser(u);
        } catch {
            console.error('Failed to load user');
        } finally {
            setLoading(false);
        }
    };

    const handleBuyCoins = async (packageId: string) => {
        setPurchasing(packageId);
        try {
            await billingApi.purchaseCoins(packageId);
            triggerSuccess(packageId);
            await loadUser();
        } catch {
            alert('Purchase failed. Please try again.');
        } finally {
            setPurchasing(null);
        }
    };

    const handleBuyResource = async (resourceId: string) => {
        setPurchasing(resourceId);
        try {
            await billingApi.purchaseResource(resourceId);
            triggerSuccess(resourceId);
            await loadUser();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Not enough IronHostCoin';
            alert(msg);
        } finally {
            setPurchasing(null);
        }
    };

    const triggerSuccess = (itemId: string) => {
        setSuccessItem(itemId);
        setConfetti(true);
        setTimeout(() => setSuccessItem(null), 2000);
        setTimeout(() => setConfetti(false), 3000);
    };

    const totalCoins = (user?.coin_balance_granted || 0) + (user?.coin_balance_earned || 0);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div style={{ padding: '32px', maxWidth: 1000, margin: '0 auto' }}>
            {/* Confetti overlay */}
            {confetti && (
                <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }}>
                    {Array.from({ length: 40 }).map((_, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            left: `${Math.random() * 100}%`,
                            top: '-10px',
                            width: `${6 + Math.random() * 8}px`,
                            height: `${6 + Math.random() * 8}px`,
                            backgroundColor: ['#a78bfa', '#f59e0b', '#60a5fa', '#34d399', '#f472b6', '#fbbf24'][i % 6],
                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            animation: `confettiFall ${1.5 + Math.random() * 2}s ease-out forwards`,
                            animationDelay: `${Math.random() * 0.5}s`,
                        }} />
                    ))}
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>Store</h1>
                <p style={{ color: '#9ca3af', marginTop: 4 }}>Purchase IronHostCoin and resources for your servers</p>
            </div>

            {/* Balance bar */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(96,165,250,0.1))',
                border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: 12,
                padding: '16px 24px',
                marginBottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
            }}>
                <div>
                    <div style={{ color: '#9ca3af', fontSize: 13 }}>IronHostCoin Balance</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#a78bfa' }}>🪙 {totalCoins.toLocaleString()} IHC</div>
                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                        {user?.coin_balance_earned || 0} earned · {user?.coin_balance_granted || 0} granted
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#60a5fa', fontSize: 13 }}>🧠 RAM</div>
                        <div style={{ color: '#fff', fontWeight: 600 }}>{formatMB(user?.resource_ram_used_mb || 0)} / {formatMB(user?.resource_ram_mb || 0)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#34d399', fontSize: 13 }}>⚡ CPU</div>
                        <div style={{ color: '#fff', fontWeight: 600 }}>{formatCPU(user?.resource_cpu_used_cores || 0)} / {formatCPU(user?.resource_cpu_cores || 0)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#f59e0b', fontSize: 13 }}>💾 Storage</div>
                        <div style={{ color: '#fff', fontWeight: 600 }}>{formatMB(user?.resource_storage_used_mb || 0)} / {formatMB(user?.resource_storage_mb || 0)}</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {(['coins', 'resources'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        padding: '10px 24px',
                        borderRadius: 8,
                        border: 'none',
                        background: tab === t ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                        color: tab === t ? '#a78bfa' : '#9ca3af',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: 14,
                        transition: 'all 0.2s',
                    }}>
                        {t === 'coins' ? '🪙 Buy IronHostCoin' : '📦 Resources'}
                    </button>
                ))}
            </div>

            {/* Coin Packages */}
            {tab === 'coins' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                    {COIN_PACKAGES.map(pkg => (
                        <div key={pkg.id} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: successItem === pkg.id ? '2px solid #34d399' : pkg.popular ? '2px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 16,
                            padding: 24,
                            position: 'relative',
                            transition: 'all 0.3s',
                            transform: successItem === pkg.id ? 'scale(1.02)' : 'scale(1)',
                        }}>
                            {pkg.popular && (
                                <div style={{
                                    position: 'absolute', top: -10, right: 16,
                                    background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                                    padding: '4px 12px', borderRadius: 20,
                                    fontSize: 11, fontWeight: 700, color: '#fff',
                                }}>POPULAR</div>
                            )}
                            {successItem === pkg.id && (
                                <div style={{
                                    position: 'absolute', top: 12, right: 12,
                                    color: '#34d399', fontSize: 24, animation: 'successPop 0.5s ease-out',
                                }}>✓</div>
                            )}
                            <div style={{ fontSize: 14, color: '#9ca3af', fontWeight: 600, marginBottom: 8 }}>{pkg.label}</div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: pkg.color, marginBottom: 4 }}>
                                🪙 {pkg.amount.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{pkg.price}</div>
                            <button
                                onClick={() => handleBuyCoins(pkg.id)}
                                disabled={purchasing === pkg.id}
                                style={{
                                    width: '100%', padding: '12px 0', borderRadius: 10,
                                    border: 'none', fontWeight: 700, cursor: purchasing === pkg.id ? 'wait' : 'pointer',
                                    background: purchasing === pkg.id ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${pkg.color}, ${pkg.color}bb)`,
                                    color: '#fff', fontSize: 14,
                                    opacity: purchasing === pkg.id ? 0.6 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {purchasing === pkg.id ? 'Processing...' : 'Buy Now'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Resource Items */}
            {tab === 'resources' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {RESOURCE_ITEMS.map(item => (
                        <div key={item.id} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: successItem === item.id ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 14,
                            padding: '20px 24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.3s',
                            transform: successItem === item.id ? 'scale(1.01)' : 'scale(1)',
                        }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{item.icon} {item.name}</div>
                                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{item.description}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>🪙 {item.cost_ihc} IHC</div>
                                <button
                                    onClick={() => handleBuyResource(item.id)}
                                    disabled={purchasing === item.id}
                                    style={{
                                        padding: '8px 20px', borderRadius: 8,
                                        border: 'none', fontWeight: 600, cursor: purchasing === item.id ? 'wait' : 'pointer',
                                        background: successItem === item.id ? '#34d399' : purchasing === item.id ? 'rgba(255,255,255,0.1)' : 'rgba(167,139,250,0.2)',
                                        color: successItem === item.id ? '#fff' : '#a78bfa',
                                        fontSize: 13,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {successItem === item.id ? '✓ Added!' : purchasing === item.id ? '...' : 'Buy'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Animations */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes confettiFall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                @keyframes successPop {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.3); }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

function formatMB(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
}

function formatCPU(cores: number): string {
    if (cores === 0) return '0';
    return `${(cores / 100).toFixed(cores % 100 === 0 ? 0 : 1)}`;
}

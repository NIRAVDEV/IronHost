'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { serversApi, Server } from '@/lib/api';

// Control button component
function ControlButton({
    icon,
    label,
    variant = 'default',
    disabled = false,
    loading = false,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    variant?: 'default' | 'danger' | 'success';
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
}) {
    const variants = {
        default: 'bg-muted/50 hover:bg-muted text-foreground',
        success: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30',
        danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30',
    };

    return (
        <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${variants[variant]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled || loading}
            onClick={onClick}
        >
            {loading ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
                icon
            )}
            {label}
        </button>
    );
}

// Resource gauge
function ResourceGauge({
    label,
    value,
    max,
    unit,
    color = 'primary'
}: {
    label: string;
    value: number;
    max: number;
    unit: string;
    color?: 'primary' | 'accent';
}) {
    const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
    const gradientClass = color === 'primary'
        ? 'from-primary-500 to-primary-600'
        : 'from-accent-500 to-accent-600';

    return (
        <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground">{value} / {max} {unit}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full bg-gradient-to-r ${gradientClass} rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{percentage}% allocated</p>
        </div>
    );
}

export default function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [server, setServer] = useState<Server | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchServer = async () => {
        try {
            const data = await serversApi.get(id);
            setServer(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch server:', err);
            setError('Failed to load server');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchServer();
        // Auto-refresh every 5 seconds
        const interval = setInterval(fetchServer, 5000);
        return () => clearInterval(interval);
    }, [id]);

    const handleAction = async (action: 'start' | 'stop' | 'restart' | 'delete') => {
        if (!server) return;
        setActionLoading(action);
        try {
            if (action === 'start') await serversApi.start(server.id);
            else if (action === 'stop') await serversApi.stop(server.id);
            else if (action === 'restart') await serversApi.restart(server.id);
            else if (action === 'delete') {
                await serversApi.delete(server.id);
                window.location.href = '/dashboard/servers';
                return;
            }
            // Refresh server data after action
            await fetchServer();
        } catch (err) {
            console.error(`Failed to ${action} server:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    const statusColors: Record<string, string> = {
        running: 'status-running',
        stopped: 'status-stopped',
        starting: 'status-starting',
        installing: 'status-starting',
        offline: 'status-stopped',
    };

    const statusLabels: Record<string, string> = {
        running: 'Running',
        stopped: 'Offline',
        starting: 'Starting...',
        installing: 'Installing...',
        offline: 'Offline',
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !server) {
        return (
            <div className="glass-card rounded-xl p-8 text-center">
                <p className="text-red-400 mb-2">{error || 'Server not found'}</p>
                <Link href="/dashboard/servers" className="text-primary-400 hover:underline">
                    Back to Servers
                </Link>
            </div>
        );
    }

    const isRunning = server.status === 'running';
    const isStopped = server.status === 'stopped' || server.status === 'offline';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
                <Link href="/dashboard/servers" className="text-muted-foreground hover:text-foreground transition-colors">
                    Servers
                </Link>
                <span className="text-muted-foreground">/</span>
                <span className="text-foreground">{server.name}</span>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                            <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                            <line x1="6" x2="6.01" y1="6" y2="6" />
                            <line x1="6" x2="6.01" y1="18" y2="18" />
                        </svg>
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-foreground">{server.name}</h1>
                            <span className={`status-dot ${statusColors[server.status] || 'status-stopped'}`} />
                            <span className="text-sm text-muted-foreground">{statusLabels[server.status] || server.status}</span>
                        </div>
                        <p className="text-muted-foreground">{server.docker_image}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    {isStopped ? (
                        <ControlButton
                            icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
                            label="Start"
                            variant="success"
                            loading={actionLoading === 'start'}
                            onClick={() => handleAction('start')}
                        />
                    ) : (
                        <ControlButton
                            icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></svg>}
                            label="Stop"
                            variant="danger"
                            loading={actionLoading === 'stop'}
                            onClick={() => handleAction('stop')}
                            disabled={!isRunning}
                        />
                    )}
                    <ControlButton
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>}
                        label="Restart"
                        loading={actionLoading === 'restart'}
                        onClick={() => handleAction('restart')}
                        disabled={!isRunning}
                    />
                    <Link
                        href={`/dashboard/servers/${server.id}/console`}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium gradient-primary text-white hover:opacity-90 transition-opacity"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,17 10,11 4,5" /><line x1="12" x2="20" y1="19" y2="19" /></svg>
                        Console
                    </Link>
                    <ControlButton
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>}
                        label="Delete"
                        variant="danger"
                        loading={actionLoading === 'delete'}
                        onClick={() => {
                            if (confirm('Are you sure you want to delete this server? This cannot be undone.')) {
                                handleAction('delete');
                            }
                        }}
                    />
                </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{statusLabels[server.status] || server.status}</p>
                    <p className="text-sm text-muted-foreground">Status</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{server.memory_limit} MB</p>
                    <p className="text-sm text-muted-foreground">Memory Limit</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{server.cpu_limit}%</p>
                    <p className="text-sm text-muted-foreground">CPU Limit</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold gradient-text">{server.disk_limit} MB</p>
                    <p className="text-sm text-muted-foreground">Disk Limit</p>
                </div>
            </div>

            {/* Resource gauges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ResourceGauge
                    label="Memory"
                    value={server.memory_used || 0}
                    max={server.memory_limit}
                    unit="MB"
                    color="primary"
                />
                <ResourceGauge
                    label="CPU"
                    value={server.cpu_used || 0}
                    max={server.cpu_limit}
                    unit="%"
                    color="accent"
                />
                <ResourceGauge
                    label="Disk"
                    value={server.disk_used || 0}
                    max={server.disk_limit}
                    unit="MB"
                    color="primary"
                />
            </div>

            {/* Navigation tabs */}
            <div className="glass-card rounded-xl p-1 flex gap-1">
                <button className="flex-1 py-2 text-sm font-medium rounded-lg bg-primary-500/10 text-primary-400">
                    Overview
                </button>
                <Link href={`/dashboard/servers/${server.id}/console`} className="flex-1 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-center">
                    Console
                </Link>
                <button className="flex-1 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Files
                </button>
                <button className="flex-1 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Settings
                </button>
            </div>
        </div>
    );
}

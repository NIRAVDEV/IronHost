'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { serversApi, Server } from '@/lib/api';

// ─── Per-user resource limits (hardcoded free tier) ───
const LIMITS = {
    ram: 1024,      // 1 GB in MB
    cpu: 100,       // 1 core = 100%
    storage: 1024,  // 1 GB in MB
};

// ─── Resource bar component ───
function ResourceBar({
    label,
    icon,
    used,
    total,
    unit,
    color,
}: {
    label: string;
    icon: React.ReactNode;
    used: number;
    total: number;
    unit: string;
    color: string;
}) {
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    const isOver = used > total;

    // Format values nicely
    const fmt = (v: number) => {
        if (unit === 'MB') {
            return v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${v} MB`;
        }
        if (unit === '%') {
            return `${(v / 100).toFixed(1)} cores`;
        }
        return `${v} ${unit}`;
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {icon}
                    {label}
                </div>
                <span className={`text-xs font-medium tabular-nums ${isOver ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {fmt(used)} / {fmt(total)}
                </span>
            </div>
            <div className="h-2 rounded-full bg-border/50 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${isOver ? 'bg-red-500' : color
                        }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
        </div>
    );
}

// ─── Server card ───
function ServerListCard({
    id,
    name,
    status,
    docker_image,
    memory_limit,
    cpu_limit,
}: {
    id: string;
    name: string;
    status: string;
    docker_image: string;
    memory_limit: number;
    cpu_limit: number;
}) {
    const statusColors: Record<string, string> = {
        running: 'status-running',
        stopped: 'status-stopped',
        starting: 'status-starting',
        installing: 'status-starting',
    };

    const statusLabels: Record<string, string> = {
        running: 'Running',
        stopped: 'Offline',
        starting: 'Starting...',
        installing: 'Installing...',
    };

    return (
        <Link href={`/dashboard/servers/${id}`}>
            <div className="glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.01] cursor-pointer group">
                <div className="flex items-center justify-between">
                    {/* Left: Server info */}
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                                <line x1="6" x2="6.01" y1="6" y2="6" />
                                <line x1="6" x2="6.01" y1="18" y2="18" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground group-hover:text-primary-400 transition-colors">
                                {name}
                            </h3>
                            <p className="text-sm text-muted-foreground">{docker_image}</p>
                        </div>
                    </div>

                    {/* Middle: Stats */}
                    <div className="hidden md:flex items-center gap-8">
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">Memory</p>
                            <p className="text-sm font-medium text-foreground">{memory_limit} MB</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">CPU</p>
                            <p className="text-sm font-medium text-foreground">{cpu_limit}%</p>
                        </div>
                    </div>

                    {/* Right: Status */}
                    <div className="flex items-center gap-3">
                        <span className={`status-dot ${statusColors[status] || 'status-stopped'}`} />
                        <span className="text-sm text-muted-foreground">{statusLabels[status] || status}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground group-hover:text-primary-400 transition-colors">
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </div>
                </div>
            </div>
        </Link>
    );
}

// ─── Page ───
export default function ServersPage() {
    const [servers, setServers] = useState<Server[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchServers() {
            try {
                const data = await serversApi.list();
                setServers(data || []);
            } catch (err) {
                console.error('Failed to fetch servers:', err);
                setError('Failed to load servers');
            } finally {
                setIsLoading(false);
            }
        }
        fetchServers();
        const interval = setInterval(fetchServers, 5000);
        return () => clearInterval(interval);
    }, []);

    // Compute resource usage from servers
    const usage = useMemo(() => {
        return {
            ram: servers.reduce((sum, s) => sum + (s.memory_limit || 0), 0),
            cpu: servers.reduce((sum, s) => sum + (s.cpu_limit || 0), 0),
            storage: servers.reduce((sum, s) => sum + (s.disk_limit || 0), 0),
        };
    }, [servers]);

    const canCreateMore = usage.ram < LIMITS.ram || usage.cpu < LIMITS.cpu || usage.storage < LIMITS.storage;
    const runningCount = servers.filter(s => s.status === 'running').length;
    const stoppedCount = servers.filter(s => s.status === 'stopped').length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Servers</h1>
                    <p className="text-muted-foreground">Manage your game servers</p>
                </div>
                {canCreateMore && (
                    <Link
                        href="/dashboard/servers/new"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14" />
                            <path d="M12 5v14" />
                        </svg>
                        Create Server
                    </Link>
                )}
            </div>

            {/* Resource Usage Dashboard */}
            <div className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Your Resources</h2>
                    <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted/30 border border-border">Free Plan</span>
                </div>
                <div className="grid gap-4">
                    <ResourceBar
                        label="RAM"
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 19v-3" /><path d="M10 19v-3" /><path d="M14 19v-3" /><path d="M18 19v-3" />
                                <path d="M8 11V9" /><path d="M16 11V9" />
                                <path d="M12 11V9" />
                                <path d="M2 15h20" />
                                <path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" />
                            </svg>
                        }
                        used={usage.ram}
                        total={LIMITS.ram}
                        unit="MB"
                        color="bg-blue-500"
                    />
                    <ResourceBar
                        label="CPU"
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect width="16" height="16" x="4" y="4" rx="2" />
                                <rect width="6" height="6" x="9" y="9" rx="1" />
                                <path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" />
                                <path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" />
                            </svg>
                        }
                        used={usage.cpu}
                        total={LIMITS.cpu}
                        unit="%"
                        color="bg-emerald-500"
                    />
                    <ResourceBar
                        label="Storage"
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 5c0-1.1-3.1-2-7-2S7 3.9 7 5" />
                                <path d="M3 5c0-1.1 3.1-2 7-2s7 .9 7 2" />
                                <ellipse cx="12" cy="5" rx="9" ry="3" />
                                <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
                                <path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />
                            </svg>
                        }
                        used={usage.storage}
                        total={LIMITS.storage}
                        unit="MB"
                        color="bg-amber-500"
                    />
                </div>
            </div>

            {/* Filters — only show when there are servers */}
            {servers.length > 0 && (
                <div className="flex items-center gap-3">
                    <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/30">
                        All ({servers.length})
                    </button>
                    <button className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors">
                        Running ({runningCount})
                    </button>
                    <button className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors">
                        Offline ({stoppedCount})
                    </button>
                </div>
            )}

            {/* Server list */}
            <div className="space-y-3 stagger-children">
                {isLoading ? (
                    <div className="glass-card rounded-xl p-8 text-center">
                        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-muted-foreground">Loading servers...</p>
                    </div>
                ) : error ? (
                    <div className="glass-card rounded-xl p-8 text-center">
                        <p className="text-red-400 mb-2">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-primary-400 hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                ) : servers.length === 0 ? (
                    <div className="glass-card rounded-xl p-12 text-center">
                        {/* Big illustrative empty state */}
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-400 mx-auto mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                                <line x1="6" x2="6.01" y1="6" y2="6" />
                                <line x1="6" x2="6.01" y1="18" y2="18" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">No servers yet</h3>
                        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                            You haven&apos;t created any servers. Deploy your first Minecraft server in under a minute!
                        </p>
                        <Link
                            href="/dashboard/servers/new"
                            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-xl gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary-500/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                            Create Your First Server
                        </Link>
                    </div>
                ) : (
                    servers.map((server) => (
                        <ServerListCard
                            key={server.id}
                            id={server.id}
                            name={server.name}
                            status={server.status}
                            docker_image={server.docker_image || 'Minecraft'}
                            memory_limit={server.memory_limit}
                            cpu_limit={server.cpu_limit}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

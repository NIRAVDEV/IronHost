'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { serversApi, Server } from '@/lib/api';

// Server card for the servers list
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
        // Auto-refresh every 5 seconds
        const interval = setInterval(fetchServers, 5000);
        return () => clearInterval(interval);
    }, []);

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
            </div>

            {/* Filters */}
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

            {/* Server list */}
            <div className="space-y-3 stagger-children">
                {isLoading ? (
                    <div className="glass-card rounded-xl p-8 text-center">
                        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
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
                    <div className="glass-card rounded-xl p-8 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10 text-primary-400 mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                                <line x1="6" x2="6.01" y1="6" y2="6" />
                                <line x1="6" x2="6.01" y1="18" y2="18" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">No servers yet</h3>
                        <p className="text-muted-foreground mb-4">Create your first game server to get started</p>
                        <Link
                            href="/dashboard/servers/new"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                            Create Server
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

'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { nodesApi, Node } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

interface NodeStats {
    total_memory_bytes: number;
    available_memory_bytes: number;
    total_disk_bytes: number;
    available_disk_bytes: number;
    cpu_usage_percent: number;
    running_containers: number;
    uptime_seconds: number;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function NodeCard({ node, stats, statsLoading, onDelete }: {
    node: Node;
    stats: NodeStats | null;
    statsLoading: boolean;
    onDelete: (id: string) => void;
}) {
    const isOnline = stats !== null;
    const memoryUsedPercent = node.memory_total > 0 ? (node.memory_allocated / node.memory_total) * 100 : 0;
    const diskUsedPercent = node.disk_total > 0 ? (node.disk_allocated / node.disk_total) * 100 : 0;

    // Live CPU color
    const cpuColor = stats
        ? stats.cpu_usage_percent > 80 ? 'text-red-400' : stats.cpu_usage_percent > 50 ? 'text-yellow-400' : 'text-green-400'
        : 'text-muted-foreground';

    return (
        <div className="glass-card rounded-xl p-5 hover:border-primary-500/20 transition-all">
            {/* Top row: name, status, actions */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isOnline ? 'bg-green-500/10 text-green-400' : statsLoading ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                            <line x1="6" y1="6" x2="6.01" y2="6" />
                            <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">{node.name}</h3>
                        <p className="text-sm text-muted-foreground">{node.fqdn}:{node.grpc_port}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className={`status-dot ${isOnline ? 'status-running' : statsLoading ? 'status-starting' : 'status-stopped'}`} />
                        <span className="text-sm text-muted-foreground">
                            {isOnline ? 'Online' : statsLoading ? 'Checking...' : 'Offline'}
                        </span>
                    </div>
                    <button
                        onClick={() => onDelete(node.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Node"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* Memory Allocated */}
                <div className="rounded-lg bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Memory Allocated</p>
                    <p className="text-sm font-medium text-foreground">
                        {(node.memory_allocated / 1024).toFixed(1)} / {(node.memory_total / 1024).toFixed(1)} GB
                    </p>
                    <div className="w-full h-1.5 bg-muted rounded-full mt-1.5">
                        <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${Math.min(memoryUsedPercent, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Disk Allocated */}
                <div className="rounded-lg bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Disk Allocated</p>
                    <p className="text-sm font-medium text-foreground">
                        {(node.disk_allocated / 1024).toFixed(1)} / {(node.disk_total / 1024).toFixed(1)} GB
                    </p>
                    <div className="w-full h-1.5 bg-muted rounded-full mt-1.5">
                        <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${Math.min(diskUsedPercent, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Live CPU */}
                <div className="rounded-lg bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">CPU Usage</p>
                    <p className={`text-sm font-medium ${cpuColor}`}>
                        {stats ? `${stats.cpu_usage_percent.toFixed(1)}%` : '—'}
                    </p>
                </div>

                {/* Live RAM */}
                <div className="rounded-lg bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Available RAM</p>
                    <p className="text-sm font-medium text-foreground">
                        {stats ? formatBytes(stats.available_memory_bytes) : '—'}
                    </p>
                </div>

                {/* Containers + Uptime */}
                <div className="rounded-lg bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Containers / Uptime</p>
                    <p className="text-sm font-medium text-foreground">
                        {stats ? `${stats.running_containers} 🐳 · ${formatUptime(stats.uptime_seconds)}` : '—'}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function NodesPage() {
    const router = useRouter();
    const { isAdmin, isLoading: authLoading } = useAuthStore();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [nodeStats, setNodeStats] = useState<Record<string, NodeStats | null>>({});
    const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Redirect non-admin users
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [authLoading, isAdmin, router]);

    const fetchNodes = useCallback(async () => {
        try {
            const data = await nodesApi.list();
            setNodes(data || []);
            return data || [];
        } catch (err) {
            console.error('Failed to fetch nodes:', err);
            setError('Failed to load nodes');
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch stats for all nodes
    const fetchAllStats = useCallback(async (nodeList: Node[]) => {
        for (const node of nodeList) {
            setStatsLoading(prev => ({ ...prev, [node.id]: true }));
            try {
                const stats = await nodesApi.getStats(node.id);
                setNodeStats(prev => ({ ...prev, [node.id]: stats }));
            } catch {
                setNodeStats(prev => ({ ...prev, [node.id]: null }));
            } finally {
                setStatsLoading(prev => ({ ...prev, [node.id]: false }));
            }
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        fetchNodes().then(nodeList => {
            if (nodeList.length > 0) fetchAllStats(nodeList);
        });
    }, [isAdmin, fetchNodes, fetchAllStats]);

    // Auto-refresh stats every 30 seconds
    useEffect(() => {
        if (!isAdmin || nodes.length === 0) return;
        const interval = setInterval(() => fetchAllStats(nodes), 30000);
        return () => clearInterval(interval);
    }, [isAdmin, nodes, fetchAllStats]);

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this node?')) return;

        try {
            await nodesApi.delete(id);
            setNodes(nodes.filter(n => n.id !== id));
        } catch (err) {
            console.error('Failed to delete node:', err);
            alert('Failed to delete node');
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Nodes</h1>
                    <p className="text-muted-foreground">Manage your server infrastructure</p>
                </div>
                <Link
                    href="/dashboard/nodes/new"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                    </svg>
                    Add Node
                </Link>
            </div>

            {/* Node list */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="glass-card rounded-xl p-8 text-center">
                        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading nodes...</p>
                    </div>
                ) : error ? (
                    <div className="glass-card rounded-xl p-8 text-center">
                        <p className="text-red-400 mb-2">{error}</p>
                        <button onClick={fetchNodes} className="text-primary-400 hover:underline">
                            Retry
                        </button>
                    </div>
                ) : nodes.length === 0 ? (
                    <div className="glass-card rounded-xl p-8 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10 text-primary-400 mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                <line x1="6" y1="6" x2="6.01" y2="6" />
                                <line x1="6" y1="18" x2="6.01" y2="18" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">No nodes yet</h3>
                        <p className="text-muted-foreground mb-4">Add a node to start deploying game servers</p>
                        <Link
                            href="/dashboard/nodes/new"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                            Add Node
                        </Link>
                    </div>
                ) : (
                    nodes.map((node) => (
                        <NodeCard
                            key={node.id}
                            node={node}
                            stats={nodeStats[node.id] ?? null}
                            statsLoading={statsLoading[node.id] ?? false}
                            onDelete={handleDelete}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

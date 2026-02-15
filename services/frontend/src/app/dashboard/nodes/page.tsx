'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nodesApi, Node } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function NodeCard({ node, onDelete }: { node: Node; onDelete: (id: string) => void }) {
    const isOnline = !node.maintenance_mode;
    const memoryUsedPercent = (node.memory_allocated / node.memory_total) * 100;
    const diskUsedPercent = (node.disk_allocated / node.disk_total) * 100;

    return (
        <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between">
                {/* Left: Node info */}
                <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isOnline ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                            <line x1="6" y1="6" x2="6.01" y2="6" />
                            <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">{node.name}</h3>
                        <p className="text-sm text-muted-foreground">{node.fqdn}</p>
                    </div>
                </div>

                {/* Middle: Resources */}
                <div className="hidden md:flex items-center gap-8">
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Memory</p>
                        <p className="text-sm font-medium text-foreground">
                            {(node.memory_allocated / 1024).toFixed(1)} / {(node.memory_total / 1024).toFixed(1)} GB
                        </p>
                        <div className="w-24 h-1.5 bg-muted rounded-full mt-1">
                            <div
                                className="h-full bg-primary-500 rounded-full"
                                style={{ width: `${Math.min(memoryUsedPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Disk</p>
                        <p className="text-sm font-medium text-foreground">
                            {(node.disk_allocated / 1024).toFixed(1)} / {(node.disk_total / 1024).toFixed(1)} GB
                        </p>
                        <div className="w-24 h-1.5 bg-muted rounded-full mt-1">
                            <div
                                className="h-full bg-primary-500 rounded-full"
                                style={{ width: `${Math.min(diskUsedPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Status + Actions */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className={`status-dot ${isOnline ? 'status-running' : 'status-starting'}`} />
                        <span className="text-sm text-muted-foreground">
                            {isOnline ? 'Online' : 'Maintenance'}
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
        </div>
    );
}

export default function NodesPage() {
    const router = useRouter();
    const { isAdmin, isLoading: authLoading } = useAuthStore();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Redirect non-admin users
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) fetchNodes();
    }, [isAdmin]);

    async function fetchNodes() {
        try {
            const data = await nodesApi.list();
            setNodes(data || []);
        } catch (err) {
            console.error('Failed to fetch nodes:', err);
            setError('Failed to load nodes');
        } finally {
            setIsLoading(false);
        }
    }

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
                        <NodeCard key={node.id} node={node} onDelete={handleDelete} />
                    ))
                )}
            </div>
        </div>
    );
}

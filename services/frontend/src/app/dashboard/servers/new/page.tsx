'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { serversApi, nodesApi, Node } from '@/lib/api';

export default function CreateServerPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [nodesLoading, setNodesLoading] = useState(true);

    // Form state
    const [name, setName] = useState('');
    const [nodeId, setNodeId] = useState('');
    const [memoryLimit, setMemoryLimit] = useState(2048);
    const [diskLimit, setDiskLimit] = useState(10240);
    const [gameType, setGameType] = useState('VANILLA');

    useEffect(() => {
        async function fetchNodes() {
            try {
                const data = await nodesApi.list();
                setNodes(data || []);
                if (data && data.length > 0) {
                    setNodeId(data[0].id);
                }
            } catch (err) {
                console.error('Failed to fetch nodes:', err);
                setError('Failed to load available nodes');
            } finally {
                setNodesLoading(false);
            }
        }
        fetchNodes();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await serversApi.create({
                name,
                node_id: nodeId,
                memory_limit: memoryLimit,
                disk_limit: diskLimit,
                game_type: gameType,
            });
            router.push('/dashboard/servers');
        } catch (err: unknown) {
            console.error('Failed to create server:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to create server';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const gameTypes = [
        { value: 'VANILLA', label: 'Minecraft Vanilla' },
        { value: 'PAPER', label: 'Minecraft Paper' },
        { value: 'SPIGOT', label: 'Minecraft Spigot' },
        { value: 'FORGE', label: 'Minecraft Forge' },
        { value: 'FABRIC', label: 'Minecraft Fabric' },
    ];

    const memoryOptions = [
        { value: 1024, label: '1 GB' },
        { value: 2048, label: '2 GB' },
        { value: 4096, label: '4 GB' },
        { value: 8192, label: '8 GB' },
        { value: 16384, label: '16 GB' },
    ];

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/dashboard/servers"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Back to Servers
                </Link>
                <h1 className="text-2xl font-bold text-foreground">Create New Server</h1>
                <p className="text-muted-foreground">Configure and deploy a new game server</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass-card rounded-xl p-6 space-y-6">
                    {/* Server Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                            Server Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Awesome Server"
                            required
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground placeholder:text-muted-foreground"
                        />
                    </div>

                    {/* Game Type */}
                    <div>
                        <label htmlFor="gameType" className="block text-sm font-medium text-foreground mb-2">
                            Game Type
                        </label>
                        <select
                            id="gameType"
                            value={gameType}
                            onChange={(e) => setGameType(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                        >
                            {gameTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Node Selection */}
                    <div>
                        <label htmlFor="node" className="block text-sm font-medium text-foreground mb-2">
                            Target Node
                        </label>
                        {nodesLoading ? (
                            <div className="w-full px-4 py-3 rounded-lg bg-background border border-border text-muted-foreground">
                                Loading nodes...
                            </div>
                        ) : nodes.length === 0 ? (
                            <div className="w-full px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                                No nodes available. Please add a node first.
                            </div>
                        ) : (
                            <select
                                id="node"
                                value={nodeId}
                                onChange={(e) => setNodeId(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                            >
                                {nodes.map((node) => (
                                    <option key={node.id} value={node.id}>
                                        {node.name} ({node.fqdn})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Memory Limit */}
                    <div>
                        <label htmlFor="memory" className="block text-sm font-medium text-foreground mb-2">
                            Memory (RAM)
                        </label>
                        <select
                            id="memory"
                            value={memoryLimit}
                            onChange={(e) => setMemoryLimit(Number(e.target.value))}
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                        >
                            {memoryOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Disk Limit */}
                    <div>
                        <label htmlFor="disk" className="block text-sm font-medium text-foreground mb-2">
                            Storage (MB)
                        </label>
                        <input
                            type="number"
                            id="disk"
                            value={diskLimit}
                            onChange={(e) => setDiskLimit(Number(e.target.value))}
                            min={1024}
                            max={102400}
                            step={1024}
                            className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {(diskLimit / 1024).toFixed(1)} GB storage
                        </p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={isLoading || nodes.length === 0}
                        className="w-full py-3 px-4 text-white font-medium rounded-lg gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                Creating Server...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14" />
                                    <path d="M12 5v14" />
                                </svg>
                                Create Server
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

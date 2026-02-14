'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, use, useCallback } from 'react';
import { serversApi, Server } from '@/lib/api';

// ── Noise filter: hide logs a customer doesn't care about ──
const NOISE_PATTERNS = [
    /\[init\]/i,
    /Unpacking /,
    /^WARNING:/,
    /\[mc-image-helper\]/,
    /^Starting net\.minecraft\.server/,
    /Thread RCON Client/,
    /Thread RCON Listener/,
    /RCON running on/,
    /RCON Client .* shutting down/,
    /mc-server-runner/,
    /Stopping with rcon-cli/,
];

function isNoisy(raw: string): boolean {
    const line = raw.replace(/[\x00-\x08]/g, '').replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, '');
    if (line.trim().length === 0) return true;
    for (const p of NOISE_PATTERNS) {
        if (p.test(line)) return true;
    }
    return false;
}

function clean(raw: string): string {
    return raw
        .replace(/[\x00-\x08]/g, '')
        .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, '')
        .replace(/^\d{4}-\d{2}-\d{2}\s[\d:.]+\s\|\s*/, '');
}

function colorFor(line: string): string {
    if (line.startsWith('>')) return 'text-cyan-400';
    if (line.includes('[WARN]')) return 'text-yellow-400';
    if (line.includes('[ERROR]') || line.startsWith('§c')) return 'text-red-400';
    if (line.includes('joined the game') || line.includes('logged in')) return 'text-green-400';
    if (line.includes('left the game') || line.includes('lost connection')) return 'text-yellow-300';
    if (line.includes('Done (')) return 'text-green-400';
    if (line.includes('Starting minecraft server')) return 'text-blue-400';
    if (line.includes('Stopping') || line.includes('Saving')) return 'text-orange-400';
    // Command responses (no bracket prefix, not a user command)
    if (!line.startsWith('[') && !line.startsWith('>') && line.length > 0) return 'text-purple-400';
    return 'text-gray-300';
}

export default function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [server, setServer] = useState<Server | null>(null);

    // Two separate arrays: Docker logs (replaced each poll) + local lines (persist)
    const [dockerLogs, setDockerLogs] = useState<string[]>([]);
    const [localLines, setLocalLines] = useState<string[]>([]);
    const [cleared, setCleared] = useState(false);

    const [command, setCommand] = useState('');
    const [isSending, setIsSending] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);
    const autoScroll = useRef(true);

    // Combined display: docker logs + local lines
    const displayLines = cleared ? localLines : [...dockerLogs, ...localLines];

    // ── Server info polling ──
    useEffect(() => {
        const load = async () => {
            try { setServer(await serversApi.get(id)); } catch { /* */ }
        };
        load();
        const i = setInterval(load, 5000);
        return () => clearInterval(i);
    }, [id]);

    // ── Log polling: always get the full snapshot, replace docker logs ──
    const fetchLogs = useCallback(async () => {
        try {
            const raw: string[] = await serversApi.getLogs(id);
            if (!raw || raw.length === 0) {
                if (!cleared) setDockerLogs([]);
                return;
            }

            // Filter + clean
            const filtered = raw
                .filter(line => !isNoisy(line))
                .map(clean)
                .filter(l => l.trim().length > 0);

            // If cleared, only show NEW lines that weren't in the pre-clear snapshot
            // We detect "new content" by checking if Docker log count changed significantly
            setDockerLogs(prev => {
                if (cleared) {
                    // Only show if there are new lines beyond what was cleared
                    if (filtered.length > prev.length + localLines.length) {
                        // New content after clear — show only the delta
                        setCleared(false);
                        return filtered;
                    }
                    return prev; // Keep empty during cleared state
                }
                return filtered;
            });
        } catch {
            // Server might not be running
        }
    }, [id, cleared, localLines.length]);

    useEffect(() => {
        fetchLogs();
        const i = setInterval(fetchLogs, 3000);
        return () => clearInterval(i);
    }, [fetchLogs]);

    // ── Auto-scroll ──
    useEffect(() => {
        if (autoScroll.current && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [displayLines.length]);

    const handleScroll = () => {
        if (!terminalRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        autoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    // ── Clear console ──
    const clearConsole = () => {
        setDockerLogs([]);
        setLocalLines([]);
        setCleared(true);
    };

    // ── Send command ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim() || isSending) return;

        const cmd = command;
        setCommand('');
        setIsSending(true);
        autoScroll.current = true;

        // Add command to local lines (persists across polls)
        setLocalLines(prev => [...prev, `> ${cmd}`]);

        try {
            const result = await serversApi.sendCommand(id, cmd);
            if (result.output?.trim()) {
                const cleaned = result.output.trim().replace(/[\x00-\x08]/g, '');
                setLocalLines(prev => [...prev, cleaned]);
            }
        } catch {
            setLocalLines(prev => [...prev, '§c Failed to send command']);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-4 animate-fade-in h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/servers/${id}`}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Console</h1>
                        <p className="text-sm text-muted-foreground">{server?.name || 'Loading...'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={clearConsole}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        title="Clear Console"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                        Clear
                    </button>
                    <div className="flex items-center gap-2">
                        <span className={`status-dot ${server?.status === 'running' ? 'status-running' : 'status-stopped'}`} />
                        <span className="text-sm text-muted-foreground">
                            {server?.status === 'running' ? 'Connected' : server?.status || 'Connecting...'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Terminal */}
            <div className="flex flex-col h-[calc(100%-4rem)] glass-card rounded-xl overflow-hidden">
                <div
                    ref={terminalRef}
                    onScroll={handleScroll}
                    className="flex-1 p-4 overflow-y-auto font-mono text-sm bg-black/50"
                >
                    {displayLines.length === 0 ? (
                        <div className="text-muted-foreground">
                            {server?.status === 'running'
                                ? 'Loading console output...'
                                : 'Server is not running. Start it to see console output.'}
                        </div>
                    ) : (
                        displayLines.map((line, i) => (
                            <div key={i} className={`leading-relaxed whitespace-pre-wrap break-all ${colorFor(line)}`}>
                                {line}
                            </div>
                        ))
                    )}
                </div>

                {/* Command input */}
                <form onSubmit={handleSubmit} className="border-t border-border/50">
                    <div className="flex items-center gap-3 p-3 bg-muted/30">
                        <span className="text-primary-400 font-mono text-sm">&gt;</span>
                        <input
                            type="text"
                            value={command}
                            onChange={e => setCommand(e.target.value)}
                            placeholder={server?.status === 'running' ? 'Enter command...' : 'Server is not running'}
                            disabled={server?.status !== 'running' || isSending}
                            className="flex-1 bg-transparent text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={server?.status !== 'running' || isSending}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors disabled:opacity-50"
                        >
                            {isSending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

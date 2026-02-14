'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, use, useCallback } from 'react';
import { serversApi, Server } from '@/lib/api';

// Filter out noisy Docker/Java/init logs that customers don't care about
const NOISE_PATTERNS = [
    /^\[init\]/,                          // Docker init messages
    /^Unpacking /,                        // Library extraction
    /^WARNING: A restricted method/,      // Java access warnings
    /^WARNING: java\.lang/,               // Java system warnings
    /^WARNING: sun\.misc/,                // Unsafe deprecation warnings
    /^WARNING: Use --enable-native/,      // JVM flags advice
    /^WARNING: Restricted methods/,       // Future release warnings
    /^WARNING: Please consider/,          // Maintainer notices
    /^WARNING: A terminally deprecated/,  // Deprecation warnings
    /\[mc-image-helper\]/,                // MC image helper noise
    /^Starting net\.minecraft\.server/,   // Raw startup line (covered by [Server thread])
];

function isNoisyLog(line: string): boolean {
    // Strip timestamp prefix if present (e.g., "2026-02-10T13:49:39.670Z ")
    const stripped = line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, '');
    // Also strip Docker Desktop style timestamps
    const stripped2 = stripped.replace(/^\d{4}-\d{2}-\d{2}\s[\d:.]+\s\|\s*/, '');

    for (const pattern of NOISE_PATTERNS) {
        if (pattern.test(stripped) || pattern.test(stripped2)) {
            return true;
        }
    }
    // Filter empty/whitespace-only lines
    if (stripped.trim().length === 0) return true;
    return false;
}

// Clean Docker multiplexed output header bytes
function cleanLog(line: string): string {
    return line.replace(/[\x00-\x08]/g, '');
}

export default function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [server, setServer] = useState<Server | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [command, setCommand] = useState('');
    const [isSending, setIsSending] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);
    const lastDockerLineCount = useRef(0);
    const prevServerStatus = useRef<string | null>(null);
    const shouldAutoScroll = useRef(true);

    // Fetch server info  
    useEffect(() => {
        async function fetchServer() {
            try {
                const data = await serversApi.get(id);
                setServer(data);
            } catch (err) {
                console.error('Failed to fetch server:', err);
            }
        }
        fetchServer();
        const interval = setInterval(fetchServer, 5000);
        return () => clearInterval(interval);
    }, [id]);

    // Detect server restart → clear console
    useEffect(() => {
        if (server?.status && prevServerStatus.current !== null) {
            // If server just started (was not running before), clear the console
            if (server.status === 'running' && prevServerStatus.current !== 'running') {
                setLogs([]);
                lastDockerLineCount.current = 0;
            }
        }
        prevServerStatus.current = server?.status || null;
    }, [server?.status]);

    // Poll for logs - APPEND new lines instead of replacing (preserves local command/rcon lines)
    const fetchLogs = useCallback(async () => {
        try {
            const dockerLines = await serversApi.getLogs(id);
            if (!dockerLines || dockerLines.length === 0) return;

            if (dockerLines.length < lastDockerLineCount.current) {
                // Docker log count went DOWN = server restarted, clear and start fresh
                setLogs([]);
                lastDockerLineCount.current = 0;
            }

            if (dockerLines.length > lastDockerLineCount.current) {
                // Only grab truly new Docker log lines
                const newLines = dockerLines.slice(lastDockerLineCount.current);
                lastDockerLineCount.current = dockerLines.length;

                // Filter out noisy lines
                const filtered = newLines
                    .map(cleanLog)
                    .filter(line => !isNoisyLog(line));

                if (filtered.length > 0) {
                    setLogs(prev => [...prev, ...filtered]);
                }
            }
        } catch {
            // Silently fail - server might not be running
        }
    }, [id]);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000);
        return () => clearInterval(interval);
    }, [fetchLogs]);

    // Auto scroll to bottom when new logs arrive (only if user hasn't scrolled up)
    useEffect(() => {
        if (shouldAutoScroll.current && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    // Track if user has scrolled up
    const handleScroll = () => {
        if (!terminalRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    // Clear console
    const clearConsole = () => {
        setLogs([]);
        lastDockerLineCount.current = 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim() || isSending) return;

        const cmd = command;
        setCommand('');
        setIsSending(true);
        shouldAutoScroll.current = true;

        // Add the command to logs
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [...prev, `> ${cmd}`]);

        try {
            const result = await serversApi.sendCommand(id, cmd);
            // Show the rcon response if available
            if (result.output && result.output.trim()) {
                const cleaned = result.output.trim().replace(/[\x00-\x08]/g, '');
                setLogs(prev => [...prev, cleaned]);
            }
        } catch (err) {
            setLogs(prev => [...prev, `§c Error: Failed to send command`]);
        } finally {
            setIsSending(false);
        }
    };

    // Color logic for log lines
    const getLogColor = (line: string): string => {
        if (line.startsWith('>')) return 'text-cyan-400';          // User commands
        if (line.includes('[WARN]') || line.includes('WARN')) return 'text-yellow-400';
        if (line.includes('[ERROR]') || line.includes('§c')) return 'text-red-400';
        if (line.includes('joined the game') || line.includes('logged in')) return 'text-green-400';
        if (line.includes('left the game') || line.includes('lost connection')) return 'text-yellow-300';
        if (line.includes('Done (')) return 'text-green-400';
        if (line.includes('RCON')) return 'text-gray-500';         // RCON internal messages are dim
        if (line.includes('Starting minecraft server')) return 'text-blue-400';
        // Rcon command responses (lines that appear right after ">")
        if (!line.match(/^\[?\d/) && !line.startsWith('>') && !line.includes('[')) return 'text-purple-400';
        return 'text-gray-300';
    };

    // Format log line for display - strip verbose timestamps, keep just the useful info
    const formatLog = (line: string): string => {
        // Strip ISO timestamps: "2026-02-10T13:54:45.245Z "
        let formatted = line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, '');
        // Strip Docker Desktop timestamps: "2026-02-10 19:24:45.245 | "
        formatted = formatted.replace(/^\d{4}-\d{2}-\d{2}\s[\d:.]+\s\|\s*/, '');
        return formatted;
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
                    {/* Clear Console Button */}
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
                {/* Terminal output */}
                <div
                    ref={terminalRef}
                    onScroll={handleScroll}
                    className="flex-1 p-4 overflow-y-auto font-mono text-sm bg-black/50"
                >
                    {logs.length === 0 ? (
                        <div className="text-muted-foreground">
                            {server?.status === 'running'
                                ? 'Loading console output...'
                                : 'Server is not running. Start it to see console output.'}
                        </div>
                    ) : (
                        logs.map((log, i) => {
                            const formatted = formatLog(log);
                            return (
                                <div
                                    key={i}
                                    className={`leading-relaxed whitespace-pre-wrap break-all ${getLogColor(formatted)}`}
                                >
                                    {formatted}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Command input */}
                <form onSubmit={handleSubmit} className="border-t border-border/50">
                    <div className="flex items-center gap-3 p-3 bg-muted/30">
                        <span className="text-primary-400 font-mono text-sm">&gt;</span>
                        <input
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
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

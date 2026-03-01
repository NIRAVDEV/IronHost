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
    if (line.startsWith('Error:')) return 'text-red-400';
    // Command responses (no bracket prefix, not a user command)
    if (!line.startsWith('[') && !line.startsWith('>') && line.length > 0) return 'text-purple-400';
    return 'text-gray-300';
}

/** Build a WebSocket URL from the API base URL */
function getWebSocketUrl(serverId: string): string {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    // Convert http(s) → ws(s)
    const wsBase = apiBase.replace(/^http/, 'ws');
    return `${wsBase}/servers/${serverId}/console`;
}

type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export default function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [server, setServer] = useState<Server | null>(null);
    const [lines, setLines] = useState<string[]>([]);
    const [command, setCommand] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
    const [serverStatus, setServerStatus] = useState<string>('');

    const terminalRef = useRef<HTMLDivElement>(null);
    const autoScroll = useRef(true);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch server info once for header ──
    useEffect(() => {
        const load = async () => {
            try {
                const s = await serversApi.get(id);
                setServer(s);
                setServerStatus(s.status);
            } catch { /* */ }
        };
        load();
    }, [id]);

    // ── WebSocket connection ──
    const connectWs = useCallback(async () => {
        // Clean up any previous connection
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setWsStatus('connecting');

        // Get auth token for the WebSocket connection
        let token = '';
        try {
            const { createClient } = await import('@/lib/supabase');
            const supabase = createClient();
            const { data } = await supabase.auth.getSession();
            token = data.session?.access_token || '';
        } catch { /* */ }

        const url = getWebSocketUrl(id) + (token ? `?token=${encodeURIComponent(token)}` : '');
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setWsStatus('connected');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                switch (msg.type) {
                    case 'log': {
                        // Real-time log line from the Agent's Docker stream
                        const rawLine = msg.line || '';
                        // The Agent may send multi-line chunks
                        const subLines = rawLine.split('\n');
                        const cleaned = subLines
                            .filter((l: string) => !isNoisy(l))
                            .map(clean)
                            .filter((l: string) => l.trim().length > 0);
                        if (cleaned.length > 0) {
                            setLines(prev => [...prev, ...cleaned]);
                        }
                        break;
                    }
                    case 'status':
                        setServerStatus(msg.status);
                        break;
                    case 'command_result': {
                        // Output from a command we sent
                        const output = (msg.output || '').trim().replace(/[\x00-\x08]/g, '');
                        if (output) {
                            setLines(prev => [...prev, output]);
                        }
                        setIsSending(false);
                        break;
                    }
                    case 'error':
                        setLines(prev => [...prev, `§c ${msg.message}`]);
                        break;
                }
            } catch {
                // Non-JSON message, just append it
                setLines(prev => [...prev, event.data]);
            }
        };

        ws.onerror = () => {
            setWsStatus('error');
        };

        ws.onclose = () => {
            setWsStatus('disconnected');
            wsRef.current = null;
            // Auto-reconnect after 3 seconds
            reconnectTimer.current = setTimeout(() => {
                connectWs();
            }, 3000);
        };
    }, [id]);

    useEffect(() => {
        connectWs();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connectWs]);

    // ── Auto-scroll ──
    useEffect(() => {
        if (autoScroll.current && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [lines.length]);

    const handleScroll = () => {
        if (!terminalRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        autoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    // ── Clear console ──
    const clearConsole = () => {
        setLines([]);
    };

    // ── Send command via WebSocket ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim() || isSending) return;

        const cmd = command;
        setCommand('');
        setIsSending(true);
        autoScroll.current = true;

        // Show the command locally immediately
        setLines(prev => [...prev, `> ${cmd}`]);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
        } else {
            // Fallback: use REST API if WebSocket isn't connected
            try {
                const result = await serversApi.sendCommand(id, cmd);
                if (result.output?.trim()) {
                    const cleaned = result.output.trim().replace(/[\x00-\x08]/g, '');
                    setLines(prev => [...prev, cleaned]);
                }
            } catch {
                setLines(prev => [...prev, '§c Failed to send command']);
            }
            setIsSending(false);
        }
    };

    const statusIndicator = wsStatus === 'connected'
        ? 'status-running'
        : wsStatus === 'connecting'
            ? 'status-starting'
            : 'status-stopped';

    const statusLabel = wsStatus === 'connected'
        ? (serverStatus === 'running' ? 'Live' : serverStatus || 'Connected')
        : wsStatus === 'connecting'
            ? 'Connecting...'
            : 'Disconnected';

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
                        <span className={`status-dot ${statusIndicator}`} />
                        <span className="text-sm text-muted-foreground">
                            {statusLabel}
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
                    {lines.length === 0 ? (
                        <div className="text-muted-foreground">
                            {wsStatus === 'connected'
                                ? (serverStatus === 'running'
                                    ? 'Waiting for console output...'
                                    : 'Server is not running. Start it to see console output.')
                                : 'Connecting to server...'}
                        </div>
                    ) : (
                        lines.map((line, i) => (
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
                            placeholder={serverStatus === 'running' ? 'Enter command...' : 'Server is not running'}
                            disabled={serverStatus !== 'running' || isSending}
                            className="flex-1 bg-transparent text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={serverStatus !== 'running' || isSending}
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

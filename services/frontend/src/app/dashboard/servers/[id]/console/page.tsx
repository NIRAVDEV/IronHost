'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, use } from 'react';
import { serversApi, Server } from '@/lib/api';

export default function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [server, setServer] = useState<Server | null>(null);
    const [logs, setLogs] = useState<string[]>([
        'Connecting to server console...',
    ]);
    const [command, setCommand] = useState('');
    const [isSending, setIsSending] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);

    // Fetch server info
    useEffect(() => {
        async function fetchServer() {
            try {
                const data = await serversApi.get(id);
                setServer(data);
                setLogs(prev => [...prev, `Connected to ${data.name} (${data.status})`]);
            } catch (err) {
                console.error('Failed to fetch server:', err);
                setLogs(prev => [...prev, '[ERROR] Failed to connect to server']);
            }
        }
        fetchServer();
    }, [id]);

    // Auto scroll to bottom
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim() || isSending) return;

        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [...prev, `[${time}] [CONSOLE] > ${command}`]);

        const cmd = command;
        setCommand('');
        setIsSending(true);

        try {
            await serversApi.sendCommand(id, cmd);
            const time2 = new Date().toLocaleTimeString('en-US', { hour12: false });
            setLogs(prev => [...prev, `[${time2}] Command sent successfully`]);
        } catch (err) {
            const time2 = new Date().toLocaleTimeString('en-US', { hour12: false });
            setLogs(prev => [...prev, `[${time2}] [ERROR] Failed to send command: ${err}`]);
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
                <div className="flex items-center gap-2">
                    <span className={`status-dot ${server?.status === 'running' ? 'status-running' : 'status-stopped'}`} />
                    <span className="text-sm text-muted-foreground">
                        {server?.status === 'running' ? 'Connected' : server?.status || 'Connecting...'}
                    </span>
                </div>
            </div>

            {/* Terminal */}
            <div className="flex flex-col h-[calc(100%-4rem)] glass-card rounded-xl overflow-hidden">
                {/* Terminal output */}
                <div
                    ref={terminalRef}
                    className="flex-1 p-4 overflow-y-auto font-mono text-sm bg-black/50"
                >
                    {logs.map((log, i) => (
                        <div
                            key={i}
                            className={`leading-relaxed ${log.includes('[WARN]') ? 'text-yellow-400' :
                                log.includes('[ERROR]') ? 'text-red-400' :
                                    log.includes('Connected') ? 'text-green-400' :
                                        log.includes('[CONSOLE]') ? 'text-cyan-400' :
                                            log.includes('Command sent') ? 'text-green-400' :
                                                'text-gray-300'
                                }`}
                        >
                            {log}
                        </div>
                    ))}
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

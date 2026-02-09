'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, use } from 'react';

export default function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    const [logs, setLogs] = useState<string[]>([
        '[12:34:56] [Server thread/INFO]: Starting minecraft server version 1.20.4',
        '[12:34:57] [Server thread/INFO]: Loading properties',
        '[12:34:57] [Server thread/INFO]: Default game type: SURVIVAL',
        '[12:34:58] [Server thread/INFO]: Generating keypair',
        '[12:34:59] [Server thread/INFO]: Starting Minecraft server on *:25565',
        '[12:35:00] [Server thread/INFO]: Preparing level "world"',
        '[12:35:05] [Server thread/INFO]: Preparing spawn area: 0%',
        '[12:35:10] [Server thread/INFO]: Preparing spawn area: 50%',
        '[12:35:15] [Server thread/INFO]: Preparing spawn area: 100%',
        '[12:35:16] [Server thread/INFO]: Done (20.123s)! For help, type "help"',
        '[12:36:22] [Server thread/INFO]: Player123 joined the game',
        '[12:37:45] [Server thread/INFO]: <Player123> Hello everyone!',
        '[12:38:01] [Server thread/INFO]: GamerPro logged in with entity id 42',
        '[12:39:12] [Server thread/INFO]: <GamerPro> Hey! Nice server!',
    ]);
    const [command, setCommand] = useState('');
    const terminalRef = useRef<HTMLDivElement>(null);

    // Auto scroll to bottom
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    // Simulate new logs coming in
    useEffect(() => {
        const interval = setInterval(() => {
            const randomLogs = [
                '[Server thread/INFO]: Saving chunks for level \'world\'',
                '[Server thread/INFO]: Saved the game',
                '[Server thread/INFO]: Player moved to spawn',
            ];
            const randomLog = randomLogs[Math.floor(Math.random() * randomLogs.length)];
            const time = new Date().toLocaleTimeString('en-US', { hour12: false });
            setLogs(prev => [...prev, `[${time}] ${randomLog}`]);
        }, 8000);

        return () => clearInterval(interval);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim()) return;

        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [...prev, `[${time}] [CONSOLE] > ${command}`]);
        setCommand('');
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
                        <p className="text-sm text-muted-foreground">Survival SMP</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="status-dot status-running" />
                    <span className="text-sm text-muted-foreground">Connected</span>
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
                                        log.includes('joined the game') || log.includes('logged in') ? 'text-green-400' :
                                            log.includes('[CONSOLE]') ? 'text-cyan-400' :
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
                            placeholder="Enter command..."
                            className="flex-1 bg-transparent text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors"
                        >
                            Send
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

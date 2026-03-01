'use client';

import Link from 'next/link';
import { useState, useEffect, use, useCallback } from 'react';
import { serversApi, filesApi, FileEntry, Server } from '@/lib/api';

// ── Icons ──
const FolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);

const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleString();
}

export default function FilesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [server, setServer] = useState<Server | null>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Editor state
    const [editing, setEditing] = useState<{ path: string; name: string; content: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [editorDirty, setEditorDirty] = useState(false);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Load server info
    useEffect(() => {
        serversApi.get(id).then(setServer).catch(() => { });
    }, [id]);

    // Load files
    const loadFiles = useCallback(async (path: string = '') => {
        setLoading(true);
        setError('');
        try {
            const result = await filesApi.list(id, path);
            setFiles(result.files || []);
            setCurrentPath(result.current_path || path);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load files';
            setError(msg);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadFiles('');
    }, [loadFiles]);

    // Navigate into directory
    const navigateTo = (path: string) => {
        setEditing(null);
        loadFiles(path);
    };

    // Go up one level
    const goUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        navigateTo(parts.join('/'));
    };

    // Open file for editing
    const openFile = async (file: FileEntry) => {
        if (file.is_directory) {
            navigateTo(file.path);
            return;
        }
        // Only open text-editable files (< 1MB)
        if (file.size > 1024 * 1024) {
            setError('File too large to edit (max 1MB)');
            return;
        }
        try {
            setLoading(true);
            const result = await filesApi.read(id, file.path);
            setEditing({ path: file.path, name: result.file_name, content: result.content });
            setEditorDirty(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to read file';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Save file
    const saveFile = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            await filesApi.write(id, editing.path, editing.content);
            setEditorDirty(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to save file';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    // Delete file
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await filesApi.delete(id, deleteTarget);
            setDeleteTarget(null);
            loadFiles(currentPath);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete';
            setError(msg);
        } finally {
            setDeleting(false);
        }
    };

    // Breadcrumbs
    const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

    // Sort: directories first, then alphabetically
    const sortedFiles = [...files].sort((a, b) => {
        if (a.is_directory !== b.is_directory) return a.is_directory ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

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
                        <h1 className="text-xl font-bold text-foreground">File Manager</h1>
                        <p className="text-sm text-muted-foreground">{server?.name || 'Loading...'}</p>
                    </div>
                </div>
                <button
                    onClick={() => loadFiles(currentPath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 21h5v-5" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Error banner */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* Main content */}
            <div className="flex flex-col h-[calc(100%-6rem)] glass-card rounded-xl overflow-hidden">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border/30 text-sm bg-muted/20">
                    <button
                        onClick={() => navigateTo('')}
                        className="text-primary-400 hover:text-primary-300 font-medium"
                    >
                        /
                    </button>
                    {pathParts.map((part, i) => (
                        <span key={i} className="flex items-center gap-1">
                            <span className="text-muted-foreground">/</span>
                            <button
                                onClick={() => navigateTo(pathParts.slice(0, i + 1).join('/'))}
                                className={i === pathParts.length - 1
                                    ? 'text-foreground font-medium'
                                    : 'text-primary-400 hover:text-primary-300'}
                            >
                                {part}
                            </button>
                        </span>
                    ))}
                </div>

                {editing ? (
                    /* ── File Editor ── */
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/10">
                            <div className="flex items-center gap-2">
                                <FileIcon />
                                <span className="text-sm font-medium text-foreground">{editing.name}</span>
                                {editorDirty && <span className="text-xs text-yellow-400">(unsaved)</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={saveFile}
                                    disabled={saving || !editorDirty}
                                    className="px-3 py-1 text-sm font-medium rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={() => setEditing(null)}
                                    className="px-3 py-1 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="flex-1 w-full p-4 bg-black/30 text-foreground font-mono text-sm resize-none focus:outline-none"
                            value={editing.content}
                            onChange={e => {
                                setEditing({ ...editing, content: e.target.value });
                                setEditorDirty(true);
                            }}
                            spellCheck={false}
                        />
                    </div>
                ) : (
                    /* ── File List ── */
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-32 text-muted-foreground">
                                <div className="h-6 w-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mr-3" />
                                Loading files...
                            </div>
                        ) : sortedFiles.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-muted-foreground">
                                No files found in this directory
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border/30">
                                        <th className="text-left py-2 px-4">Name</th>
                                        <th className="text-right py-2 px-4 w-24">Size</th>
                                        <th className="text-right py-2 px-4 w-44">Modified</th>
                                        <th className="text-right py-2 px-4 w-20">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Go up row */}
                                    {currentPath && (
                                        <tr
                                            className="hover:bg-muted/30 cursor-pointer transition-colors border-b border-border/10"
                                            onClick={goUp}
                                        >
                                            <td className="py-2.5 px-4 flex items-center gap-2 text-sm text-muted-foreground">
                                                <FolderIcon />
                                                ..
                                            </td>
                                            <td />
                                            <td />
                                            <td />
                                        </tr>
                                    )}
                                    {sortedFiles.map((file) => (
                                        <tr
                                            key={file.path}
                                            className="hover:bg-muted/30 cursor-pointer transition-colors border-b border-border/10 group"
                                            onClick={() => openFile(file)}
                                        >
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    {file.is_directory ? <FolderIcon /> : <FileIcon />}
                                                    <span className="text-foreground">{file.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-sm text-muted-foreground">
                                                {file.is_directory ? '—' : formatSize(file.size)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-sm text-muted-foreground">
                                                {formatDate(file.modified_at)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteTarget(file.path);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                                                    title="Delete"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-card rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
                        <h3 className="text-lg font-bold text-foreground">Delete File</h3>
                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete <span className="font-mono text-foreground">{deleteTarget.split('/').pop()}</span>? This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

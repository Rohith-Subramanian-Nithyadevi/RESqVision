import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, AlertTriangle, Clock, Camera, ShieldAlert, TrendingUp, Loader2, Inbox } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// --- NEW: Color mapping for severity/status badges ---
const severityColors = {
    HIGH: "bg-red-500/20 text-red-400 border-red-500/30",
    MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    LOW: "bg-green-500/20 text-green-400 border-green-500/30",
};

const statusColors = {
    UNRESOLVED: "bg-red-500/20 text-red-400",
    RESOLVED: "bg-green-500/20 text-green-400",
};

const escalationColors = {
    Owner: "text-blue-400",
    Committee: "text-yellow-400",
    Authorities: "text-red-400",
};

export default function HistoryPage({ onBack }) {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        // 1. Fetch immediately when the page opens (shows loading spinner)
        fetchHistory(true);

        // 2. Poll the database every 3 seconds for new alerts (hidden background fetch)
        const interval = setInterval(() => {
            fetchHistory(false); 
        }, 3000);

        // 3. Cleanup the interval if you click away to the main dashboard
        return () => clearInterval(interval);
    }, []);

    const fetchHistory = async (isInitialLoad = true) => {
        try {
            // Only show the loading state on the very first load to prevent screen flicker
            if (isInitialLoad) setLoading(true); 
            setError(null);
            
            const res = await fetch(`${API_BASE}/api/history`);
            
            if (!res.ok) throw new Error("Failed to fetch history");
            
            const data = await res.json();
            setIncidents(data);
        } catch (err) {
            if (err.message === "Failed to fetch") {
                setError("Backend is unreachable. Check if the server is running.");
            } else {
                setError(err.message);
            }
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    };

    const handleDelete = async (eventId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this SOS incident? This action cannot be undone."
        );
        if (!confirmed) return;

        try {
            setDeletingId(eventId);
            const res = await fetch(`${API_BASE}/api/history/${eventId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete incident");
            setIncidents((prev) => prev.filter((inc) => inc.event_id !== eventId));
        } catch (err) {
            alert("Error deleting incident: " + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const formatTimestamp = (ts) => {
        if (!ts) return "N/A";
        try {
            return new Date(ts).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
                hour12: true,
            });
        } catch {
            return ts;
        }
    };

    return (
        <div className="h-screen bg-[#0B1120] text-slate-200 flex flex-col font-sans">
            {/* --- Header --- */}
            <nav className="px-6 py-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-[#1E293B] hover:bg-[#334155] px-3 py-2 rounded-lg transition-all duration-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                    <div className="w-px h-6 bg-slate-700" />
                    <h1 className="text-xl font-bold tracking-wider text-white">SOS HISTORY</h1>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400 font-mono">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    <span>{incidents.length} Record{incidents.length !== 1 ? "s" : ""}</span>
                </div>
            </nav>

            {/* --- Content --- */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                        <Loader2 className="w-10 h-10 animate-spin" />
                        <p className="text-sm">Loading incident history...</p>
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <AlertTriangle className="w-10 h-10 text-red-400" />
                        <p className="text-red-400">{error}</p>
                        <button
                            onClick={fetchHistory}
                            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && incidents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                        <Inbox className="w-12 h-12" />
                        <p className="text-lg font-semibold">No SOS Incidents Found</p>
                        <p className="text-sm">There are no recorded incidents in the system.</p>
                    </div>
                )}

                {/* Incident Cards Grid */}
                {!loading && !error && incidents.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
                        {incidents.map((inc) => (
                            <div
                                key={inc.event_id}
                                className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all duration-200 group"
                            >
                                {/* Card Header */}
                                <div className="p-4 border-b border-slate-800/50 bg-[#0F172A] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                        <span className="font-bold text-white text-sm">{inc.class_name}</span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${severityColors[inc.severity] || severityColors.HIGH}`}>
                                        {inc.severity}
                                    </span>
                                </div>

                                {/* Card Body */}
                                <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Camera className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                            <span>{inc.camera_id || "Unknown"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <TrendingUp className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                            <span>Confidence: {inc.confidence ? `${(inc.confidence * 100).toFixed(1)}%` : "N/A"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                            <span>{formatTimestamp(inc.timestamp || inc.created_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <ShieldAlert className={`w-3.5 h-3.5 shrink-0 ${escalationColors[inc.escalation_level] || "text-slate-400"}`} />
                                            <span>{inc.escalation_level || "N/A"}</span>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${statusColors[inc.status] || "bg-slate-700 text-slate-300"}`}>
                                            {inc.status}
                                        </span>
                                        <span className="text-[10px] text-slate-600 font-mono">
                                            {inc.event_id}
                                        </span>
                                    </div>
                                </div>

                                {/* Card Footer — Delete Button */}
                                <div className="px-4 pb-4">
                                    <button
                                        onClick={() => handleDelete(inc.event_id)}
                                        disabled={deletingId === inc.event_id}
                                        className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-lg bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {deletingId === inc.event_id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                        {deletingId === inc.event_id ? "Deleting..." : "Delete Record"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

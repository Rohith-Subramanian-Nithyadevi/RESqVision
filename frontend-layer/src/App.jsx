import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, AlertCircle, CheckCircle, X, MapPin, Clock,
  Calendar, ShieldCheck, History, Settings, Wifi, Search, Plus, Trash2, LogOut
} from 'lucide-react';
import HistoryPage from './HistoryPage';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import ConfigurationPage from './ConfigurationPage';

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemStatus, setSystemStatus] = useState("Connecting...");
  const [currentPage, setCurrentPage] = useState(() => {
    // On load: if we have a saved user session, go to dashboard; otherwise landing
    return localStorage.getItem('resq_user_id') ? "dashboard" : "landing";
  });
  const [userId, setUserId] = useState(() => localStorage.getItem('resq_user_id'));
  const wsRef = useRef(null);

  const [discoveredCams, setDiscoveredCams] = useState([]);
  const [activeCams, setActiveCams] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  // ── Auth Handlers ────────────────────────────────────────
  const handleLoginSuccess = (id) => {
    localStorage.setItem('resq_user_id', id);
    setUserId(id);
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    // Clear auth state completely
    localStorage.removeItem('resq_user_id');
    setUserId(null);
    setAlerts([]);
    setActiveCams([]);
    setDiscoveredCams([]);
    setSystemStatus("Connecting...");
    // Close the WebSocket so it doesn't try to reconnect with old user
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setCurrentPage("landing");
  };

  // ── Guard: Prevent unauthorized access to dashboard ──────
  useEffect(() => {
    if (!userId && currentPage !== "landing" && currentPage !== "login") {
      setCurrentPage("landing");
    }
  }, [userId, currentPage]);

  // ── Emergency Sound ──────────────────────────────────────
  const triggerEmergencyBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playNote = (frequency, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playNote(900, now, 0.2);
      playNote(900, now + 0.3, 0.2);
    } catch (err) {
      console.log("Audio blocked: User must interact with the page first.", err);
    }
  };

  // ── Clock Timer ──────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── WebSocket Connection ─────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/frontend";
    const ws = new WebSocket(`${wsUrl}?user_id=${userId}`);
    wsRef.current = ws;

    ws.onopen = () => setSystemStatus("Monitoring Active");
    ws.onclose = () => setSystemStatus("Disconnected");

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.alerts?.emergency_detected) {
          payload.detections.forEach(det => {
            const className = det.class_name;
            if (!["Fire", "Fall-person", "Accident", "Violence", "Unconsciousness", "Voice-SOS"].includes(className)) {
              return;
            }

            const cameraIp = det.camera_ip || payload.camera_ip || "Unknown Cam";

            const eventId = payload.event_id_prefix
              ? `${payload.event_id_prefix}_${className}`
              : `evt_${cameraIp.replace(/\./g, "_")}_${payload.frame_id || Date.now()}_${payload.unix_time || Math.floor(Date.now() / 1000)}_${className}`;

            setAlerts(prev => {
              if (prev.some(a => a.class_name === className && a.camera_ip === cameraIp)) {
                return prev;
              }
              triggerEmergencyBeep();
              return [{
                id: eventId,
                class_name: className,
                severity: "HIGH",
                camera_ip: cameraIp,
                location: `IP: ${cameraIp}`,
                time: new Date(payload.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: true }),
                desc: `${className} emergency triggered.`
              }, ...prev];
            });
          });
        }
      } catch (err) {
        console.error("Failed to parse WebSocket JSON:", err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [userId]);

  // ── Camera Handlers ──────────────────────────────────────
  const handleResolve = (eventId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "resolve", event_id: eventId }));
    }
    setAlerts(prev => prev.filter(alert => alert.id !== eventId));
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const aiUrl = import.meta.env.VITE_AI_URL || "http://localhost:5000";
      const res = await fetch(`${aiUrl}/scan`);
      const data = await res.json();
      setDiscoveredCams(data.cameras || []);
    } catch (e) {
      console.error("Scan failed. Is the AI backend running?", e);
    }
    setIsScanning(false);
  };

  const connectCamera = async (ip) => {
    if (activeCams.includes(ip)) return;
    const suffix = ip.split('.').pop();
    const aiUrl = import.meta.env.VITE_AI_URL || "http://localhost:5000";
    try {
      await fetch(`${aiUrl}/connect/${suffix}?user_id=${userId}`, { method: "POST" });
      setActiveCams([...activeCams, ip]);
      setDiscoveredCams(prev => prev.filter(cam => cam !== ip));
    } catch (e) {
      console.error("Failed to connect to camera", e);
    }
  };

  const disconnectCamera = async (ip) => {
    const suffix = ip.split('.').pop();
    const aiUrl = import.meta.env.VITE_AI_URL || "http://localhost:5000";
    try {
      await fetch(`${aiUrl}/disconnect/${suffix}`, { method: "POST" });
      setActiveCams(prev => prev.filter(cam => cam !== ip));
      setDiscoveredCams(prev => [...prev, ip]);
    } catch (e) {
      console.error("Failed to disconnect", e);
    }
  };

  const formatDate = (date) => `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour12: true });

  // ── Page Routing ─────────────────────────────────────────
  if (currentPage === "landing") {
    return <LandingPage onLoginClick={() => setCurrentPage("login")} />;
  }

  if (currentPage === "login") {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onBack={() => setCurrentPage("landing")}
      />
    );
  }

  if (currentPage === "history") {
    return <HistoryPage userId={userId} onBack={() => setCurrentPage("dashboard")} />;
  }

  if (currentPage === "configure") {
    return <ConfigurationPage userId={userId} onBack={() => setCurrentPage("dashboard")} />;
  }

  // ── Dashboard ────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#0B1120] text-slate-200 flex flex-col font-sans">
      <nav className="px-6 py-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wider text-white">CCTV-SOS-AUTOMATION</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono mr-2">
            {userId}
          </span>
          <button
            onClick={() => setCurrentPage("configure")}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E293B] hover:bg-[#334155] px-3 py-2 rounded-lg transition-all"
          >
            <Settings className="w-4 h-4" /> Configure
          </button>
          <button
            onClick={() => setCurrentPage("history")}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E293B] hover:bg-[#334155] px-3 py-2 rounded-lg transition-all"
          >
            <History className="w-4 h-4" /> History
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 bg-[#1E293B] hover:bg-[#334155] px-3 py-2 rounded-lg transition-all ml-2"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
          <div className="flex items-center gap-2 text-sm text-green-400 font-mono ml-4">
            <ShieldCheck className="w-5 h-5" /> AI Core {systemStatus === "Monitoring Active" ? "Online" : "Offline"}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shrink-0 shadow-lg">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-blue-400" /> Local Network Cameras
              </h2>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isScanning ? <Search className="w-3 h-3 animate-ping" /> : <Search className="w-3 h-3" />}
                {isScanning ? "Scanning Network..." : "Discover Devices"}
              </button>
            </div>
            {discoveredCams.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700">
                <span className="text-xs text-slate-500 w-full mb-1">Found Devices (Port 8080):</span>
                {discoveredCams.map(ip => (
                  <button
                    key={ip}
                    onClick={() => connectCamera(ip)}
                    className="flex items-center gap-1 bg-[#1E293B] border border-green-500/50 text-green-400 text-xs px-3 py-1.5 rounded hover:bg-green-500/10 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Connect {ip}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 bg-[#111827] border border-slate-800 rounded-xl flex flex-col overflow-hidden relative">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-[#111827] z-10">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-slate-200">
                  {activeCams.length === 0 ? "NO CAMERAS CONNECTED" : `ACTIVE FEEDS (${activeCams.length})`}
                </span>
              </div>
              <div className="text-sm text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(currentTime)}, {formatTime(currentTime)}
              </div>
            </div>

            <div className="flex-1 relative bg-[#0B1120] overflow-y-auto p-4">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
                  backgroundSize: '50px 50px',
                  opacity: 0.3,
                }}
              />

              {activeCams.length === 0 ? (
                <div className="relative z-10 flex flex-col items-center opacity-50 w-full h-full justify-center">
                  <Camera className="w-16 h-16 text-slate-500 mb-4" />
                  <h2 className="text-xl font-bold text-slate-400">Waiting for Camera Connections</h2>
                  <p className="text-sm text-slate-500 mt-2">Use the scanner above to find phones on the network.</p>
                </div>
              ) : (
                <div className={`relative z-10 grid gap-4 h-full ${activeCams.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {activeCams.map(ip => (
                    <div
                      key={ip}
                      className="relative bg-black rounded-lg overflow-hidden border border-slate-700 shadow-lg group flex flex-col"
                    >
                      <div className="flex-1 relative">
                        <img
                          src={`${import.meta.env.VITE_AI_URL || "http://localhost:5000"}/video_feed/${ip.split('.').pop()}`}
                          alt={`Feed ${ip}`}
                          className="absolute inset-0 w-full h-full object-contain"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>

                      <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-mono text-green-400 px-2 py-1 bg-black/50 rounded flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          IP: {ip}
                        </span>
                        <button
                          onClick={() => disconnectCamera(ip)}
                          className="bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded transition-colors"
                          title="Disconnect Camera"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-96 bg-[#111827] border border-slate-800 rounded-xl flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0F172A]">
            <div className="flex items-center gap-2 text-red-500 font-bold">
              <AlertCircle className="w-5 h-5" />
              <span>SOS Alerts</span>
            </div>
            <div className="bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
              {alerts.length}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {alerts.length === 0 ? (
              <div className="text-center text-slate-500 mt-10">No active alerts. All clear.</div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-[#1E293B] border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm animate-in slide-in-from-right-2"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white">{alert.class_name}</h3>
                    <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      HIGH
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{alert.desc}</p>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 mb-4 font-mono">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {alert.location}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {alert.time}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-2 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Action Taken
                    </button>
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="flex-1 bg-[#334155] hover:bg-[#475569] text-white text-xs py-2 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <X className="w-3 h-3" /> Neglect
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

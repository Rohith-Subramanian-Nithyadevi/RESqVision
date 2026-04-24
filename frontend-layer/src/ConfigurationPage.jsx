import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Edit2, Phone, Mail, AlertCircle, MapPin } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ConfigurationPage({ onBack }) {
    const [savedConfigs, setSavedConfigs] = useState([]);
    const [detectionType, setDetectionType] = useState('');
    const [isEnabled, setIsEnabled] = useState(true);
    const [locationAddress, setLocationAddress] = useState(''); // NEW STATE
    const [numEscalations, setNumEscalations] = useState(1);
    const [escalations, setEscalations] = useState([
        { level: 1, type: 'sms', contact: '', delay_seconds: 0, send_location: false }
    ]);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/config`);
            const data = await res.json();
            setSavedConfigs(data);
        } catch (err) {
            console.error("Failed to fetch configs", err);
        }
    };

    const handleNumEscalationsChange = (num) => {
        setNumEscalations(num);
        const newEscalations = [];
        for (let i = 0; i < num; i++) {
            newEscalations.push(
                escalations[i] || { level: i + 1, type: 'sms', contact: '', delay_seconds: i === 0 ? 0 : 30, send_location: false }
            );
        }
        setEscalations(newEscalations);
    };

    const updateEscalation = (index, field, value) => {
        const updated = [...escalations];
        updated[index][field] = value;
        setEscalations(updated);
    };

    const validateForm = () => {
        if (!detectionType) return "Please select a detection type.";
        if (!isEnabled) return null;

        const phoneRegex = /^[0-9]{10}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        for (let i = 0; i < escalations.length; i++) {
            const esc = escalations[i];
            if (esc.type === 'sms' && !phoneRegex.test(esc.contact.replace('+91', ''))) {
                return `Level ${esc.level}: Invalid phone number. Please enter 10 digits.`;
            }
            if (esc.type === 'gmail' && !emailRegex.test(esc.contact)) {
                return `Level ${esc.level}: Invalid email format.`;
            }
            if (esc.delay_seconds < 0) {
                return `Level ${esc.level}: Delay cannot be negative.`;
            }
            // NEW: Prevent sending an empty location
            if (esc.send_location && !locationAddress.trim()) {
                return `Level ${esc.level}: You opted to send the location, but the Location Address field is empty.`;
            }
        }
        return null;
    };

    const handleSave = async () => {
        const error = validateForm();
        if (error) return alert(error);

        const formattedEscalations = escalations.map(esc => {
            let finalContact = esc.contact;
            const stripped = finalContact.replace(/^\+91/, '');
            if (esc.type === 'sms') {
                finalContact = `+91${stripped}`;
            }
            return { ...esc, contact: finalContact, delay_seconds: Number(esc.delay_seconds) };
        });

        const payload = {
            detection_type: String(detectionType).trim(),
            enabled: Boolean(isEnabled),
            location_address: String(locationAddress).trim(), // INCLUDED IN PAYLOAD
            escalations: Boolean(isEnabled) ? formattedEscalations : []
        };

        try {
            await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            fetchConfigs();
            alert(`SUCCESS: ${payload.detection_type} configuration saved.`);
        } catch (err) {
            alert("Error saving configuration to database.");
        }
    };

    const handleDelete = async (type) => {
        if (!window.confirm(`Delete configuration for ${type}?`)) return;
        try {
            await fetch(`${API_BASE}/api/config/${type}`, { method: 'DELETE' });
            fetchConfigs();
        } catch (err) {
            alert("Error deleting config");
        }
    };

    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 flex flex-col">
            <nav className="px-6 py-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
                <h1 className="text-xl font-bold tracking-wider text-white">CCTV-SOS-AUTOMATION</h1>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E293B] hover:bg-[#334155] px-3 py-2 rounded-lg transition-all"
                >
                    <Settings className="w-4 h-4" /> Back to Dashboard
                </button>
            </nav>

            <div className="flex flex-1 p-6 gap-6 max-w-7xl mx-auto w-full">
                {/* LEFT PANEL: CONFIG FORM */}
                <div className="flex-1 bg-[#111827] border border-slate-800 rounded-xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-6">Configure Escalation</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Detection</label>
                            <select
                                value={detectionType}
                                onChange={(e) => {
                                    setDetectionType(e.target.value);
                                    setIsEnabled(true);
                                }}
                                className="w-full bg-[#1E293B] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="" disabled>Select detection type...</option>
                                <option value="Voice-SOS">Voice Help (Audio SOS)</option>
                                <option value="Fire">Fire</option>
                                <option value="Fall-person">Fallen-person</option>
                                <option value="Unconsciousness">Unconsciousness</option>
                                <option value="Violence">Assault / Violence</option>
                                <option value="Accident">Accident</option>
                            </select>
                        </div>

                        {detectionType && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Should the model detect this?
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsEnabled(true)}
                                        className={`flex-1 py-3 rounded-lg font-bold transition-all ${isEnabled ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]' : 'bg-[#1E293B] text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        Yes (Enabled)
                                    </button>
                                    <button
                                        onClick={() => setIsEnabled(false)}
                                        // FIX: This prevents the user from disabling Voice-SOS
                                        disabled={detectionType === 'Voice-SOS'}
                                        title={detectionType === 'Voice-SOS' ? "Voice SOS must remain enabled for safety." : ""}
                                        className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                                            !isEnabled 
                                                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
                                                : detectionType === 'Voice-SOS' 
                                                    ? 'bg-[#0B1120] text-slate-600 cursor-not-allowed opacity-50'
                                                    : 'bg-[#1E293B] text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        No (Disabled)
                                    </button>
                                </div>
                            </div>
                        )}

                        {detectionType && isEnabled && (
                            <>
                                {/* NEW: Location Address Input */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Incident Location Address
                                    </label>
                                    <div className="flex bg-[#1E293B] border border-slate-700 rounded-lg overflow-hidden focus-within:border-blue-500">
                                        <div className="px-3 flex items-center bg-[#0B1120] border-r border-slate-700 text-slate-400">
                                            <MapPin className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="text"
                                            value={locationAddress}
                                            onChange={(e) => setLocationAddress(e.target.value)}
                                            placeholder="e.g., Block A, 2nd Floor Server Room"
                                            className="w-full bg-[#1E293B] p-3 text-white text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Number of Escalations
                                    </label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map(num => (
                                            <button
                                                key={num}
                                                onClick={() => handleNumEscalationsChange(num)}
                                                className={`flex-1 py-3 rounded-lg font-bold transition-all ${numEscalations === num ? 'bg-blue-600 text-white' : 'bg-[#1E293B] text-slate-400 hover:bg-slate-700'}`}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-slate-300">
                                        Escalation Contacts & Timing
                                    </label>
                                    {escalations.map((esc, idx) => (
                                        <div key={idx} className="bg-[#1E293B] p-4 rounded-lg border border-slate-700">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-xs font-bold text-slate-400 uppercase">
                                                    Escalation {esc.level}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-slate-400">Delay (seconds):</label>
                                                    <input
                                                        type="number"
                                                        value={esc.delay_seconds}
                                                        onChange={(e) => updateEscalation(idx, 'delay_seconds', e.target.value)}
                                                        className="w-16 bg-[#0B1120] text-white text-center rounded border border-slate-600 py-1 text-sm"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-2 mb-3">
                                                <button
                                                    onClick={() => updateEscalation(idx, 'type', 'sms')}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-bold transition-all ${esc.type === 'sms' ? 'bg-blue-600 text-white' : 'bg-[#0B1120] text-slate-400'}`}
                                                >
                                                    <Phone className="w-4 h-4" /> SMS
                                                </button>
                                                <button
                                                    onClick={() => updateEscalation(idx, 'type', 'gmail')}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-bold transition-all ${esc.type === 'gmail' ? 'bg-slate-700 text-white' : 'bg-[#0B1120] text-slate-400'}`}
                                                >
                                                    <Mail className="w-4 h-4" /> Email
                                                </button>
                                            </div>

                                            <div className="flex mb-3">
                                                {esc.type === 'sms' && (
                                                    <div className="bg-[#0B1120] px-3 flex items-center border border-r-0 border-slate-600 rounded-l-lg text-slate-400 text-sm">
                                                        +91
                                                    </div>
                                                )}
                                                <input
                                                    type={esc.type === 'sms' ? "tel" : "email"}
                                                    placeholder={esc.type === 'sms' ? "10-digit phone number" : "abc@gmail.com"}
                                                    value={esc.contact.replace(/^\+91/, '')}
                                                    onChange={(e) => updateEscalation(idx, 'contact', e.target.value)}
                                                    className={`flex-1 bg-[#0B1120] text-white border border-slate-600 p-3 text-sm focus:outline-none focus:border-blue-500 ${esc.type === 'sms' ? 'rounded-r-lg' : 'rounded-lg'}`}
                                                />
                                            </div>

                                            {/* NEW: Send Location Checkbox */}
                                            <div className="flex items-center gap-2 pt-1">
                                                <input
                                                    type="checkbox"
                                                    id={`send_loc_${idx}`}
                                                    checked={esc.send_location || false}
                                                    onChange={(e) => updateEscalation(idx, 'send_location', e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-600 bg-[#0B1120] text-blue-500 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <label htmlFor={`send_loc_${idx}`} className="text-sm text-slate-300 cursor-pointer">
                                                    Include Location Address in Alert
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        <button
                            onClick={handleSave}
                            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-all mt-4 shadow-lg flex justify-center items-center gap-2"
                        >
                            Save Configuration to Database
                        </button>
                    </div>
                </div>

                {/* RIGHT PANEL: SAVED CONFIGS */}
                <div className="flex-1 bg-[#111827] border border-slate-800 rounded-xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-6">Database Status</h2>

                    {savedConfigs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[60%] text-slate-500">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                            <p>MongoDB is empty.</p>
                            <p className="text-sm mt-2 text-center">
                                Your AI will ignore all detections until you save a configuration here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
                            {savedConfigs.map(config => (
                                <div
                                    key={config._id}
                                    className={`bg-[#1E293B] border-l-4 rounded-r-lg p-4 relative ${config.enabled ? 'border-green-500' : 'border-red-500'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{config.detection_type}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider ${config.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                Status: {config.enabled ? 'Active' : 'Ignored'}
                                            </span>
                                            {/* Show location in DB view if exists */}
                                            {config.location_address && (
                                                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> {config.location_address}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setDetectionType(config.detection_type);
                                                    setIsEnabled(config.enabled);
                                                    setLocationAddress(config.location_address || ''); // LOAD LOCATION
                                                    
                                                    if (config.enabled && config.escalations?.length > 0) {
                                                        setNumEscalations(config.escalations.length);
                                                        const cleaned = config.escalations.map(esc => ({
                                                            ...esc,
                                                            contact: esc.type === 'sms'
                                                                ? esc.contact.replace(/^\+91/, '')
                                                                : esc.contact,
                                                            send_location: esc.send_location || false // LOAD CHECKBOX
                                                        }));
                                                        setEscalations(cleaned);
                                                    }
                                                }}
                                                className="p-2 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(config.detection_type)}
                                                className="p-2 bg-slate-700 hover:bg-red-500 rounded text-white transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {config.enabled && config.escalations && (
                                        <div className="mt-4 space-y-2">
                                            <p className="text-xs text-slate-400 font-bold uppercase">Escalation Chain:</p>
                                            {config.escalations.map((esc, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between bg-[#0B1120] p-2 rounded text-sm text-slate-300 border border-slate-700"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {esc.type === 'sms'
                                                            ? <Phone className="w-3.5 h-3.5 text-blue-400" />
                                                            : <Mail className="w-3.5 h-3.5 text-slate-400" />}
                                                        <span>{esc.contact}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        {esc.send_location && <MapPin className="w-3 h-3 text-green-400" title="Sending Location" />}
                                                        <span>Wait {esc.delay_seconds}s</span>
                                                        <span className="font-mono bg-slate-800 px-1 rounded">Lvl {esc.level}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
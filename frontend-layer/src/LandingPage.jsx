import React from 'react';
import { Shield, Zap, DownloadCloud, ChevronRight, Video, Lock } from 'lucide-react';

export default function LandingPage({ onLoginClick }) {
  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans flex flex-col">
      {/* Navbar */}
      <nav className="px-8 py-6 flex items-center justify-between border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-500" />
          <span className="text-xl font-bold tracking-wider text-white">RESqVision</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">How it works</a>
          <button
            onClick={onLoginClick}
            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg transition-all"
          >
            Access Dashboard
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="text-center max-w-4xl relative z-10">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            Next-Gen AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Emergency Detection</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Turn your local security cameras into intelligent life-saving devices.
            Keep the AI processing private on your own PC, while managing alerts from our cloud dashboard anywhere in the world.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://drive.google.com/file/d/1_K0ogvPkvf0SGSSdjUvXrkOUjSLFze9z/view?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95"
            >
              <DownloadCloud className="w-5 h-5" />
              Download AI Core (Windows)
            </a>
            <button
              onClick={onLoginClick}
              className="flex items-center gap-2 bg-[#1E293B] hover:bg-[#334155] border border-slate-700 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              Manage System <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-4">Requires Windows 10/11 • 100% Free • Local Processing</p>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="py-20 bg-[#0F172A] border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Why Local AI + Cloud UI?</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Experience the power of cloud management without sacrificing your privacy or paying for heavy cloud GPU processing.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#111827] p-8 rounded-2xl border border-slate-800">
              <div className="bg-blue-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Absolute Privacy</h3>
              <p className="text-slate-400">Your video feeds never leave your house. The AI processes frames locally on your PC and only sends text alerts to the cloud.</p>
            </div>

            <div className="bg-[#111827] p-8 rounded-2xl border border-slate-800">
              <div className="bg-indigo-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Zero Latency</h3>
              <p className="text-slate-400">By running AI locally, emergency detection (Fire, Fall, Accident) happens in milliseconds without relying on your internet upload speed.</p>
            </div>

            <div className="bg-[#111827] p-8 rounded-2xl border border-slate-800">
              <div className="bg-green-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Video className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Multi-Camera Support</h3>
              <p className="text-slate-400">Scan and connect to multiple local IP cameras simultaneously with our seamless 1-click Windows AI installer.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight } from 'lucide-react';

export default function LoginPage({ onLoginSuccess, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill out all fields.");
      return;
    }
    
    // Using simple mock authentication for now. 
    // Usually, you would hit your backend's /auth/login endpoint here.
    // For this architecture demo, we just simulate setting the user session.
    
    localStorage.setItem('resq_user_id', username);
    onLoginSuccess(username);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-slate-400 hover:text-white transition-colors"
      >
        ← Back to Home
      </button>

      <div className="bg-[#0F172A] border border-slate-800 p-8 rounded-2xl w-full max-w-md relative z-10 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-500/10 p-3 rounded-xl mb-4">
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isRegistering ? "Create an Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Secure access to your emergency dashboard
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#111827] border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                placeholder="Enter your username"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111827] border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-6"
          >
            {isRegistering ? "Register" : "Secure Login"} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isRegistering ? "Already have an account? Login" : "Need an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}

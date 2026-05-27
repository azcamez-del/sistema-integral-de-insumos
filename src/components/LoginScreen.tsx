import React, { useState } from 'react';
import { USERS, User } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    const p = password;

    const userObj = USERS[u];
    if (!userObj || userObj.pass !== p) {
      setErrorMsg('Usuario o contraseña incorrectos.');
      return;
    }

    setErrorMsg('');
    onLoginSuccess({
      username: u,
      ...userObj
    });
  };

  return (
    <div id="login-screen" className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#131722] via-[#0d253b] to-[#1d4ed8] p-5">
      <div className="login-card bg-white rounded-2xl p-8 md:p-10 w-full max-w-[440px] shadow-2xl border border-white/10 z-10 transition-transform duration-300">
        <div className="login-logo text-center mb-8">
          <p className="org font-mono text-[11px] tracking-[3px] text-gray-500 uppercase mb-2">BUAP · CCU</p>
          <h1 className="text-3xl font-bold text-gray-900">
            Sistema <span className="text-blue-600">Integral</span>
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Gestión de Insumos y Compras</p>
        </div>

        {errorMsg && (
          <div className="error-msg bg-red-50 text-red-600 border border-red-100 rounded-lg p-3 text-xs md:text-sm mb-4">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
              className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-3.5 py-2 text-xs md:text-sm text-gray-900 bg-[#f5f3ee] focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
              required
            />
          </div>

          <div className="form-group">
            <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-3.5 py-2 text-xs md:text-sm text-gray-900 bg-[#f5f3ee] focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs md:text-sm font-bold shadow-lg hover:shadow-blue-500/20 active:translate-y-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            Iniciar sesión
          </button>
        </form>
      </div>

      <div className="dev-mark mt-8 font-mono text-[10px] md:text-xs text-white/40 tracking-[2px] text-center">
        COMPAÑÍA DE SOFTWARE: AEROPULSETECH
      </div>
    </div>
  );
}

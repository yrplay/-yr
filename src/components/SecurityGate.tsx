import React, { useState } from 'react';

interface SecurityGateProps {
  children: React.ReactNode;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({ children }) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return sessionStorage.getItem('ghaith_gate_authorized') === 'true';
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // التحقق من رمز المرور المعتمد لمقرأة غيث الغيم
    if (passcode.trim() === '1234') {
      sessionStorage.setItem('ghaith_gate_authorized', 'true');
      setIsAuthorized(true);
      setError('');
    } else {
      setError('رمز المرور غير صحيح، يرجى المحاولة مرة أخرى');
    }
  };

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4" dir="rtl">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl">
        <div className="text-center mb-6">
          <span className="text-4xl">🪴</span>
          <h2 className="text-2xl font-bold text-white mt-2">
            مقرأة غيث الغيم
          </h2>
          <p className="text-slate-400 text-sm mt-1">أدخل رمز الدخول للمتابعة</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-2">رمز المرور (Passcode)</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg transition duration-200"
          >
            دخول للنظام
          </button>
        </form>
      </div>
    </div>
  );
};

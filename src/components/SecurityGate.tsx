import React, { useState, useEffect } from 'react';
import initialDatabase from '../../data/database.json';

interface User {
  id: string;
  name: string;
  role: string;
  title: string;
  email: string;
  pin?: string;
}

interface SecurityGateProps {
  children: React.ReactNode;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return sessionStorage.getItem('ghaith_gate_authorized') === 'true';
  });

  useEffect(() => {
    // جلب المستخدمين من التخزين المحلي أو من قاعدة البيانات الأولية
    const savedUsers = localStorage.getItem('ghaith_staff_users');
    if (savedUsers) {
      try {
        setUsers(JSON.parse(savedUsers));
      } catch {
        setUsers(initialDatabase.users || []);
      }
    } else {
      setUsers(initialDatabase.users || []);
    }
  }, []);

  useEffect(() => {
    if (users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = users.find((u) => u.id === selectedUserId);
    if (!currentUser) {
      setError('يرجى اختيار الحساب');
      return;
    }

    // جلب الرمز السري المخزن للمعلمة (أو الافتراضي 1234)
    const savedPin = localStorage.getItem(`ghaith_pin_${currentUser.id}`) || currentUser.pin || '1234';

    if (pin.trim() === savedPin) {
      sessionStorage.setItem('ghaith_gate_authorized', 'true');
      sessionStorage.setItem('ghaith_current_user_id', currentUser.id);
      setIsAuthorized(true);
      setError('');
    } else {
      setError('الرمز السري غير صحيح، يرجى المحاولة مرة أخرى');
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
          <h2 className="text-2xl font-bold text-white mt-2">مقرأة غيث الغيم</h2>
          <p className="text-slate-400 text-sm mt-1">تسجيل دخول المعلمات والإدارة</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1.5 font-medium">اسم المعلمة / المشرفة</label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setError('');
                setPin('');
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.title})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-1.5 font-medium">الرمز السري الخاص بك</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={6}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-center text-xl tracking-widest focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg transition duration-200 mt-2"
          >
            دخول للنظام
          </button>
        </form>
      </div>
    </div>
  );
};

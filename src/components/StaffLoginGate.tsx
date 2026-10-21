import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Lock, Key, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getIslamicIcon } from './IslamicIconLibrary';

interface StaffLoginGateProps {
  onSuccess: () => void;
}

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onSuccess }) => {
  const { users, switchUser, settings, showToast } = useApp();

  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];
  const userIcon = getIslamicIcon(selectedUser?.avatarIcon);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsVerifying(true);

    try {
      const trimmedCode = enteredPasscode.trim();
      const userCode = String(selectedUser?.passcode || '').trim();
      const masterCode = String(settings.leaderPasscode || '').trim();

      // Check if matches individual staff passcode OR leader master passcode OR universal default (1234 / 0000)
      const isValid = 
        (userCode && trimmedCode === userCode) ||
        (masterCode && trimmedCode === masterCode) ||
        trimmedCode === '1234' ||
        trimmedCode === '0000';

      if (isValid) {
        await switchUser(selectedUser.id);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ghaith_authenticated', 'true');
          sessionStorage.setItem('ghaith_user_id', selectedUser.id);
        }
        showToast(`أهلاً بكِ أ. ${selectedUser.name}، تم تسجيل الدخول بنجاح 🪴`, 'success');
        onSuccess();
      } else {
        setErrorMsg('رمز الدخول السري غير صحيح! يمكنكِ إدخال الرمز المسند لكِ، أو استخدام الرمز الافتراضي (1234).');
      }
    } catch (err: any) {
      setErrorMsg('حدث خطأ أثناء تسجيل الدخول: ' + (err.message || ''));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF5F2] via-[#F4ECE7] to-[#EAE0D7] flex flex-col items-center justify-center p-4 selection:bg-[#E8D5D8]">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[#E8DFD8] shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Icon or Uploaded Logo & Welcome Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-white border border-[#E0D0D4] flex items-center justify-center mx-auto shadow-xs p-1 overflow-hidden">
            <img
              src={settings.logoUrl || '/pwa-192x192.png'}
              alt={settings.name || 'مقرأة غيث الغيم'}
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="text-2xl font-extrabold text-stone-900 font-quran tracking-tight">
            {settings.name || 'مقرأة غيث الغيم'}
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            بوابة دخول الكادر التعليمي والإشرافي المعتمد 🛡️
          </p>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 bg-[#FAF7F4] rounded-2xl border border-[#EFE8E2] text-xs text-stone-600 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-stone-800">
            <Lock className="w-3.5 h-3.5 text-[#8E5364]" />
            <span>نظام أمان محكم وموثوق:</span>
          </div>
          <p className="text-[11px] leading-relaxed text-stone-500">
            الدخول مقتصر على المعلمات والمشرفات المضافات في المقرأة. اختاري اسمكِ وأدخلي رمزكِ السري المعتمد للدخول لحلقتكِ وبياناتكِ.
          </p>
        </div>

        {/* Sign-in Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* User selector with Islamic Icon Preview */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              اختاري اسمكِ وصفتكِ في المقرأة:
            </label>
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={e => {
                  setSelectedUserId(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full pl-3 pr-10 py-2.5 border border-stone-200 rounded-xl text-xs font-bold bg-white text-stone-800 focus:ring-2 focus:ring-[#8E5364] focus:border-transparent cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — ({u.title})
                  </option>
                ))}
              </select>
              
              <div className="absolute right-2.5 top-2.5 pointer-events-none w-5 h-5 flex items-center justify-center">
                {selectedUser?.avatarIcon ? (
                  userIcon.svg({ className: 'w-4 h-4', color: selectedUser.avatarColor || '#8E5364' })
                ) : (
                  <span className="text-sm">👩‍🏫</span>
                )}
              </div>
            </div>
          </div>

          {/* Passcode input with Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-stone-700">
                رمز الدخول السري (PIN):
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                maxLength={16}
                placeholder="أدخلي رمزكِ السري..."
                value={enteredPasscode}
                onChange={e => {
                  setEnteredPasscode(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full pl-10 pr-9 py-2.5 border border-stone-200 rounded-xl text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-[#8E5364] focus:border-transparent font-bold"
              />
              <Key className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3 text-stone-400 hover:text-stone-700 transition cursor-pointer"
                title={showPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1.5 px-0.5">
              <span>الرمز السري الافتراضي: <strong className="text-stone-700 font-mono">1234</strong></span>
              <span>يمكنكِ تغييره من ملفكِ الشخصي 🔒</span>
            </div>
          </div>

          {/* Error display */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isVerifying || !enteredPasscode}
            className="w-full py-3 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <span>جاري التحقق من الهوية...</span>
            ) : (
              <>
                <span>دخول إلى واجهة المقرأة</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Guidance & Developer Signature */}
        <div className="text-center pt-3 border-t border-stone-100 space-y-2">
          <p className="text-[11px] text-stone-400">
            تحت إشراف قائدة المقرأة: <strong>{settings.leaderName || 'ريفة المنصوري'}</strong>
          </p>
          <div className="text-[10px] text-stone-400 flex items-center justify-center gap-1 font-medium">
            <span>تطوير وإشراف تقني:</span>
            <span className="font-bold text-[#8E5364] font-mono">بواسطة ياسر التاج · yr_alhosine</span>
            <span>✨</span>
          </div>
        </div>

      </div>
    </div>
  );
};

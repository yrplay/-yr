import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { IslamicIconPicker, renderUserAvatarBadge, getAvatarLabel } from './IslamicIconLibrary';
import { X, Upload, Trash2, FileSignature, Sparkles, Check, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';

interface EditTeacherProfileModalProps {
  user: User;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditTeacherProfileModal: React.FC<EditTeacherProfileModalProps> = ({
  user,
  onClose,
  onSuccess
}) => {
  const { updateUser, showToast, currentUser } = useApp();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: user.name || '',
    title: user.title || 'معلمة حلقة قرآنية',
    email: user.email || '',
    phone: user.phone || '05',
    avatarIcon: user.avatarIcon || 'mushaf',
    avatarColor: user.avatarColor || '#8E5364',
    signatureUrl: user.signatureUrl || '',
    newPasscode: '',
    confirmPasscode: ''
  });

  const [showPasscode, setShowPasscode] = useState(false);

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('حجم ملف التوقيع يجب أن يكون أقل من 2 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setFormData(prev => ({ ...prev, signatureUrl: dataUrl }));
      showToast('تم رفع صورة التوقيع المعتمد بنجاح ✍️', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setFormData(prev => ({ ...prev, signatureUrl: '' }));
    showToast('تمت إزالة صورة التوقيع', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('يرجى إدخال اسم المعلمة', 'error');
      return;
    }

    // Validate new passcode if entered
    if (formData.newPasscode.trim()) {
      if (formData.newPasscode.trim().length < 4) {
        showToast('الرمز السري الجديد يجب أن يتكون من 4 خانات على الأقل', 'error');
        return;
      }
      if (formData.newPasscode.trim() !== formData.confirmPasscode.trim()) {
        showToast('الرمز السري الجديد وتأكيده غير متطابقين', 'error');
        return;
      }
    }

    setLoading(true);

    try {
      const updates: Partial<User> = {
        name: formData.name.trim(),
        title: formData.title.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        avatarIcon: formData.avatarIcon,
        avatarColor: formData.avatarColor,
        signatureUrl: formData.signatureUrl
      };

      if (formData.newPasscode.trim()) {
        updates.passcode = formData.newPasscode.trim();
      }

      await updateUser(user.id, updates);

      showToast(
        formData.newPasscode.trim()
          ? 'تم حفظ وتحديث البيانات وتغيير الرمز السري بنجاح 🔒✨'
          : 'تم حفظ وتحديث الشعار والألوان والتوقيع بنجاح ✨',
        'success'
      );
      onSuccess?.();
      onClose();
    } catch {
      showToast('حدث خطأ أثناء حفظ التعديلات', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center border shadow-2xs transition"
              style={{
                backgroundColor: `${formData.avatarColor}18`,
                borderColor: `${formData.avatarColor}40`,
                color: formData.avatarColor
              }}
            >
              {renderUserAvatarBadge(formData.avatarIcon, formData.avatarColor, 'w-6 h-6')}
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base font-quran flex items-center gap-2">
                <span>تعديل الشعار والألوان والتوقيع والبيانات</span>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                  تخصيص الهوية
                </span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                تخصيص الهوية الخاصة بـ: <strong className="text-stone-800">{user.name}</strong> • الشعار الحالي: <span className="font-bold" style={{ color: formData.avatarColor }}>{getAvatarLabel(formData.avatarIcon)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">الاسم الكريم *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="أ. سارة المنصوري"
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-stone-50/50 focus:bg-white focus:border-[#8E5364] outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">المسمى الوظيفي / الحلقة</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="معلمة حلقة راسخات"
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-stone-50/50 focus:bg-white focus:border-[#8E5364] outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="teacher@ghaym.org"
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono bg-stone-50/50 focus:bg-white focus:border-[#8E5364] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">رقم الجوال</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="05XXXXXXXX"
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono bg-stone-50/50 focus:bg-white focus:border-[#8E5364] outline-hidden"
              />
            </div>
          </div>

          {/* تغيير الرمز السري الخاص بالمعلمة */}
          <div className="p-3.5 bg-[#FAF0F3]/40 rounded-2xl border border-[#8E5364]/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#8E5364]" />
                <span>الرمز السري للدخول (PIN):</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-stone-500">رمزكِ الحالي:</span>
                <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-800">
                  {user.passcode || 'غير محدد'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  تعيين رمز سري جديد (اتركيه فارغاً إذا لا ترغبين في تغييره)
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    value={formData.newPasscode}
                    onChange={e => setFormData({ ...formData, newPasscode: e.target.value })}
                    placeholder="مثال: 5544"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute left-2.5 top-2 text-stone-400 hover:text-stone-600"
                  >
                    {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  تأكيد الرمز السري الجديد
                </label>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={formData.confirmPasscode}
                  onChange={e => setFormData({ ...formData, confirmPasscode: e.target.value })}
                  placeholder="إعادة إدخال الرمز"
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-900"
                />
              </div>
            </div>
            <p className="text-[10px] text-stone-500">
              💡 يمكنكِ تغيير هذا الرمز في أي وقت واستخدامه لتسجيل الدخول إلى المقرأة.
            </p>
          </div>

          {/* Islamic Icons & Quranic Emojis + Color Picker */}
          <div>
            <IslamicIconPicker
              selectedIconId={formData.avatarIcon}
              selectedColor={formData.avatarColor}
              onSelect={(iconId, color) => {
                setFormData(prev => ({ ...prev, avatarIcon: iconId, avatarColor: color }));
              }}
            />
          </div>

          {/* Signature Upload Area */}
          <div className="p-4 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-[#8E5364]" />
                <span>رفع التوقيع المعتمد (يظهر تلقائياً على بطاقات التسميع والشهادات):</span>
              </label>
              {formData.signatureUrl && (
                <button
                  type="button"
                  onClick={handleRemoveSignature}
                  className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف التوقيع</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="px-4 py-2.5 bg-white border border-stone-300 hover:border-[#8E5364] rounded-xl text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-2 shadow-2xs transition active:scale-95">
                <Upload className="w-4 h-4 text-[#8E5364]" />
                <span>اختيار صورة التوقيع من الجهاز (PNG / JPG)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
              </label>

              {formData.signatureUrl ? (
                <div className="p-2 bg-white rounded-xl border border-emerald-200 flex items-center gap-3 shadow-2xs">
                  <img
                    src={formData.signatureUrl}
                    alt="معاينة التوقيع"
                    className="h-10 max-w-[150px] object-contain drop-shadow-xs"
                  />
                  <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>جاهز ومعتمد</span>
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-stone-400">
                  يُفضل رفع صورة مفرغة بتنسيق PNG حتى يظهر توقيعكِ الرسمي بشكل احترافي
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 cursor-pointer transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'جاري الحفظ...' : 'حفظ التعديلات والشعار والتوقيع'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

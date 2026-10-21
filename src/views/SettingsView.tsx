import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings, Download, Upload, RotateCcw, ShieldAlert,
  Save, CheckCircle2, History, Database, Cloud, AlertCircle,
  Palette, Lock, Sparkles, Check, Share2, Copy, FileSignature,
  Stamp, Trash2, Eye, EyeOff, Type, Image as ImageIcon
} from 'lucide-react';
import { OfficialSeal } from '../components/OfficialSeal';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const SettingsView: React.FC = () => {
  const {
    settings, updateSettings, downloadBackup, restoreBackup, resetSampleData,
    auditLogs, currentUser, showToast
  } = useApp();

  const [form, setForm] = useState({
    name: settings.name || 'مقرأة غيث الغيم',
    leaderName: settings.leaderName || 'ريفة المنصوري',
    subtitle: settings.subtitle || 'منصة الإدارة والتمكين القرآني المتكاملة',
    motto: settings.motto || 'نحو جيل حافظ متقن لكتاب الله يرتل الآيات رسوخاً وفهماً',
    academicYear: settings.academicYear || '1446هـ',
    currentHijriMonth: settings.currentHijriMonth || 'ربيع الآخر - جمادى الأولى',
    supportEmail: settings.supportEmail || 'info@ghaym.org',
    supportPhone: settings.supportPhone || '0500000001',
    primaryColor: settings.primaryColor || '#8E5364',
    secondaryColor: settings.secondaryColor || '#2D5A43',
    buttonRadius: settings.buttonRadius || 'rounded-2xl',
    activeTrackName: settings.activeTrackName || 'مشكاة الغيم للحفظ',
    logoUrl: settings.logoUrl || '',
    fontFamily: settings.fontFamily || 'thmanyah-sans',
    sealText: settings.sealText || 'ختم الاعتماد الرسمي',
    sealSubtitle: settings.sealSubtitle || 'معتمد للعام ١٤٤٦هـ',
    sealImageUrl: settings.sealImageUrl || '',
    leaderSignatureUrl: settings.leaderSignatureUrl || '',
    securityEnabled: settings.securityEnabled ?? true,
    leaderPasscode: settings.leaderPasscode || '1234'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showLeaderPasscode, setShowLeaderPasscode] = useState(false);

  // Sync form when settings change from backend
  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name || 'مقرأة غيث الغيم',
        leaderName: settings.leaderName || 'ريفة المنصوري',
        subtitle: settings.subtitle || 'منصة الإدارة والتمكين القرآني المتكاملة',
        motto: settings.motto || 'نحو جيل حافظ متقن لكتاب الله يرتل الآيات رسوخاً وفهماً',
        academicYear: settings.academicYear || '1446هـ',
        currentHijriMonth: settings.currentHijriMonth || 'ربيع الآخر - جمادى الأولى',
        supportEmail: settings.supportEmail || 'info@ghaym.org',
        supportPhone: settings.supportPhone || '0500000001',
        primaryColor: settings.primaryColor || '#8E5364',
        secondaryColor: settings.secondaryColor || '#2D5A43',
        buttonRadius: settings.buttonRadius || 'rounded-2xl',
        activeTrackName: settings.activeTrackName || 'مشكاة الغيم للحفظ',
        logoUrl: settings.logoUrl || '',
        fontFamily: settings.fontFamily || 'thmanyah-sans',
        sealText: settings.sealText || 'ختم الاعتماد الرسمي',
        sealSubtitle: settings.sealSubtitle || 'معتمد للعام ١٤٤٦هـ',
        sealImageUrl: settings.sealImageUrl || '',
        leaderSignatureUrl: settings.leaderSignatureUrl || '',
        securityEnabled: settings.securityEnabled ?? true,
        leaderPasscode: settings.leaderPasscode || '1234'
      });
    }
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('حجم الشعار يجب أن يكون أقل من 3 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setForm(prev => ({ ...prev, logoUrl: dataUrl }));
      showToast('تم رفع شعار المقرأة بنجاح 🖼️');
    };
    reader.readAsDataURL(file);
  };

  const handleSealImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('حجم صورة الختم يجب أن يكون أقل من 2 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setForm(prev => ({ ...prev, sealImageUrl: dataUrl }));
      showToast('تم رفع صورة الختم المخصص بنجاح 💮');
    };
    reader.readAsDataURL(file);
  };

  const handleLeaderSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('حجم صورة التوقيع يجب أن يكون أقل من 2 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setForm(prev => ({ ...prev, leaderSignatureUrl: dataUrl }));
      showToast('تم رفع توقيع قائدة المقرأة بنجاح ✍️');
    };
    reader.readAsDataURL(file);
  };

  const applyLiveIdentity = (updated: Partial<typeof form>) => {
    const next = { ...form, ...updated };
    setForm(next);

    if (typeof document !== 'undefined') {
      if (next.primaryColor) {
        document.documentElement.style.setProperty('--theme-primary', next.primaryColor);
        try {
          const num = parseInt(next.primaryColor.replace('#', ''), 16);
          const r = Math.max(0, (num >> 16) - 25);
          const g = Math.max(0, ((num >> 8) & 0xff) - 25);
          const b = Math.max(0, (num & 0xff) - 25);
          const hoverHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          document.documentElement.style.setProperty('--theme-primary-hover', hoverHex);
        } catch {}
      }
      if (next.secondaryColor) {
        document.documentElement.style.setProperty('--theme-secondary', next.secondaryColor);
        try {
          const num = parseInt(next.secondaryColor.replace('#', ''), 16);
          const r = Math.max(0, (num >> 16) - 25);
          const g = Math.max(0, ((num >> 8) & 0xff) - 25);
          const b = Math.max(0, (num & 0xff) - 25);
          const hoverHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          document.documentElement.style.setProperty('--theme-secondary-hover', hoverHex);
        } catch {}
      }
      if (next.buttonRadius === 'rounded-full') {
        document.documentElement.style.setProperty('--btn-radius', '9999px');
      } else if (next.buttonRadius === 'rounded-xl') {
        document.documentElement.style.setProperty('--btn-radius', '0.75rem');
      } else {
        document.documentElement.style.setProperty('--btn-radius', '1rem');
      }

      let fontStr = "'Thmanyah Sans', 'Tajawal', sans-serif";
      if (next.fontFamily === 'amiri') {
        fontStr = "'Amiri', serif";
      } else if (next.fontFamily === 'tajawal') {
        fontStr = "'Tajawal', sans-serif";
      } else {
        fontStr = "'Thmanyah Sans', 'Tajawal', sans-serif";
      }
      document.documentElement.style.setProperty('--font-active', fontStr);
      document.body.style.fontFamily = fontStr;
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(form);
      applyLiveIdentity(form);
      showToast('تم حفظ كافة التعديلات والعناوين والألوان والشعار والتواقيع بنجاح في النظام ✅');
    } finally {
      setIsSaving(false);
    }
  };

  const colorPalettes = [
    {
      name: 'عنابي غيث الغيم الملكي (الافتراضي)',
      primary: '#8E5364',
      secondary: '#2D5A43',
      desc: 'لون المقرأة التراثي الأنيق مع لمسة رمال هادئة'
    },
    {
      name: 'الزمرد القرآني الهادئ',
      primary: '#1F6E4C',
      secondary: '#78350F',
      desc: 'أخضر زمردي مريح مستوحى من رياض القرآن'
    },
    {
      name: 'الكحلي والياقوت الوقور',
      primary: '#1E3A8A',
      secondary: '#0284C7',
      desc: 'أزرق كحلي رسمي رصين يناسب الإدارة المعتمدة'
    },
    {
      name: 'العنبر والذهب الدافئ',
      primary: '#B45309',
      secondary: '#15803D',
      desc: 'تدرجات دافئة ذهبية راقية ومشرقة'
    }
  ];

  const handleCopyShareLink = () => {
    const shareUrl = window.location.origin;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    showToast('تم نسخ رابط المنصة المباشر للمشاركة مع المعلمات 📋');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const ok = await restoreBackup(json);
        if (!ok) setUploadError('صيغة ملف النسخة الاحتياطية غير صحيحة');
      } catch (err) {
        setUploadError('الملف المحدد ليس بصيغة JSON صالحة');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmReset = async () => {
    await resetSampleData();
    setResetConfirmOpen(false);
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">⚙️</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">تخصيص الهوية والشعار والختم والتواقيع</h2>
          </div>
          <p className="text-xs text-stone-500">
            تعديل المسميات والعناوين، رفع شعار المقرأة، تخصيص الختم الرسمي وتوقيع القائدة، وضبط خط ثمانية وباليت الألوان
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>جاري الحفظ...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات فوراً</span>
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">

        {/* 1. Main Titles & Information */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <span className="text-lg">🏛️</span>
              <span>١. العناوين والمسميات الأساسية للمقرأة:</span>
            </h3>
            <span className="text-[11px] text-stone-400">تظهر في الترويسة والشهادات والتقارير</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">اسم المقرأة / الجمعية:</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">اسم قائدة المقرأة:</label>
              <input
                type="text"
                required
                value={form.leaderName}
                onChange={e => setForm({ ...form, leaderName: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">اسم المسار النشط المعتمد:</label>
              <input
                type="text"
                value={form.activeTrackName}
                onChange={e => setForm({ ...form, activeTrackName: e.target.value })}
                placeholder="مثال: مشكاة الغيم للحفظ"
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 mb-1">الوصف التعريفي (العنوان الفرعي):</label>
              <input
                type="text"
                value={form.subtitle}
                onChange={e => setForm({ ...form, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">العام الأكاديمي والفصل:</label>
              <input
                type="text"
                value={form.academicYear}
                onChange={e => setForm({ ...form, academicYear: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
              />
            </div>
          </div>
        </div>

        {/* 2. Logo Upload from Device */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#8E5364]" />
              <span>٢. شعار المقرأة الرسمي (رفع من الجهاز):</span>
            </h3>
            <span className="text-[11px] text-stone-400">يظهر في الترويسة والشهادات والتقارير المعتمدة</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-[#FCFAF8] rounded-2xl border border-stone-200">
            <div className="w-24 h-24 rounded-2xl bg-white border border-stone-200 shadow-2xs flex items-center justify-center p-2 shrink-0 overflow-hidden">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="شعار المقرأة"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-stone-400">
                  <Cloud className="w-8 h-8 mx-auto text-stone-300 mb-1" />
                  <span className="text-[9px] block">الشعار الافتراضي</span>
                </div>
              )}
            </div>

            <div className="space-y-2 flex-1 text-center sm:text-right">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <label className="px-4 py-2 bg-white hover:bg-stone-50 border border-stone-300 hover:border-[#8E5364] rounded-xl text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-1.5 shadow-2xs transition">
                  <Upload className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>رفع شعار المقرأة من الجهاز</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>

                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إزالة الشعار المرفوع</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                يدعم صيغ PNG أو JPG أو SVG. يُفضل استخدام صورة مربعة أو أفقية بخلفية شفافة لتظهر بأبهى حلة في كامل شاشات المقرأة.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Official Seal & Leader Signature */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Stamp className="w-4 h-4 text-[#8E5364]" />
              <span>٣. الختم الرسمي وتوقيع قائدة المقرأة:</span>
            </h3>
            <span className="text-[11px] text-stone-400">يُطبع تلقائياً على شهادات الطالبات وتقارير الإنجاز</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Seal configuration */}
            <div className="p-4 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-3">
              <strong className="block text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <Stamp className="w-4 h-4 text-[#8E5364]" />
                <span>تخصيص ختم المقرأة والاعتماد:</span>
              </strong>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">عنوان الختم الرئيسي:</label>
                  <input
                    type="text"
                    value={form.sealText}
                    onChange={e => setForm({ ...form, sealText: e.target.value })}
                    placeholder="مثال: ختم الاعتماد الرسمي"
                    className="w-full px-3 py-1.5 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">النص الفرعي للختم:</label>
                  <input
                    type="text"
                    value={form.sealSubtitle}
                    onChange={e => setForm({ ...form, sealSubtitle: e.target.value })}
                    placeholder="مثال: معتمد للعام ١٤٤٦هـ"
                    className="w-full px-3 py-1.5 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Upload custom seal image option */}
              <div className="pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-stone-700">
                    أو ارفعي صورة ختمكِ الخاص المعتمد (اختياري):
                  </span>
                  {form.sealImageUrl && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, sealImageUrl: '' }))}
                      className="text-[10px] text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>إلغاء صورة الختم والعودة للختم الملكي</span>
                    </button>
                  )}
                </div>
                <label className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold text-stone-700 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs transition">
                  <Upload className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>رفع صورة ختم جاهزة (PNG شفاف)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSealImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Live Seal Preview */}
              <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-center gap-4 text-center">
                <OfficialSeal
                  institutionName={form.name}
                  sealText={form.sealText}
                  sealSubtitle={form.sealSubtitle}
                  sealImageUrl={form.sealImageUrl}
                  leaderName={form.leaderName}
                  color={form.primaryColor}
                  size="md"
                />
                <div className="text-right text-[11px] text-stone-500">
                  <span className="font-bold text-stone-800 block mb-0.5">معاينة الختم المباشرة:</span>
                  <span>هكذا سيظهر الختم في أسفل شهادة إنجاز الطالبة وخطابات التكريم.</span>
                </div>
              </div>
            </div>

            {/* Leader Signature configuration */}
            <div className="p-4 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-3">
              <strong className="block text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-[#8E5364]" />
                <span>توقيع قائدة المقرأة (أ. {form.leaderName}):</span>
              </strong>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                ارفعي صورة توقيعكِ الرسمي ليُدرج تلقائياً فوق اسمكِ في جميع الشهادات المعتمدة، مع توقيع معلمة الحلقة وختم المقرأة.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <label className="px-4 py-2 bg-white hover:bg-stone-50 border border-stone-300 hover:border-[#8E5364] rounded-xl text-xs font-bold text-stone-700 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs transition">
                  <Upload className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>رفع توقيع القائدة من الجهاز</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLeaderSignatureUpload}
                    className="hidden"
                  />
                </label>

                {form.leaderSignatureUrl && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, leaderSignatureUrl: '' }))}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف التوقيع</span>
                  </button>
                )}
              </div>

              {/* Signature Preview */}
              <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-stone-800">قائدة المقرأة: {form.leaderName}</div>
                  <div className="text-[10px] text-stone-400">توقيع معتمد ورسمي</div>
                </div>
                {form.leaderSignatureUrl ? (
                  <div className="p-1 border border-stone-100 rounded-lg bg-stone-50">
                    <img
                      src={form.leaderSignatureUrl}
                      alt="توقيع القائدة"
                      className="h-10 max-w-[120px] object-contain drop-shadow-2xs"
                    />
                  </div>
                ) : (
                  <span className="text-[11px] text-stone-400 italic">لم يُرفع توقيع بعد</span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* 4. Font Family: Thmanyah Font & Weights */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Type className="w-4 h-4 text-[#8E5364]" />
              <span>٤. خط ثمانية الحديث وأوزان الخطوط المعتمدة:</span>
            </h3>
            <span className="text-[11px] text-stone-400">
              باستخدام مكتبة @dawod/thmanyah-font-web
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'thmanyah-sans',
                name: 'خط ثمانية الحديث الأساسي (Thmanyah Sans)',
                desc: 'الخط الافتراضي المعتمد للواجهة بالكامل بجميع أوزانه المرفوعة (300، 400، 500، 700، 900)',
                familyClass: 'font-thmanyah',
                badge: 'الأساسي الافتراضي ⭐'
              },
              {
                id: 'tajawal',
                name: 'خط تجوال (Tajawal) — احتياطي ثانوي',
                desc: 'خط عربي هندسي متناسق وواضح ومريح للقراءة السريعة',
                familyClass: 'font-tajawal',
                badge: 'احتياطي ثانوي 🔄'
              },
              {
                id: 'amiri',
                name: 'خط الأميري (Amiri) — احتياطي ثانوي',
                desc: 'خط نسخي تراثي أصيل لآيات القرآن الكريم والشهادات الرسمية',
                familyClass: 'font-amiri',
                badge: 'احتياطي ثانوي 📖'
              }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyLiveIdentity({ fontFamily: f.id as any })}
                className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
                  form.fontFamily === f.id
                    ? 'border-[#8E5364] bg-[#FAF2F4] ring-2 ring-[#8E5364]/20 shadow-xs'
                    : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold text-stone-900 ${f.familyClass}`}>{f.name}</span>
                  {form.fontFamily === f.id && <Check className="w-4 h-4 text-[#8E5364]" />}
                </div>
                <div className="text-[10px] text-[#8E5364] font-semibold mb-1">{f.badge}</div>
                <p className="text-[11px] text-stone-500">{f.desc}</p>
                
                {/* Live weight sample */}
                <div className="mt-3 pt-2 border-t border-stone-200/60 text-stone-800 text-xs space-y-1">
                  <div className="font-light text-[11px]">مقرأة غيث الغيم (وزن خفيف 300)</div>
                  <div className="font-normal text-xs">مقرأة غيث الغيم (وزن عادي 400)</div>
                  <div className="font-medium text-xs">مقرأة غيث الغيم (وزن متوسط 500)</div>
                  <div className="font-bold text-xs text-[#8E5364]">مقرأة غيث الغيم (وزن ثقيل 700)</div>
                  <div className="font-black text-xs text-[#8E5364]">مقرأة غيث الغيم (وزن أسود 900)</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 5. Visual Colors & Button Styling */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#8E5364]" />
              <span>٥. تخصيص باليت الألوان وزوايا الأزرار:</span>
            </h3>
            <span className="text-[11px] text-stone-400">تحديث فوري لكامل الواجهة</span>
          </div>

          {/* Preset Palettes */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2">
              باليتات الألوان الإسلامية الجاهزة:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {colorPalettes.map(palette => {
                const isSelected = form.primaryColor === palette.primary && form.secondaryColor === palette.secondary;
                return (
                  <button
                    key={palette.name}
                    type="button"
                    onClick={() => applyLiveIdentity({
                      primaryColor: palette.primary,
                      secondaryColor: palette.secondary
                    })}
                    className={`p-3.5 rounded-2xl border text-right transition cursor-pointer ${
                      isSelected
                        ? 'border-[#8E5364] bg-[#FAF2F4] shadow-xs ring-2 ring-[#8E5364]/20'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full shadow-xs" style={{ backgroundColor: palette.primary }}></span>
                      <span className="w-6 h-6 rounded-full shadow-xs" style={{ backgroundColor: palette.secondary }}></span>
                      {isSelected && <Check className="w-4 h-4 text-[#8E5364] mr-auto" />}
                    </div>
                    <strong className="block text-xs text-stone-900 mb-0.5">{palette.name}</strong>
                    <p className="text-[10px] text-stone-500">{palette.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Hex Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-200">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                اللون الأساسي للأزرار والعناوين (Primary Hex):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={e => applyLiveIdentity({ primaryColor: e.target.value })}
                  className="w-9 h-9 rounded-xl border border-stone-300 p-0.5 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={e => applyLiveIdentity({ primaryColor: e.target.value })}
                  className="w-32 px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-mono font-bold uppercase"
                />
                <span className="text-[11px] text-stone-500">يُطبق على الأزرار والشعارات فوراً</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                اللون الثانوي للشارات والإنجاز (Secondary Hex):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={e => applyLiveIdentity({ secondaryColor: e.target.value })}
                  className="w-9 h-9 rounded-xl border border-stone-300 p-0.5 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.secondaryColor}
                  onChange={e => applyLiveIdentity({ secondaryColor: e.target.value })}
                  className="w-32 px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-mono font-bold uppercase"
                />
                <span className="text-[11px] text-stone-500">يُطبق على مؤشرات التميز والحضور</span>
              </div>
            </div>
          </div>

          {/* Button Roundness Style */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2">
              نمط وزوايا الأزرار والبطاقات:
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'rounded-2xl', label: 'انحناء متناسق ناعم (الافتراضي)', style: 'rounded-2xl' },
                { id: 'rounded-xl', label: 'زوايا كلاسيكية رصينة', style: 'rounded-xl' },
                { id: 'rounded-full', label: 'أزرار بيضاوية دائرية بالكامل', style: 'rounded-full' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyLiveIdentity({ buttonRadius: item.id as any })}
                  className={`p-3 border text-center transition cursor-pointer text-xs font-bold ${
                    item.style
                  } ${
                    form.buttonRadius === item.id
                      ? 'border-[#8E5364] bg-[#FAF2F4] text-[#8E5364] ring-2 ring-[#8E5364]/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 6. PWA Progressive Web App Installation Card */}
        <PWAInstallButton variant="settings" />

        {/* 6. Security, Staff Access Gate & Passcode */}
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#8E5364]" />
              <span>٦. الأمان وبوابة الدخول ورمز القائدة:</span>
            </h3>
            <span className="text-[11px] text-stone-400">حماية المنصة والبيانات</span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            لحماية بيانات الطالبات ومنع فتح الواجهة إلا للأشخاص المضافين رسمياً: عند تفعيل بوابة الأمان، تظهر شاشة تسجيل دخول ولا تفتح المنصة إلا بعد إدخال المعلمة لرمزها السري (PIN) أو إدخالكِ لرمز القائدة الرئيسي.
          </p>

          <div className="p-4 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <strong className="block text-xs text-stone-900 font-bold">
                  تفعيل بوابة التحقق ورمز الدخول للكادر
                </strong>
                <span className="text-[11px] text-stone-500">
                  {form.securityEnabled
                    ? 'بوابة الأمان مُفعلة حالياً ✅ لا يدخل إلا من تملكين رمزه السري'
                    : 'بوابة الأمان متوقفة مؤقتاً (مفتوح للجميع)'}
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={form.securityEnabled}
                  onChange={e => setForm({ ...form, securityEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8E5364]"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-200">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  رمز القائدة السري الرئيسي (Leader Master PIN):
                </label>
                <div className="relative">
                  <input
                    type={showLeaderPasscode ? 'text' : 'password'}
                    required
                    value={form.leaderPasscode}
                    onChange={e => setForm({ ...form, leaderPasscode: e.target.value })}
                    placeholder="1234"
                    className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-xl text-xs font-mono font-bold tracking-widest text-[#8E5364]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLeaderPasscode(!showLeaderPasscode)}
                    className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showLeaderPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-stone-400 mt-1 block">
                  يتزامن هذا الرمز مباشرة مع حسابكِ في الخادم ويسمح لكِ بالدخول المباشر
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  رابط مشاركة المنصة مع المعلمات:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.origin : 'https://...'}
                    className="flex-1 px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-xs font-mono text-stone-600 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="flex items-center gap-1 px-3 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'تم النسخ' : 'نسخ الرابط'}</span>
                  </button>
                </div>
                <span className="text-[10px] text-stone-400 mt-1 block">
                  شاركي هذا الرابط مع معلماتك، وكل معلمة تختار اسمها وتدخل رمزها السري للدخول لحلقتها
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button Bar */}
        <div className="flex items-center justify-between p-4 bg-white rounded-3xl border border-[#E8DFD8]">
          <span className="text-xs text-stone-500">
            تُحفظ كافة التغييرات مباشرة في قاعدة البيانات المركزية وتتزامن فوراً مع المعلمات.
          </span>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الإعدادات والهوية والشعار</span>
          </button>
        </div>

      </form>

      {/* Backup, Restore & Reset Section */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
        <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-[#8E5364]" />
          <span>النسخ الاحتياطي وحفظ البيانات المعتمد:</span>
        </h3>

        <p className="text-xs text-stone-500 leading-relaxed">
          جميع البيانات (المسارات، الحلقات، الطالبات، الخطط، الدرجات، الحضور، التحديات) تُحفظ بصورة دائمة وتلقائية في الخادم. يمكنكِ تحميل نسخة احتياطية مستقلة أو استعادتها في أي وقت.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          
          {/* Download backup */}
          <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-stone-900 font-bold text-xs mb-1">
                <Download className="w-4 h-4 text-[#8E5364]" />
                <span>تحميل نسخة احتياطية (JSON)</span>
              </div>
              <p className="text-[11px] text-stone-500">
                تنزيل ملف كامل يحتوي على كافة سجلات المقرأة والطالبات والدرجات للتحوط والأمان.
              </p>
            </div>
            <button
              onClick={downloadBackup}
              className="w-full py-2 bg-[#FAF3F5] hover:bg-[#F2E5E8] text-[#8E5364] border border-[#E2CBD2] rounded-xl text-xs font-bold transition cursor-pointer"
            >
              تحميل ملف النسخة
            </button>
          </div>

          {/* Restore backup */}
          <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-stone-900 font-bold text-xs mb-1">
                <Upload className="w-4 h-4 text-[#2D5A43]" />
                <span>استعادة البيانات من نسخة</span>
              </div>
              <p className="text-[11px] text-stone-500">
                رفع ملف JSON تم تنزيله سابقاً لاسترجاع كافة البيانات المحدثة بدقة.
              </p>
            </div>
            <label className="w-full py-2 bg-[#EBF3EE] hover:bg-[#DCEADA] text-[#2D5A43] border border-[#CDE0D4] rounded-xl text-xs font-bold transition text-center cursor-pointer block">
              اختيار ملف واستعادة
              <input
                type="file"
                accept=".json"
                onChange={handleFileRestore}
                className="hidden"
              />
            </label>
          </div>

          {/* Reset to sample */}
          <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-stone-900 font-bold text-xs mb-1">
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <span>إعادة ضبط البيانات الأصلية</span>
              </div>
              <p className="text-[11px] text-stone-500">
                إرجاع النظام إلى بيانات البدء النموذجية لمسار مشكاة الغيم وحلقات راسخات.
              </p>
            </div>
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إعادة ضبط البيانات
            </button>
          </div>

        </div>

        {uploadError && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Developer Signature & Platform Credits Card */}
      <div className="bg-gradient-to-r from-[#FAF2F4] via-[#FCFAF8] to-[#F4ECEE] p-5 rounded-3xl border border-[#E8DFD8] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-[#E0D0D4] flex items-center justify-center text-lg shadow-xs">
            ✍️
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">تصميم وتطوير المنصة:</div>
            <div className="text-sm font-bold text-[#8E5364] flex items-center gap-1.5 font-mono">
              <span>بواسطة ياسر التاج · yr_alhosine</span>
              <span>✨</span>
            </div>
          </div>
        </div>
        <div className="text-[11px] text-stone-400 bg-white px-3 py-1.5 rounded-xl border border-stone-200">
          جميع الحقوق محفوظة لمقرأة {form.name || 'غيث الغيم'} © ١٤٤٦هـ
        </div>
      </div>

      {/* Confirmation Reset Modal */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-stone-900 text-base">هل أنتِ متأكدة من إعادة الضبط؟</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                سيتم مسح أية سجلات مضافة حديثاً وإعادة الحلقات والطالبات والمسارات إلى البيانات النموذجية الأصلية.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                تأكيد إعادة الضبط
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  UserCog, Plus, Edit, Shield, CheckCircle2, UserCheck,
  Mail, Phone, Layers, Award, X, Eye, EyeOff, Upload, Trash2, Sparkles, FileSignature,
  Copy, KeyRound, Check, Table, LayoutGrid, Share2, Lock
} from 'lucide-react';
import { User, UserRole, UserPermissions, defaultPermissionsByRole } from '../types';
import { getIslamicIcon, IslamicIconPicker, renderUserAvatarBadge, getAvatarLabel } from '../components/IslamicIconLibrary';

const PERMISSION_ITEMS: {
  key: keyof UserPermissions;
  title: string;
  description: string;
  category: string;
  icon: string;
}[] = [
  {
    key: 'canRecordAttendance',
    title: 'رصد الحضور والغياب اليومي',
    description: 'تسجيل الحضور والغياب والتأخر والاستئذان لطالبات الحلقات.',
    category: 'العمليات اليومية',
    icon: '📋'
  },
  {
    key: 'canRecordRecitation',
    title: 'تسجيل التسميع وشروط الحفظ المتقن',
    description: 'رصد أوجه التسميع، احتساب خصومات الأخطاء، واعتماد درجة الإتقان.',
    category: 'العمليات اليومية',
    icon: '📖'
  },
  {
    key: 'canGradeAtqini',
    title: 'تصحيح ورصد واجبات «أتقني»',
    description: 'مراجعة وتقييم إرساليات الواجبات الإثرائية ورصد الدرجات المستحقة.',
    category: 'التقييم والأنشطة',
    icon: '✍️'
  },
  {
    key: 'canManageChallenges',
    title: 'إطلاق وتقييم التحديات والمراجعة الثنائية',
    description: 'تفعيل التحديات التنافسية وإسناد الرفيقة ومتابعة إنجاز الورد.',
    category: 'التقييم والأنشطة',
    icon: '🏆'
  },
  {
    key: 'canGradeExams',
    title: 'رصد واعتماد درجات الاختبارات الشهرية',
    description: 'تقييم الطالبات في لجان الاختبارات الشهرية وتخصيص المقررات الفردية.',
    category: 'التقييم والأنشطة',
    icon: '📊'
  },
  {
    key: 'canEditStudents',
    title: 'إضافة وتعديل بيانات وملفات الطالبات',
    description: 'تعديل السجلات، النقل بين الحلقات والمسارات، وتحديث بيانات التواصل.',
    category: 'إدارة الطالبات',
    icon: '👩‍🎓'
  },
  {
    key: 'canViewReports',
    title: 'استعراض وتصدير التقارير والإحصائيات',
    description: 'الوصول لكشوفات التحصيل والإنجاز التراكمية وتصدير ملفات PDF وExcel.',
    category: 'التقارير والمتابعة',
    icon: '📈'
  },
  {
    key: 'canManagePlans',
    title: 'إدارة وتعديل الخطط والمناهج القرآنية',
    description: 'تعديل مسارات الحفظ وتخصيص مقررات الأرباع وتوزيع المنهج الزمني.',
    category: 'الشؤون الأكاديمية',
    icon: '📅'
  },
  {
    key: 'canManageFinances',
    title: 'إدارة قسم الاشتراكات والمالية',
    description: 'الاطلاع على كشوفات سداد الطالبات، وتوثيق سندات الدفع، وإدارة رسوم المقرأة ودورات التحصيل.',
    category: 'المالية والاشتراكات',
    icon: '💳'
  },
  {
    key: 'canEditTrackCriteria',
    title: 'تعديل معايير المسار ودليل الإتقان',
    description: 'تخصيص وتعديل معايير دليل الإتقان وشروط التسميع والمراجعة التابعة لكل مسار.',
    category: 'الشؤون الأكاديمية',
    icon: '🎯'
  },
  {
    key: 'canManageSettings',
    title: 'الوصول لإعدادات وهوية المقرأة العامة',
    description: 'تغيير الشعار والهوية البصرية والألوان وإدارة نصوص المنظومة.',
    category: 'الإدارة العليا',
    icon: '⚙️'
  }
];

export const StaffView: React.FC = () => {
  const { users, circles, currentUser, createUser, updateUser, showToast, settings } = useApp();

  // تخصيص القسم بالكامل لإدارة المقرأة فقط (القائدة)
  if (currentUser?.role !== 'leader') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-3xl shadow-xs mb-4">
          <Lock className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold font-quran text-stone-900 mb-2">
          قسم المعلمات والمشرفات خاص بإدارة المقرأة فقط
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 max-w-md leading-relaxed">
          عذراً أ. {currentUser?.name || 'المعلمة'}، سجلات الكادر التعليمي، والتواقيع المعتمدة، والصلاحيات، والرموز السرية مخصصة ومحفوظة لإدارة المقرأة العليا فقط.
        </p>
      </div>
    );
  }

  // وضع العرض: جدول بيانات الكادر أو بطاقات تفصيلية
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // التحكم بظهور جميع الرموز السرية (تكون ظاهرة افتراضياً للإدارة كما طُلب)
  const [showAllPins, setShowAllPins] = useState(true);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);

  // نافذة التعديل السريع للرمز السري
  const [quickPinModalUser, setQuickPinModalUser] = useState<User | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  // Manual permissions modal state
  const [permissionsModalUser, setPermissionsModalUser] = useState<User | null>(null);
  const [userPermissionsState, setUserPermissionsState] = useState<UserPermissions>({
    canRecordAttendance: true,
    canRecordRecitation: true,
    canGradeAtqini: true,
    canManageChallenges: true,
    canGradeExams: true,
    canEditStudents: false,
    canViewReports: false,
    canManagePlans: false,
    canManageSettings: false,
  });

  const [staffForm, setStaffForm] = useState({
    name: '',
    role: 'teacher' as UserRole,
    title: 'معلمة حلقة',
    email: '',
    phone: '05',
    passcode: String(Math.floor(1000 + Math.random() * 9000)),
    avatarIcon: 'mushaf',
    avatarColor: '#8E5364',
    signatureUrl: '',
    circleIds: [] as string[]
  });

  const getUserEffectivePermissions = (user: User): UserPermissions => {
    const defaultForRole = defaultPermissionsByRole[user.role] || defaultPermissionsByRole.teacher;
    return {
      ...defaultForRole,
      ...(user.permissions || {})
    };
  };

  const handleOpenPermissionsModal = (user: User) => {
    setPermissionsModalUser(user);
    setUserPermissionsState(getUserEffectivePermissions(user));
  };

  const handleToggleSinglePermission = (key: keyof UserPermissions) => {
    setUserPermissionsState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGrantAllPermissions = () => {
    setUserPermissionsState({
      canRecordAttendance: true,
      canRecordRecitation: true,
      canGradeAtqini: true,
      canManageChallenges: true,
      canGradeExams: true,
      canEditStudents: true,
      canViewReports: true,
      canManagePlans: true,
      canManageFinances: true,
      canEditTrackCriteria: true,
      canManageSettings: true,
    });
  };

  const handleRevokeAllPermissions = () => {
    setUserPermissionsState({
      canRecordAttendance: false,
      canRecordRecitation: false,
      canGradeAtqini: false,
      canManageChallenges: false,
      canGradeExams: false,
      canEditStudents: false,
      canViewReports: false,
      canManagePlans: false,
      canManageFinances: false,
      canEditTrackCriteria: false,
      canManageSettings: false,
    });
  };

  const handleResetToRoleDefault = () => {
    if (!permissionsModalUser) return;
    const defaultForRole = defaultPermissionsByRole[permissionsModalUser.role] || defaultPermissionsByRole.teacher;
    setUserPermissionsState(defaultForRole);
  };

  const handleSavePermissions = async () => {
    if (!permissionsModalUser) return;
    await updateUser(permissionsModalUser.id, {
      permissions: userPermissionsState
    });
    showToast(`تم حفظ وتحديث صلاحيات ${permissionsModalUser.name} بنجاح 🛡️`);
    setPermissionsModalUser(null);
  };

  const togglePinReveal = (userId: string) => {
    setRevealedPins(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const isUserPinRevealed = (userId: string) => {
    if (showAllPins) {
      return revealedPins[userId] !== false;
    }
    return !!revealedPins[userId];
  };

  const handleOpenStaffModal = (user?: User) => {
    if (user) {
      setEditingStaff(user);
      setStaffForm({
        name: user.name,
        role: user.role,
        title: user.title,
        email: user.email || '',
        phone: user.phone || '05',
        passcode: user.passcode || localStorage.getItem(`ghaith_pin_${user.id}`) || '',
        avatarIcon: user.avatarIcon || 'mushaf',
        avatarColor: user.avatarColor || '#8E5364',
        signatureUrl: user.signatureUrl || '',
        circleIds: user.circleIds || []
      });
    } else {
      setEditingStaff(null);
      setStaffForm({
        name: '',
        role: 'teacher',
        title: 'معلمة حلقة قرآنية',
        email: '',
        phone: '05',
        passcode: String(Math.floor(1000 + Math.random() * 9000)),
        avatarIcon: 'mushaf',
        avatarColor: '#8E5364',
        signatureUrl: '',
        circleIds: []
      });
    }
    setStaffModalOpen(true);
  };

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
      setStaffForm(prev => ({ ...prev, signatureUrl: dataUrl }));
      showToast('تم رفع صورة التوقيع بنجاح ✍️');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setStaffForm(prev => ({ ...prev, signatureUrl: '' }));
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      showToast('يرجى إدخال اسم المعلمة والبريد الإلكتروني', 'error');
      return;
    }

    const cleanPasscode = staffForm.passcode.trim();

    if (editingStaff) {
      await updateUser(editingStaff.id, staffForm);
      if (cleanPasscode) {
        try {
          await setDoc(doc(db, 'staff_pins', editingStaff.id), {
            userId: editingStaff.id,
            pin: cleanPasscode,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch {}
        localStorage.setItem(`ghaith_pin_${editingStaff.id}`, cleanPasscode);
      }
      showToast(`تم حفظ وتحديث بيانات ${staffForm.name} بنجاح ✨`);
    } else {
      const created = await createUser(staffForm);
      if (created && cleanPasscode) {
        try {
          await setDoc(doc(db, 'staff_pins', created.id), {
            userId: created.id,
            pin: cleanPasscode,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch {}
        localStorage.setItem(`ghaith_pin_${created.id}`, cleanPasscode);
      }
      showToast(`تمت إضافة ${staffForm.name} إلى الكادر بنجاح ✨`);
    }
    setStaffModalOpen(false);
  };

  // فتح نافذة التعديل السريع للرمز السري
  const handleOpenQuickPinModal = (user: User) => {
    setQuickPinModalUser(user);
    setNewPinValue(user.passcode || localStorage.getItem(`ghaith_pin_${user.id}`) || '');
  };

  const handleSaveQuickPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPinModalUser || !newPinValue.trim()) return;

    setPinSaving(true);
    const cleanPin = newPinValue.trim();

    try {
      // 1. التحديث في السحابة في Firestore
      await setDoc(doc(db, 'staff_pins', quickPinModalUser.id), {
        userId: quickPinModalUser.id,
        pin: cleanPin,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. التحديث في التخزين المحلي
      localStorage.setItem(`ghaith_pin_${quickPinModalUser.id}`, cleanPin);

      // 3. التحديث في حالة المستخدمين في السياق
      await updateUser(quickPinModalUser.id, { passcode: cleanPin });

      showToast(`تم تحديث الرمز السري لـ ${quickPinModalUser.name} بنجاح 🔑`, 'success');
      setQuickPinModalUser(null);
    } catch {
      localStorage.setItem(`ghaith_pin_${quickPinModalUser.id}`, cleanPin);
      await updateUser(quickPinModalUser.id, { passcode: cleanPin });
      showToast(`تم حفظ الرمز السري محلياً لـ ${quickPinModalUser.name}`, 'info');
      setQuickPinModalUser(null);
    } finally {
      setPinSaving(false);
    }
  };

  // نسخ الرمز السري فقط
  const handleCopyPinOnly = (user: User) => {
    const pin = user.passcode || localStorage.getItem(`ghaith_pin_${user.id}`) || '----';
    navigator.clipboard.writeText(pin);
    showToast(`تم نسخ الرمز السري لـ (${user.name}) بنجاح 🔑`, 'success');
  };

  // نسخ رسالة بيانات الدخول الكاملة لإرسالها للمعلمة
  const handleCopyLoginMessage = (user: User) => {
    const pin = user.passcode || localStorage.getItem(`ghaith_pin_${user.id}`) || '----';
    const siteUrl = window.location.origin;
    const msg = `السلام عليكم ورحمة الله وبركاته أ. ${user.name} 🌸\n\nإليكِ بيانات اعتماد الدخول الرسمية لمنصة ${settings?.name || 'مقرأة غيث الغيم'}:\n• البريد الإلكتروني: ${user.email}\n• الرمز السري (PIN): ${pin}\n\nرابط المنصة المباشر:\n${siteUrl}\n\nنسأل الله لكِ التوفيق والسداد 🌿`;
    
    navigator.clipboard.writeText(msg);
    showToast(`تم نسخ رسالة بيانات الدخول المكتملة لـ ${user.name} 📋`, 'success');
  };

  const handleToggleCircle = (circleId: string) => {
    const exists = staffForm.circleIds.includes(circleId);
    if (exists) {
      setStaffForm({
        ...staffForm,
        circleIds: staffForm.circleIds.filter(id => id !== circleId)
      });
    } else {
      setStaffForm({
        ...staffForm,
        circleIds: [...staffForm.circleIds, circleId]
      });
    }
  };

  const roleLabels = {
    leader: { label: 'قائدة المقرأة', bg: 'bg-rose-100 text-rose-800 border-rose-300' },
    supervisor: { label: 'مشرفة مسار / حلقات', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
    teacher: { label: 'معلمة حلقة', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
  };

  // إحصائيات سريعة للإدارة
  const totalStaff = users.length;
  const teachersCount = users.filter(u => u.role === 'teacher').length;
  const supervisorsCount = users.filter(u => u.role === 'supervisor').length;
  const signaturesUploaded = users.filter(u => !!u.signatureUrl).length;

  return (
    <div className="space-y-6">

      {/* Header Bar للإدارة */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">👩‍🏫</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">
              سجل المعلمات والمشرفات والرموز السرية
            </h2>
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">
              خاص بالإدارة العليا 🔒
            </span>
          </div>
          <p className="text-xs text-stone-500">
            إدارة حسابات الكادر، استعراض وتعيين الرموز السرية (PIN)، مشاركة بيانات الدخول، واعتماد التواقيع والصلاحيات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* تبديل إظهار / إخفاء كافة الرموز */}
          <button
            type="button"
            onClick={() => {
              setShowAllPins(!showAllPins);
              setRevealedPins({});
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 border border-stone-200"
            title={showAllPins ? 'إخفاء كافة الرموز السرية' : 'إظهار كافة الرموز السرية'}
          >
            {showAllPins ? <EyeOff className="w-4 h-4 text-stone-600" /> : <Eye className="w-4 h-4 text-amber-600" />}
            <span>{showAllPins ? 'إخفاء الرموز' : 'إظهار كافة الرموز'}</span>
          </button>

          {/* التبديل بين عرض الجدول وعرض البطاقات */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>جدول الرموز</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>البطاقات</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenStaffModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة معلمة جديدة</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview للإدارة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-2xs">
          <div className="text-xs text-stone-500 font-semibold mb-1">إجمالي الكادر المسجل</div>
          <div className="text-xl font-bold text-stone-900 flex items-baseline gap-1">
            <span>{totalStaff}</span>
            <span className="text-xs font-normal text-stone-400">معلمة ومشرفة</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-2xs">
          <div className="text-xs text-stone-500 font-semibold mb-1">معلمات الحلقات</div>
          <div className="text-xl font-bold text-emerald-700 flex items-baseline gap-1">
            <span>{teachersCount}</span>
            <span className="text-xs font-normal text-stone-400">معلمة نشطة</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-2xs">
          <div className="text-xs text-stone-500 font-semibold mb-1">المشرفات المعتمدات</div>
          <div className="text-xl font-bold text-amber-700 flex items-baseline gap-1">
            <span>{supervisorsCount}</span>
            <span className="text-xs font-normal text-stone-400">مشرفة</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-2xs">
          <div className="text-xs text-stone-500 font-semibold mb-1">التواقيع المعتمدة المرفوعة</div>
          <div className="text-xl font-bold text-[#8E5364] flex items-baseline gap-1">
            <span>{signaturesUploaded}</span>
            <span className="text-xs font-normal text-stone-400">من {totalStaff}</span>
          </div>
        </div>
      </div>

      {/* العرض الأول: جدول بيانات الكادر والرموز السرية الشامل (Table View) */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#8E5364]" />
              <span>دليل بيانات الدخول والرموز السرية للكادر التعليمي والإداري</span>
            </h3>
            <span className="text-[11px] text-stone-400">
              جميع الرموز ظاهرة للإدارة ويمكن نسخها أو تعديلها فوراً
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#FAF7F5] border-b border-stone-200 text-stone-600">
                <tr>
                  <th className="py-3 px-4 font-bold">المعلمة / المشرفة</th>
                  <th className="py-3 px-4 font-bold">الصفة والدور</th>
                  <th className="py-3 px-4 font-bold">البريد الإلكتروني (اسم المستخدم)</th>
                  <th className="py-3 px-4 font-bold">الجوال</th>
                  <th className="py-3 px-4 font-bold bg-amber-50/50">الرمز السري (PIN)</th>
                  <th className="py-3 px-4 font-bold">الحلقات المسندة</th>
                  <th className="py-3 px-4 font-bold">التوقيع</th>
                  <th className="py-3 px-4 font-bold text-center">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map(user => {
                  const roleConfig = roleLabels[user.role] || roleLabels.teacher;
                  const iconColor = user.avatarColor || '#8E5364';
                  const isRevealed = isUserPinRevealed(user.id);
                  const userPin = user.passcode || localStorage.getItem(`ghaith_pin_${user.id}`) || '----';
                  
                  const supervisedCircles = circles.filter(c => c.supervisorId === user.id);
                  const taughtCircles = circles.filter(c => c.teacherId === user.id);
                  const assignedCount = user.role === 'supervisor' ? supervisedCircles.length : taughtCircles.length;

                  return (
                    <tr key={user.id} className="hover:bg-stone-50/80 transition">
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm border shrink-0 shadow-2xs"
                            style={{
                              backgroundColor: `${iconColor}18`,
                              borderColor: `${iconColor}40`,
                              color: iconColor
                            }}
                          >
                            {renderUserAvatarBadge(user.avatarIcon, iconColor, 'w-4 h-4')}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 text-xs sm:text-sm">{user.name}</div>
                            <div className="text-[11px] text-stone-500">{user.title}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleConfig.bg}`}>
                          {roleConfig.label}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 font-mono font-medium text-stone-800">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[170px]">{user.email}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(user.email || '');
                              showToast(`تم نسخ بريد ${user.name} 📋`);
                            }}
                            className="text-stone-400 hover:text-stone-700 transition cursor-pointer"
                            title="نسخ البريد الإلكتروني"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {user.phone || '—'}
                      </td>

                      {/* PIN & Actions */}
                      <td className="py-3 px-4 bg-amber-50/30">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono bg-white border border-amber-300 px-2.5 py-1 rounded-lg text-stone-900 font-bold text-xs tracking-widest shadow-2xs">
                            {isRevealed ? userPin : '••••'}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => togglePinReveal(user.id)}
                            className="p-1 text-stone-400 hover:text-stone-700 transition cursor-pointer"
                            title={isRevealed ? 'إخفاء' : 'إظهار'}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyPinOnly(user)}
                            className="p-1 text-stone-400 hover:text-[#8E5364] transition cursor-pointer"
                            title="نسخ الرمز السري"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenQuickPinModal(user)}
                            className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[10px] transition cursor-pointer"
                            title="تعديل الرمز السري فورياً"
                          >
                            تعديل الرمز
                          </button>
                        </div>
                      </td>

                      {/* Circles */}
                      <td className="py-3 px-4">
                        {user.role === 'leader' ? (
                          <span className="text-[#8E5364] font-bold text-[10px]">كافة الحلقات والمسارات</span>
                        ) : assignedCount > 0 ? (
                          <span className="font-bold text-stone-800 text-xs">
                            {assignedCount} حلقة مسندة
                          </span>
                        ) : (
                          <span className="text-stone-400 text-[11px]">غير مسندة</span>
                        )}
                      </td>

                      {/* Signature */}
                      <td className="py-3 px-4">
                        {user.signatureUrl ? (
                          <div className="flex items-center gap-1">
                            <img
                              src={user.signatureUrl}
                              alt="توقيع"
                              className="h-6 max-w-[60px] object-contain"
                            />
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-bold">
                              معتمد ✅
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-stone-400">غير مرفوع</span>
                        )}
                      </td>

                      {/* Administrative Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* نسخ رسالة الدخول المنسقة */}
                          <button
                            type="button"
                            onClick={() => handleCopyLoginMessage(user)}
                            className="p-1.5 rounded-lg bg-[#FAF0F3] hover:bg-[#8E5364] text-[#8E5364] hover:text-white transition cursor-pointer shadow-2xs"
                            title="نسخ رسالة بيانات الدخول (البريد + الرمز + الرابط) لمشاركتها"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {/* الصلاحيات */}
                          <button
                            type="button"
                            onClick={() => handleOpenPermissionsModal(user)}
                            className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer shadow-2xs"
                            title="إدارة الصلاحيات التسع"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* تعديل كامل */}
                          <button
                            type="button"
                            onClick={() => handleOpenStaffModal(user)}
                            className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer shadow-2xs"
                            title="تعديل البيانات الكاملة والتوقيع"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* العرض الثاني: بطاقات الكادر التفصيلية (Cards View) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(user => {
            const roleConfig = roleLabels[user.role] || roleLabels.teacher;
            const iconColor = user.avatarColor || '#8E5364';
            const isRevealed = isUserPinRevealed(user.id);
            const userPin = user.passcode || localStorage.getItem(`ghaith_pin_${user.id}`) || '----';

            const supervisedCircles = circles.filter(c => c.supervisorId === user.id);
            const taughtCircles = circles.filter(c => c.teacherId === user.id);

            return (
              <div
                key={user.id}
                className="bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4 hover:border-[#D4C4BC] transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Islamic Avatar */}
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg border transition shadow-2xs"
                      style={{
                        backgroundColor: `${iconColor}15`,
                        borderColor: `${iconColor}40`,
                        color: iconColor
                      }}
                      title={getAvatarLabel(user.avatarIcon)}
                    >
                      {renderUserAvatarBadge(user.avatarIcon, iconColor, 'w-6 h-6')}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">{user.name}</h3>
                      <p className="text-[11px] text-stone-500">{user.title}</p>
                      <span className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                        <span>✨</span>
                        <span>{getAvatarLabel(user.avatarIcon)}</span>
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleConfig.bg}`}>
                    {roleConfig.label}
                  </span>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5 text-xs text-stone-600 bg-[#FCFAF8] p-3 rounded-2xl border border-[#EFE8E2]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="text-[11px] font-mono truncate">{user.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(user.email || '');
                        showToast(`تم نسخ بريد ${user.name} 📋`);
                      }}
                      className="text-stone-400 hover:text-stone-700 transition"
                      title="نسخ البريد"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <span className="text-[11px] font-mono">{user.phone}</span>
                    </div>
                  )}
                </div>

                {/* الرمز السري (PIN) - بارز وظاهر للإدارة */}
                <div className="p-3 bg-amber-50/40 rounded-2xl border border-amber-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                    <span className="font-bold text-stone-800 text-[11px]">الرمز السري (PIN):</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-mono bg-white border border-amber-300 px-2.5 py-0.5 rounded-lg text-stone-900 font-bold text-xs tracking-wider shadow-2xs">
                      {isRevealed ? userPin : '••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePinReveal(user.id)}
                      className="p-1 text-stone-400 hover:text-stone-700 transition cursor-pointer"
                      title={isRevealed ? 'إخفاء الرمز' : 'إظهار الرمز'}
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyPinOnly(user)}
                      className="p-1 text-stone-400 hover:text-[#8E5364] transition cursor-pointer"
                      title="نسخ الرمز السري"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenQuickPinModal(user)}
                      className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] transition cursor-pointer"
                      title="تعديل الرمز"
                    >
                      تعديل
                    </button>
                  </div>
                </div>

                {/* Circles info */}
                <div className="pt-2 border-t border-stone-100 text-xs">
                  <span className="text-stone-400 block text-[10px] mb-1">الحلقات المسندة:</span>
                  {user.role === 'leader' ? (
                    <span className="text-[#8E5364] font-bold text-[11px]">صلاحية شاملة على كافة الحلقات والمسارات</span>
                  ) : user.role === 'supervisor' ? (
                    <div className="flex flex-wrap gap-1">
                      {supervisedCircles.length > 0 ? (
                        supervisedCircles.map(c => (
                          <span key={c.id} className="px-2 py-0.5 rounded-md bg-[#FAF0F3] text-[#8E5364] font-medium text-[11px]">
                            {c.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-stone-400 text-[11px]">لم يتم تحديد حلقات بعد</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {taughtCircles.length > 0 ? (
                        taughtCircles.map(c => (
                          <span key={c.id} className="px-2 py-0.5 rounded-md bg-[#EBF3EE] text-[#2D5A43] font-medium text-[11px]">
                            {c.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-stone-400 text-[11px]">لم يتم تحديد حلقات بعد</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Signature status preview */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                    <FileSignature className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>التوقيع المعتمد:</span>
                  </span>
                  {user.signatureUrl ? (
                    <div className="flex items-center gap-1.5">
                      <img
                        src={user.signatureUrl}
                        alt="توقيع"
                        className="h-6 max-w-[80px] object-contain drop-shadow-2xs"
                      />
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                        مرفوع ✅
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-400">لم يُرفع بعد</span>
                  )}
                </div>

                {/* Permissions summary */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                    <Shield className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>الصلاحيات المخصصة:</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF0F3] text-[#8E5364] border border-[#F3DFE5]">
                    {Object.values(getUserEffectivePermissions(user)).filter(Boolean).length} من ٩ صلاحيات
                  </span>
                </div>

                {/* Actions Bar */}
                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLoginMessage(user)}
                    className="flex-1 py-2 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-stone-200 cursor-pointer shadow-2xs active:scale-95"
                    title="نسخ رسالة بيانات الدخول للمشاركة"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>مشاركة الدخول</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenPermissionsModal(user)}
                    className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-stone-200 cursor-pointer shadow-2xs"
                    title="تحديد الصلاحيات"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>الصلاحيات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenStaffModal(user)}
                    className="py-2 px-3 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                    title="تعديل الشعار والبيانات"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة التعديل السريع للرمز السري (Quick PIN Change Modal) */}
      {quickPinModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">تعديل الرمز السري</h3>
                  <p className="text-[11px] text-stone-500">أ. {quickPinModalUser.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickPinModalUser(null)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-700">الرمز السري الجديد (PIN):</label>
                  <button
                    type="button"
                    onClick={() => setNewPinValue(String(Math.floor(1000 + Math.random() * 9000)))}
                    className="text-[11px] text-[#8E5364] hover:underline font-bold cursor-pointer"
                  >
                    توليد عشوائي 🎲
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newPinValue}
                  onChange={e => setNewPinValue(e.target.value)}
                  placeholder="مثال: 4589"
                  maxLength={8}
                  autoFocus
                  dir="ltr"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-center font-mono font-bold text-lg tracking-widest text-stone-900 focus:bg-white focus:border-[#8E5364] focus:outline-hidden"
                />
                <span className="text-[10px] text-stone-400 block mt-1">
                  يحفظ سحابياً ومحلياً فورياً وستتمكن المعلمة من الدخول به مباشرة.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setQuickPinModalUser(null)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={pinSaving}
                  className="px-5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {pinSaving ? 'جاري الحفظ...' : 'حفظ الرمز السري'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal (Add / Edit Full Profile) */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">👩‍🏫</span>
                <h3 className="font-bold text-stone-900 text-sm">
                  {editingStaff ? `تعديل بيانات: ${editingStaff.name}` : 'إضافة معلمة أو مشرفة جديدة'}
                </h3>
              </div>
              <button
                onClick={() => setStaffModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={staffForm.name}
                    onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="مثال: أ. منيرة السبيعي"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الصفة / الدور *</label>
                  <select
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white font-bold"
                  >
                    <option value="teacher">معلمة حلقة قرآنية</option>
                    <option value="supervisor">مشرفة مسار / حلقات</option>
                    <option value="leader">قائدة المقرأة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={staffForm.title}
                    onChange={e => setStaffForm({ ...staffForm, title: e.target.value })}
                    placeholder="مثال: معلمة حلقة راسخات"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">البريد الإلكتروني (لتسجيل الدخول) *</label>
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="name@ghaym.org"
                    dir="ltr"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">رقم الجوال</label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Passcode (PIN) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700">
                    رمز الدخول السري (PIN Code) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setStaffForm({ ...staffForm, passcode: String(Math.floor(1000 + Math.random() * 9000)) })}
                    className="text-[11px] text-[#8E5364] hover:underline font-semibold cursor-pointer"
                  >
                    توليد رمز عشوائي 🎲
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={staffForm.passcode}
                  onChange={e => setStaffForm({ ...staffForm, passcode: e.target.value })}
                  placeholder="مثال: 5432"
                  dir="ltr"
                  maxLength={8}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono font-bold tracking-wider"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  الرمز السري المخصص لهذه المعلمة للدخول لحسابها وإنجاز التسميع وإدارة طالباتها.
                </span>
              </div>

              {/* Islamic Symbolic Icon Selector */}
              <div>
                <IslamicIconPicker
                  selectedIconId={staffForm.avatarIcon}
                  selectedColor={staffForm.avatarColor}
                  onSelect={(iconId, color) => {
                    setStaffForm(prev => ({ ...prev, avatarIcon: iconId, avatarColor: color }));
                  }}
                />
              </div>

              {/* Signature Upload from Device */}
              <div className="p-4 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <FileSignature className="w-4 h-4 text-[#8E5364]" />
                    <span>توقيع المعلمة / المشرفة المعتمد (يظهر على الشهادات والتقارير):</span>
                  </label>
                  {staffForm.signatureUrl && (
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
                  <label className="px-4 py-2.5 bg-white border border-stone-300 hover:border-[#8E5364] rounded-xl text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-2 shadow-2xs transition">
                    <Upload className="w-4 h-4 text-[#8E5364]" />
                    <span>رفع التوقيع من الجهاز (PNG / JPG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>

                  {staffForm.signatureUrl ? (
                    <div className="p-2 bg-white rounded-xl border border-stone-200 flex items-center gap-3">
                      <img
                        src={staffForm.signatureUrl}
                        alt="معاينة التوقيع"
                        className="h-10 max-w-[140px] object-contain drop-shadow-xs"
                      />
                      <span className="text-[11px] text-emerald-700 font-bold">تم الرفع بنجاح ✅</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-stone-400">
                      يُفضل رفع صورة مفرغة بتنسيق PNG لتظهر واضحة فوق ختم المقرأة
                    </span>
                  )}
                </div>
              </div>

              {/* Circle assignments */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  الحلقات المسندة إليها:
                </label>
                <div className="p-3 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-2 max-h-36 overflow-y-auto">
                  {circles.map(circle => {
                    const checked = staffForm.circleIds.includes(circle.id);
                    return (
                      <label key={circle.id} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer hover:text-stone-900">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleCircle(circle.id)}
                          className="rounded text-[#8E5364] focus:ring-[#8E5364]"
                        />
                        <span>{circle.icon || '🪴'} {circle.name}</span>
                        <span className="text-[10px] text-stone-400 mr-auto">({circle.scheduleDays.join('، ')})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs active:scale-95 transition cursor-pointer"
                >
                  {editingStaff ? 'حفظ التعديلات والتوقيع' : 'إضافة إلى الكادر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Permissions Configuration Modal */}
      {permissionsModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-5 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#8E5364]/10 text-[#8E5364] flex items-center justify-center text-2xl border border-[#8E5364]/20 shadow-2xs">
                  🛡️
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-base font-quran flex items-center gap-2">
                    <span>نافذة تحديد الصلاحيات يدوياً</span>
                    <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                      تحكم إداري مباشر
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    تخصيص الصلاحيات لـ: <strong className="text-stone-800">{permissionsModalUser.name}</strong> • الصفة: <span className="font-bold text-[#8E5364]">{roleLabels[permissionsModalUser.role]?.label || permissionsModalUser.title}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPermissionsModalUser(null)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Presets Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#FAF6F2] rounded-2xl border border-[#EFE8E2]">
              <div className="text-xs text-stone-600 font-medium">
                الصلاحيات المفعلة حالياً: <strong className="text-[#8E5364] text-sm">{Object.values(userPermissionsState).filter(Boolean).length}</strong> من <strong className="text-stone-800">{PERMISSION_ITEMS.length}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleGrantAllPermissions}
                  className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-200 text-emerald-700 rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                >
                  ✓ تفعيل الكل
                </button>
                <button
                  type="button"
                  onClick={handleRevokeAllPermissions}
                  className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-200 text-rose-700 rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                >
                  ✕ تعطيل الكل
                </button>
                <button
                  type="button"
                  onClick={handleResetToRoleDefault}
                  className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                >
                  ↺ استعادة الافتراضي
                </button>
              </div>
            </div>

            {/* Permissions Switch List */}
            <div className="space-y-2.5">
              {PERMISSION_ITEMS.map(item => {
                const isEnabled = !!userPermissionsState[item.key];
                return (
                  <div
                    key={String(item.key)}
                    onClick={() => handleToggleSinglePermission(item.key)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isEnabled
                        ? 'bg-white border-[#8E5364]/40 shadow-xs'
                        : 'bg-stone-50/70 border-stone-200 opacity-75 hover:opacity-100 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition ${
                        isEnabled ? 'bg-[#8E5364]/10 text-[#8E5364]' : 'bg-stone-200/70 text-stone-400'
                      }`}>
                        {item.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs font-bold transition ${isEnabled ? 'text-stone-900' : 'text-stone-600'}`}>
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-stone-400 font-normal">
                            ({item.category})
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Toggle switch visual */}
                    <div className="shrink-0 mr-2">
                      <div
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-200 ease-in-out ${
                          isEnabled ? 'bg-[#8E5364] justify-end' : 'bg-stone-300 justify-start'
                        }`}
                      >
                        <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPermissionsModalUser(null)}
                className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 font-medium transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-6 py-2.5 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
              >
                <Shield className="w-4 h-4" />
                <span>حفظ واعتماد الصلاحيات المخصصة</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  UserCog, Plus, Edit, Shield, CheckCircle2, UserCheck,
  Mail, Phone, Layers, Award, X, Upload, Trash2, Sparkles, FileSignature,
  Copy, KeyRound, Check, Table, LayoutGrid, Lock
} from 'lucide-react';
import { User, UserRole, UserPermissions, defaultPermissionsByRole, hasFullAccess } from '../types';
import { IslamicIconPicker, renderUserAvatarBadge, getAvatarLabel } from '../components/IslamicIconLibrary';

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
  const { users, circles, currentUser, createUser, updateUser, deleteUser, showToast } = useApp();

  // تخصيص القسم بالكامل لإدارة المقرأة فقط (القائدة)
  if (!hasFullAccess(currentUser)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-3xl shadow-xs mb-4">
          <Lock className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold font-quran text-stone-900 mb-2">
          قسم المعلمات والمشرفات خاص بإدارة المقرأة فقط
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 max-w-md leading-relaxed">
          عذراً أ. {currentUser?.name || 'المعلمة'}، سجلات الكادر التعليمي، والتواقيع المعتمدة، والصلاحيات، وإعدادات الدخول مخصصة ومحفوظة لإدارة المقرأة العليا فقط.
        </p>
      </div>
    );
  }

  // وضع العرض: جدول بيانات الكادر أو بطاقات تفصيلية
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<User | null>(null);


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
    avatarIcon: 'mushaf',
    avatarColor: '#8E5364',
    signatureUrl: '',
    circleIds: [] as string[],
    passcode: ''
  });

  const copyTeacherCredentials = (teacher: User) => {
    const text = `🌸 بيانات حسابكِ في مقرأة غيث الغيم:
الاسم: ${teacher.name}
الصفة: ${teacher.title || (teacher.role === 'supervisor' ? 'مشرفة مسار' : 'معلمة حلقة')}
البريد الإلكتروني: ${teacher.email || '—'}
الرمز السري للدخول: ${teacher.passcode || 'غير محدد (يرجى مراجعة الإدارة)'}

(تستطيعين تغيير الرمز بنفسكِ في أي وقت من ملفكِ الشخصي في المقرأة 🔒)`;
    navigator.clipboard.writeText(text);
    showToast(`تم نسخ بيانات دخول ${teacher.name} لإرسالها لها 📋`, 'success');
  };

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

  const handleOpenStaffModal = (user?: User) => {
    if (user) {
      setEditingStaff(user);
      setStaffForm({
        name: user.name,
        role: user.role,
        title: user.title,
        email: user.email || '',
        phone: user.phone || '05',
        avatarIcon: user.avatarIcon || 'mushaf',
        avatarColor: user.avatarColor || '#8E5364',
        signatureUrl: user.signatureUrl || '',
        circleIds: user.circleIds || [],
        passcode: user.passcode || ''
      });
    } else {
      setEditingStaff(null);
      // Generate a fresh unique 4-digit PIN for the new teacher
      const autoGeneratedPin = Math.floor(1000 + Math.random() * 9000).toString();
      setStaffForm({
        name: '',
        role: 'teacher',
        title: 'معلمة حلقة قرآنية',
        email: '',
        phone: '05',
        avatarIcon: 'mushaf',
        avatarColor: '#8E5364',
        signatureUrl: '',
        circleIds: [],
        passcode: autoGeneratedPin
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
    const cleanPasscode = staffForm.passcode?.trim() || '';
    if (!cleanPasscode) {
      showToast('يرجى تحديد الرمز السري للدخول (PIN) لحساب المعلمة', 'error');
      return;
    }
    if (cleanPasscode.length < 4) {
      showToast('الرمز السري للدخول يجب ألا يقل عن 4 خانات', 'error');
      return;
    }

    if (editingStaff) {
      await updateUser(editingStaff.id, {
        ...staffForm,
        passcode: cleanPasscode
      });
      showToast(`تم حفظ وتحديث بيانات ${staffForm.name} بنجاح ✨`);
      setStaffModalOpen(false);
    } else {
      try {
        const created = await createUser({
          ...staffForm,
          passcode: cleanPasscode
        });
        setStaffModalOpen(false);
        copyTeacherCredentials(created);
      } catch (error: any) {
        showToast(error?.message || 'تعذر إضافة المعلمة', 'error');
      }
    }
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

  const canDeleteTargetUser = (curr: User | null, target: User): boolean => {
    if (!curr || !target) return false;
    if (curr.id === target.id) return false;
    // Platform Owner can NEVER be deleted
    if (target.role === 'owner' || target.email?.trim().toLowerCase() === 'yr.play.com@gmail.com') return false;
    // Owner can delete anyone else (developer, leader, supervisor, teacher)
    if (curr.role === 'owner' || curr.email?.trim().toLowerCase() === 'yr.play.com@gmail.com') return true;
    // Developer can delete leaders, supervisors, and teachers (cannot delete another developer)
    if (curr.role === 'developer') return target.role !== 'developer';
    // Leader can only delete supervisors and teachers
    if (curr.role === 'leader') return target.role === 'supervisor' || target.role === 'teacher';
    return false;
  };

  const canEditTargetRole = (curr: User | null, target: User): boolean => {
    if (!curr || !target) return false;
    // Owner role is immutable
    if (target.role === 'owner' || target.email?.trim().toLowerCase() === 'yr.play.com@gmail.com') return false;
    // Owner can edit any other user's role
    if (curr.role === 'owner' || curr.email?.trim().toLowerCase() === 'yr.play.com@gmail.com') return true;
    // Developer can change roles of leaders, supervisors, and teachers
    if (curr.role === 'developer') return target.role !== 'developer';
    // Leader can only switch roles between supervisor and teacher
    if (curr.role === 'leader') return target.role === 'supervisor' || target.role === 'teacher';
    return false;
  };

  const roleLabels: Record<UserRole, { label: string; bg: string }> = {
    owner: { label: 'مالك المنصة', bg: 'bg-purple-100 text-purple-900 border-purple-300' },
    developer: { label: 'المطور التقني', bg: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
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
              سجل المعلمات والمشرفات
            </h2>
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">
              خاص بالإدارة العليا 🔒
            </span>
          </div>
          <p className="text-xs text-stone-500">
            إدارة ملفات الكادر وإرسال روابط إعادة تعيين كلمات المرور واعتماد التواقيع والصلاحيات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">

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
              <span>جدول الكادر</span>
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
              <span>بيانات الكادر التعليمي والإداري</span>
            </h3>
            <span className="text-[11px] text-stone-400">
              أرسلي رابط إعادة التعيين إلى البريد المسجل عند الحاجة
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
                  <th className="py-3 px-4 font-bold">الرمز السري للدخول (PIN)</th>
                  <th className="py-3 px-4 font-bold">الحلقات المسندة</th>
                  <th className="py-3 px-4 font-bold">التوقيع</th>
                  <th className="py-3 px-4 font-bold text-center">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map(user => {
                  const roleConfig = roleLabels[user.role] || roleLabels.teacher;
                  const iconColor = user.avatarColor || '#8E5364';
                  
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

                      {/* الرمز السري للدخول */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold px-2.5 py-1 rounded-lg border text-xs ${
                            user.passcode ? 'bg-stone-100 text-stone-800 border-stone-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {user.passcode || 'غير محدد'}
                          </span>
                          {user.passcode && (
                            <button
                              type="button"
                              onClick={() => copyTeacherCredentials(user)}
                              className="p-1.5 rounded-lg bg-[#FAF0F3] hover:bg-[#8E5364] text-[#8E5364] hover:text-white transition cursor-pointer"
                              title="نسخ بيانات الدخول والرمز لإرسالها للمعلمة"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      {/* Circles */}
                      <td className="py-3 px-4">
                        {hasFullAccess(user) ? (
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

                          {/* حذف الحساب وإلغاء الصلاحية */}
                          {canDeleteTargetUser(currentUser, user) && (
                            <button
                              type="button"
                              onClick={() => setTeacherToDelete(user)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer shadow-2xs"
                              title={user.role === 'leader' ? "حذف حساب قائدة المقرأة وإلغاء الصلاحية" : "حذف حساب الموظفة وإلغاء الصلاحية"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                {/* Circles info */}
                <div className="pt-2 border-t border-stone-100 text-xs">
                  <span className="text-stone-400 block text-[10px] mb-1">الحلقات المسندة:</span>
                  {hasFullAccess(user) ? (
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

                {/* الرمز السري للدخول */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                    <KeyRound className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>الرمز السري للدخول (PIN):</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono font-bold px-2.5 py-0.5 rounded-lg border text-xs ${
                      user.passcode ? 'bg-stone-100 text-stone-800 border-stone-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {user.passcode || 'غير محدد'}
                    </span>
                    {user.passcode && (
                      <button
                        type="button"
                        onClick={() => copyTeacherCredentials(user)}
                        className="p-1 rounded-lg bg-[#FAF0F3] hover:bg-[#8E5364] text-[#8E5364] hover:text-white transition cursor-pointer"
                        title="نسخ بيانات الدخول والرمز للمعلمة"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyTeacherCredentials(user)}
                    className="flex-1 py-2 px-2.5 bg-[#FAF0F3] hover:bg-[#8E5364] text-[#8E5364] hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-[#8E5364]/20 cursor-pointer shadow-2xs active:scale-95"
                    title="نسخ رسالة بيانات الدخول الرسمية"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ بيانات الدخول</span>
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

                  {canDeleteTargetUser(currentUser, user) && (
                    <button
                      type="button"
                      onClick={() => setTeacherToDelete(user)}
                      className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-rose-200 cursor-pointer shadow-2xs active:scale-95"
                      title={user.role === 'leader' ? "حذف حساب قائدة المقرأة وإلغاء الصلاحية" : "حذف حساب الموظفة وإلغاء الصلاحية"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700">الصفة والمنصب *</label>
                    {editingStaff && canEditTargetRole(currentUser, editingStaff) && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                        قابلة لتعديل المنصب
                      </span>
                    )}
                  </div>
                  <select
                    value={staffForm.role}
                    onChange={e => {
                      const newRole = e.target.value as UserRole;
                      const roleDefaultTitle = newRole === 'leader' ? 'قائدة مقرأة غيث الغيم' : newRole === 'supervisor' ? 'مشرفة مسار' : newRole === 'developer' ? 'مهندس المنصة والمطور' : 'معلمة حلقة';
                      setStaffForm({
                        ...staffForm,
                        role: newRole,
                        title: staffForm.title && staffForm.title !== 'معلمة حلقة' && staffForm.title !== 'قائدة مقرأة غيث الغيم' ? staffForm.title : roleDefaultTitle
                      });
                    }}
                    disabled={editingStaff ? !canEditTargetRole(currentUser, editingStaff) : false}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white font-bold disabled:bg-stone-100 disabled:text-stone-500"
                  >
                    <option value="teacher">معلمة حلقة قرآنية</option>
                    <option value="supervisor">مشرفة مسار / حلقات</option>
                    <option value="leader">قائدة المقرأة (قابلة للتعديل والحذف)</option>
                    {/* Developer: exactly 1 allowed in system */}
                    {(currentUser?.role === 'owner' || editingStaff?.role === 'developer') && (
                      <option value="developer" disabled={users.some(u => u.role === 'developer' && u.id !== editingStaff?.id)}>
                        المطور التقني (مطور واحد فقط للمنصة)
                      </option>
                    )}
                    {editingStaff?.role === 'owner' && (
                      <option value="owner" disabled>مالك المنصة العام (منصب حصري غير قابل للنقل)</option>
                    )}
                  </select>
                  {editingStaff && !canEditTargetRole(currentUser, editingStaff) && (
                    <p className="mt-1 text-[10px] text-amber-700">
                      {editingStaff.role === 'owner' ? 'منصب مالك المنصة ثابت ومحمي من التعديل.' : 'تعديل هذا المنصب مقتصر على مالك المنصة أو المطور.'}
                    </p>
                  )}
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

              {/* Passcode (PIN) configuration */}
              <div className="p-3.5 bg-[#FAF0F3]/60 rounded-2xl border border-[#8E5364]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-[#8E5364]" />
                    <span>الرمز السري للدخول (PIN) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setStaffForm(prev => ({ ...prev, passcode: Math.floor(1000 + Math.random() * 9000).toString() }))}
                    className="text-[11px] text-[#8E5364] hover:underline font-bold cursor-pointer"
                  >
                    توليد رمز تلقائي 🎲
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={staffForm.passcode || ''}
                    onChange={e => setStaffForm({ ...staffForm, passcode: e.target.value })}
                    placeholder="حددي رمز الدخول الخاص (مثال: 5824)"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-sm font-mono font-bold text-stone-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-[#8E5364]/30"
                  />
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  🔒 تحدد قائدة المقرأة هذا الرمز الخاص وتزود به المعلمة للدخول به، وتستطيع المعلمة بعد دخولها تغييره بنفسها في أي وقت من ملفها الشخصي.
                </p>
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

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-100">
                {editingStaff && canDeleteTargetUser(currentUser, editingStaff) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherToDelete(editingStaff);
                      setStaffModalOpen(false);
                    }}
                    className="px-3 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف حساب {editingStaff.role === 'leader' ? 'القائدة' : 'الموظفة'} من المقرأة</span>
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
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

      {/* نافذة تأكيد حذف المعلمة / المشرفة */}
      {teacherToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-right shadow-2xl border border-stone-200 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-1 shadow-2xs">
              <Trash2 className="w-7 h-7 text-rose-600" />
            </div>
            
            <div className="text-center">
              <h3 className="text-base font-bold text-stone-900 font-quran">
                تأكيد حذف حساب {teacherToDelete.name}
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                الصفة: <span className="font-semibold text-stone-700">{teacherToDelete.title || 'معلمة حلقة'}</span> • البريد: <span className="font-mono text-stone-700">{teacherToDelete.email || '—'}</span>
              </p>
            </div>

            <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200 text-[11px] text-rose-900 leading-relaxed text-right space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-700">
                <span>⚠️</span>
                <span>تنبيه هام عند الحذف:</span>
              </div>
              <p>• سيتم إيقاف صلاحية دخول المعلمة للمقرأة فوراً.</p>
              <p>• سيتم فك ارتباط أي حلقات مسندة إليها لتصبح (غير مسندة).</p>
              <p>• لا تتأثر سجلات درجات الطالبات وتسميعهن السابق المحفوظ.</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const id = teacherToDelete.id;
                  setTeacherToDelete(null);
                  await deleteUser(id);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>نعم، تأكيد الحذف نهائياً</span>
              </button>
              <button
                type="button"
                onClick={() => setTeacherToDelete(null)}
                className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
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

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus, Edit, Shield, ShieldCheck, CheckCircle2, UserCheck,
  Mail, Phone, X, Upload, Trash2, Sparkles, FileSignature,
  Copy, KeyRound, Table, LayoutGrid, Lock, PenLine, Target,
  CheckSquare, Calendar, BookOpen, Trophy, BarChart3,
  Users, CreditCard, Settings, Layers, RefreshCw
} from 'lucide-react';
import {
  User,
  UserRole,
  UserPermissions,
  defaultPermissionsByRole,
  hasFullAccess,
  isTechnicalDeveloper
} from '../types';
import { IslamicIconPicker, renderUserAvatarBadge } from '../components/IslamicIconLibrary';
import {
  resolveStaffProfile,
  getDefaultWorkingHoursForRole,
  getDefaultMonthlySalaryForRole,
  getDefaultTasksForUser
} from '../utils/staffHelpers';

const PERMISSION_ITEMS: {
  key: keyof UserPermissions;
  title: string;
  description: string;
  category: string;
  IconComponent: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: 'canRecordAttendance',
    title: 'رصد الحضور والغياب اليومي',
    description: 'تسجيل الحضور والغياب والتأخر والاستئذان لطالبات الحلقات.',
    category: 'العمليات اليومية',
    IconComponent: CheckSquare
  },
  {
    key: 'canRecordRecitation',
    title: 'تسجيل التسميع وشروط الحفظ المتقن',
    description: 'رصد أوجه التسميع، احتساب خصومات الأخطاء، واعتماد درجة الإتقان.',
    category: 'العمليات اليومية',
    IconComponent: BookOpen
  },
  {
    key: 'canGradeAtqini',
    title: 'تصحيح ورصد واجبات «أتقني»',
    description: 'مراجعة وتقييم إرساليات الواجبات الإثرائية ورصد الدرجات المستحقة.',
    category: 'التقييم والأنشطة',
    IconComponent: Sparkles
  },
  {
    key: 'canManageChallenges',
    title: 'إطلاق وتقييم التحديات والمراجعة الثنائية',
    description: 'تفعيل التحديات التنافسية وإسناد الرفيقة ومتابعة إنجاز الورد.',
    category: 'التقييم والأنشطة',
    IconComponent: Trophy
  },
  {
    key: 'canGradeExams',
    title: 'رصد واعتماد درجات الاختبارات الشهرية',
    description: 'تقييم الطالبات في لجان الاختبارات الشهرية وتخصيص المقررات الفردية.',
    category: 'التقييم والأنشطة',
    IconComponent: FileSignature
  },
  {
    key: 'canEditStudents',
    title: 'إضافة وتعديل بيانات وملفات الطالبات',
    description: 'تعديل السجلات، النقل بين الحلقات والمسارات، وتحديث بيانات التواصل.',
    category: 'إدارة الطالبات',
    IconComponent: Users
  },
  {
    key: 'canViewReports',
    title: 'استعراض وتصدير التقارير والإحصائيات',
    description: 'الوصول لكشوفات التحصيل والإنجاز التراكمية وتصدير ملفات PDF وExcel.',
    category: 'التقارير والمتابعة',
    IconComponent: BarChart3
  },
  {
    key: 'canManagePlans',
    title: 'إدارة وتعديل الخطط والمناهج القرآنية',
    description: 'تعديل مسارات الحفظ وتخصيص مقررات الأرباع وتوزيع المنهج الزمني.',
    category: 'الشؤون الأكاديمية',
    IconComponent: Calendar
  },
  {
    key: 'canManageFinances',
    title: 'إدارة قسم الاشتراكات والمالية',
    description: 'الاطلاع على كشوفات سداد الطالبات، وتوثيق سندات الدفع، وإدارة رسوم المقرأة ودورات التحصيل.',
    category: 'المالية والاشتراكات',
    IconComponent: CreditCard
  },
  {
    key: 'canEditTrackCriteria',
    title: 'تعديل معايير المسار ودليل الإتقان',
    description: 'تخصيص وتعديل معايير دليل الإتقان وشروط التسميع والمراجعة التابعة لكل مسار.',
    category: 'الشؤون الأكاديمية',
    IconComponent: Target
  },
  {
    key: 'canAccessStaff',
    title: 'الوصول إلى قسم وسجل المعلمات والمشرفات',
    description: 'الاطلاع على سجل الكادر التعليمي، وإدارة بيانات وتوزيع المعلمات والمشرفات، وتعيين الحلقات.',
    category: 'إدارة الكادر والمقرأة',
    IconComponent: UserCheck
  },
  {
    key: 'canManageSettings',
    title: 'الوصول لإعدادات وهوية المقرأة العامة',
    description: 'تغيير الشعار والهوية البصرية والألوان وإدارة نصوص المنظومة.',
    category: 'الإدارة العليا',
    IconComponent: Settings
  },
  {
    key: 'canEditOwnWelcome',
    title: 'صلاحية تعديل ترحيب الدخول',
    description: 'السماح للمشرفة أو المعلمة بتعديل نص رسالة ترحيب الدخول الخاصة بها.',
    category: 'لوحة القيادة الشخصية',
    IconComponent: PenLine
  }
];

export const StaffView: React.FC = () => {
  const {
    users,
    circles,
    currentUser,
    createUser,
    updateUser,
    deleteUser,
    settings,
    updateSettings,
    showToast
  } = useApp();

  // Default to the original table view ('table')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Add / Edit Staff Modal State
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
    canManageFinances: false,
    canEditTrackCriteria: false,
    canAccessStaff: false,
    canManageSettings: false,
    canEditOwnWelcome: false
  });

  const [staffForm, setStaffForm] = useState({
    name: '',
    role: 'teacher' as UserRole,
    title: 'معلمة حلقة',
    email: '',
    phone: '05',
    avatarIcon: 'mushaf',
    avatarColor: '#ad4e00',
    signatureUrl: '',
    circleIds: [] as string[],
    passcode: ''
  });

  const roleLabels: Record<UserRole, { label: string; bg: string }> = {
    developer: {
      label: 'المطور التقني',
      bg: 'bg-stone-900 text-amber-300 border-stone-700 font-bold'
    },
    owner: {
      label: 'مالك المنصة',
      bg: 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
    },
    leader: {
      label: 'قائدة المقرأة',
      bg: 'bg-[#FBF1F3] text-[#8E5364] border-[#E8D5D8] font-bold'
    },
    supervisor: {
      label: 'مشرفة حلقات',
      bg: 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
    },
    teacher: {
      label: 'معلمة حلقة',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
    }
  };

  const copyTeacherCredentials = (teacher: User) => {
    const isDev =
      teacher.role === 'developer' ||
      teacher.id === 'u-dev' ||
      teacher.email?.trim().toLowerCase() === 'yr.play.com@gmail.com';
    const isCurrentDev = currentUser?.role === 'developer' || isTechnicalDeveloper(currentUser);

    if (isDev && !isCurrentDev) {
      showToast('بيانات حساب المطور التقني محمية وخاصة ولا يمكن نسخها', 'error');
      return;
    }

    const roleLabel = roleLabels[teacher.role]?.label || 'معلمة حلقة';
    const text = `بيانات حسابكِ في مقرأة غيث الغيم:
الاسم: ${teacher.name}
الصفة: ${teacher.title || roleLabel}
البريد الإلكتروني: ${teacher.email || '—'}
الرمز السري للدخول: ${teacher.passcode || 'غير محدد (يرجى مراجعة الإدارة)'}

(تستطيعين تغيير الرمز بنفسكِ في أي وقت من ملفكِ الشخصي في المقرأة)`;
    navigator.clipboard.writeText(text);
    showToast(`تم نسخ بيانات دخول ${teacher.name} لإرسالها لها`, 'success');
  };

  const getUserEffectivePermissions = (user: User): UserPermissions => {
    const defaultForRole = defaultPermissionsByRole[user.role] || defaultPermissionsByRole.teacher;
    return {
      ...defaultForRole,
      ...(user.permissions || {})
    };
  };

  const handleOpenPermissionsModal = (user: User) => {
    const isDev =
      user.role === 'developer' ||
      user.id === 'u-dev' ||
      user.email?.trim().toLowerCase() === 'yr.play.com@gmail.com';
    const isCurrentDev = currentUser?.role === 'developer' || isTechnicalDeveloper(currentUser);

    if (isDev && !isCurrentDev) {
      showToast('حساب المطور التقني محمي برمجياً ويمتلك كامل الصلاحيات ولا يمكن تعديله', 'error');
      return;
    }
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
      canAccessStaff: true,
      canManageSettings: true,
      canEditOwnWelcome: true
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
      canAccessStaff: false,
      canManageSettings: false,
      canEditOwnWelcome: false
    });
  };

  const handleResetToRoleDefault = () => {
    if (!permissionsModalUser) return;
    const defaultForRole = defaultPermissionsByRole[permissionsModalUser.role] || defaultPermissionsByRole.teacher;
    setUserPermissionsState(defaultForRole);
  };

  const handleSavePermissions = async () => {
    if (!permissionsModalUser) return;
    const nextCanEditWelcome = !!userPermissionsState.canEditOwnWelcome;
    await updateUser(permissionsModalUser.id, {
      canEditOwnWelcome: nextCanEditWelcome,
      permissions: userPermissionsState
    });
    if (settings.staffWelcomeConfigs?.[permissionsModalUser.id]) {
      await updateSettings(
        {
          staffWelcomeConfigs: {
            ...settings.staffWelcomeConfigs,
            [permissionsModalUser.id]: {
              ...settings.staffWelcomeConfigs[permissionsModalUser.id],
              canEditOwnWelcome: nextCanEditWelcome
            }
          }
        },
        true
      );
    }
    showToast(`تم حفظ وتحديث صلاحيات ${permissionsModalUser.name} بنجاح`);
    setPermissionsModalUser(null);
  };

  const isUserWelcomeSelfEditable = (user: User): boolean => {
    if (hasFullAccess(user)) return true;
    const fromConfig = settings.staffWelcomeConfigs?.[user.id]?.canEditOwnWelcome;
    if (typeof fromConfig === 'boolean') return fromConfig;
    if (typeof user.canEditOwnWelcome === 'boolean') return user.canEditOwnWelcome;
    return !!user.permissions?.canEditOwnWelcome;
  };

  const handleToggleCanEditOwnWelcome = async (user: User) => {
    const currentVal = isUserWelcomeSelfEditable(user);
    const nextVal = !currentVal;
    const currentPerms = getUserEffectivePermissions(user);
    await updateUser(
      user.id,
      {
        canEditOwnWelcome: nextVal,
        permissions: {
          ...currentPerms,
          canEditOwnWelcome: nextVal
        }
      },
      true
    );
    const existingCfg = settings.staffWelcomeConfigs?.[user.id];
    const roleBadge = roleLabels[user.role]?.label || 'معلمة حلقة';
    await updateSettings(
      {
        staffWelcomeConfigs: {
          ...(settings.staffWelcomeConfigs || {}),
          [user.id]: {
            welcomeTitle: existingCfg?.welcomeTitle || user.welcomeTitle || `مرحباً بكِ ${user.name} (${roleBadge})`,
            personalGoal: '',
            animatedEmojis: [],
            canEditOwnWelcome: nextVal,
            updatedAt: new Date().toISOString()
          }
        }
      },
      true
    );
    showToast(
      nextVal
        ? `تم منح ${user.name} صلاحية تعديل ترحيب الدخول`
        : `تم إيقاف صلاحية تعديل ترحيب الدخول لـ ${user.name}`
    );
  };

  const handleOpenStaffModal = (user?: User) => {
    if (user) {
      const isDev =
        user.role === 'developer' ||
        user.id === 'u-dev' ||
        user.email?.trim().toLowerCase() === 'yr.play.com@gmail.com';
      const isCurrentDev = currentUser?.role === 'developer' || isTechnicalDeveloper(currentUser);

      if (isDev && !isCurrentDev) {
        showToast('بيانات حساب المطور التقني محمية ومشفرة ولا يمكن تعديلها إلا من المطور نفسه', 'error');
        return;
      }

      setEditingStaff(user);
      setStaffForm({
        name: user.name,
        role: user.role,
        title: user.title,
        email: user.email || '',
        phone: user.phone || '05',
        avatarIcon: user.avatarIcon || 'mushaf',
        avatarColor: user.avatarColor || '#ad4e00',
        signatureUrl: user.signatureUrl || '',
        circleIds: user.circleIds || [],
        passcode: user.passcode || ''
      });
    } else {
      setEditingStaff(null);
      const autoGeneratedPin = Math.floor(1000 + Math.random() * 9000).toString();
      setStaffForm({
        name: '',
        role: 'teacher',
        title: 'معلمة حلقة قرآنية',
        email: '',
        phone: '05',
        avatarIcon: 'mushaf',
        avatarColor: '#ad4e00',
        signatureUrl: '',
        circleIds: [],
        passcode: autoGeneratedPin
      });
    }
    setStaffModalOpen(true);
  };

  const handleGenerateAutoPin = () => {
    const autoGeneratedPin = Math.floor(1000 + Math.random() * 9000).toString();
    setStaffForm(prev => ({ ...prev, passcode: autoGeneratedPin }));
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
      showToast('تم رفع صورة التوقيع بنجاح');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setStaffForm(prev => ({ ...prev, signatureUrl: '' }));
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      showToast('يرجى إدخال الاسم الكامل والبريد الإلكتروني', 'error');
      return;
    }
    const cleanPasscode = staffForm.passcode?.trim() || '';
    if (!cleanPasscode) {
      showToast('يرجى تحديد الرمز السري للدخول (PIN) للحساب', 'error');
      return;
    }
    if (cleanPasscode.length < 4) {
      showToast('الرمز السري للدخول يجب ألا يقل عن 4 خانات', 'error');
      return;
    }

    if (editingStaff) {
      const existingProfile = resolveStaffProfile(editingStaff, settings);
      await updateUser(editingStaff.id, {
        ...staffForm,
        passcode: cleanPasscode,
        workingHours: existingProfile.workingHours,
        monthlySalary: existingProfile.monthlySalary,
        tasks: existingProfile.tasks,
        leaderPrivateNotes: existingProfile.leaderPrivateNotes
      });
      showToast(`تم حفظ وتحديث بيانات ${staffForm.name} بنجاح`);
      setStaffModalOpen(false);
    } else {
      try {
        const created = await createUser({
          ...staffForm,
          passcode: cleanPasscode,
          workingHours: getDefaultWorkingHoursForRole(staffForm.role),
          monthlySalary: getDefaultMonthlySalaryForRole(staffForm.role),
          tasks: getDefaultTasksForUser({ id: 'new', role: staffForm.role }),
          leaderPrivateNotes: ''
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
    if (
      target.role === 'developer' ||
      target.id === 'u-dev' ||
      target.email?.trim().toLowerCase() === 'yr.play.com@gmail.com'
    ) {
      return false;
    }
    if (target.role === 'owner' || target.id === 'u-owner') {
      return curr.role === 'developer' || isTechnicalDeveloper(curr);
    }
    return hasFullAccess(curr);
  };

  const canEditTargetRole = (curr: User | null, target: User): boolean => {
    if (!curr || !target) return false;
    if (
      target.role === 'developer' ||
      target.id === 'u-dev' ||
      target.email?.trim().toLowerCase() === 'yr.play.com@gmail.com'
    ) {
      return curr.role === 'developer' || isTechnicalDeveloper(curr);
    }
    return hasFullAccess(curr);
  };

  // Summary counts for the 4 top KPI cards
  const totalStaffCount = users.length;
  const teachersCount = users.filter(u => u.role === 'teacher').length;
  const supervisorsCount = users.filter(u => u.role === 'supervisor').length;
  const approvedSignaturesCount = users.filter(u => !!u.signatureUrl).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Original Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900 font-quran">المعلمات والمشرفات</h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              إدارة الكادر والصلاحيات
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            إدارة بيانات المعلمات والمشرفات، الرموز السرية للدخول (PIN)، الصلاحيات، إسناد الحلقات، والتواقيع المعتمدة للشهادات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>الجدول الشامل</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>بطاقات الكادر</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenStaffModal()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8E5364] hover:bg-[#744251] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة معلمة جديدة</span>
          </button>
        </div>
      </div>

      {/* 2. Original 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">إجمالي الكادر المسجل</span>
            <div className="w-8 h-8 rounded-xl bg-[#FBF1F3] text-[#8E5364] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{totalStaffCount}</div>
          <div className="text-[11px] text-stone-400 mt-1">قائدة، ومشرفات، ومعلمات حلقات</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">معلمات الحلقات</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{teachersCount}</div>
          <div className="text-[11px] text-stone-400 mt-1">موزعات على المسارات المعتمدة</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">المشرفات المتابعات</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{supervisorsCount}</div>
          <div className="text-[11px] text-stone-400 mt-1">متابعة التحضير والإنجاز اليومي</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">التواقيع المعتمدة للشهادات</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <FileSignature className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{approvedSignaturesCount}</div>
          <div className="text-[11px] text-stone-400 mt-1">تظهر تلقائياً في شهادات الطالبات</div>
        </div>
      </div>

      {/* 3. Original Table ("بيانات الكادر التعليمي والإداري") or Cards View */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-[#8E5364]" />
              <h3 className="font-bold text-stone-900 text-sm">بيانات الكادر التعليمي والإداري</h3>
            </div>
            <span className="text-[11px] text-stone-400">
              إجمالي السجلات: {users.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-[#FAF7F5] border-b border-stone-200 text-stone-600">
                <tr>
                  <th className="py-3.5 px-4 font-bold">المعلمة / المشرفة</th>
                  <th className="py-3.5 px-4 font-bold">الصفة والدور</th>
                  <th className="py-3.5 px-4 font-bold">البريد الإلكتروني (اسم المستخدم)</th>
                  <th className="py-3.5 px-4 font-bold">الجوال</th>
                  <th className="py-3.5 px-4 font-bold">الرمز السري للدخول (PIN)</th>
                  <th className="py-3.5 px-4 font-bold">الحلقات المسندة</th>
                  <th className="py-3.5 px-4 font-bold text-center">التوقيع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map(user => {
                  const isDevAccount =
                    user.role === 'developer' ||
                    user.id === 'u-dev' ||
                    user.email?.trim().toLowerCase() === 'yr.play.com@gmail.com';
                  const isCurrentDev = currentUser?.role === 'developer' || isTechnicalDeveloper(currentUser);
                  const isDevProtected = isDevAccount && !isCurrentDev;

                  const assignedCircles =
                    user.role === 'supervisor'
                      ? circles.filter(c => c.supervisorId === user.id || user.circleIds?.includes(c.id))
                      : circles.filter(c => c.teacherId === user.id || user.circleIds?.includes(c.id));

                  const roleInfo = roleLabels[user.role] || roleLabels.teacher;

                  return (
                    <tr key={user.id} className="hover:bg-stone-50/70 transition">
                      {/* 1) المعلمة / المشرفة */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${user.avatarColor || '#8E5364'}15`,
                              borderColor: `${user.avatarColor || '#8E5364'}35`,
                              color: user.avatarColor || '#8E5364'
                            }}
                          >
                            {renderUserAvatarBadge(user.avatarIcon, user.avatarColor || '#8E5364', 'w-5 h-5')}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 text-xs sm:text-sm privacy-teacher-name">
                              {user.name}
                            </div>
                            <div className="text-[11px] text-stone-500 mt-0.5">
                              {user.title || roleInfo.label}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2) الصفة والدور */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] border ${roleInfo.bg}`}>
                          {roleInfo.label}
                        </span>
                      </td>

                      {/* 3) البريد الإلكتروني (اسم المستخدم) */}
                      <td className="py-3.5 px-4 font-mono text-stone-700" dir="ltr">
                        {isDevProtected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-sans text-stone-400">
                            <Lock className="w-3 h-3" />
                            <span>حساب تقني مشفر</span>
                          </span>
                        ) : (
                          user.email || '—'
                        )}
                      </td>

                      {/* 4) الجوال */}
                      <td className="py-3.5 px-4 font-mono text-stone-600 privacy-phone" dir="ltr">
                        {isDevProtected ? '—' : (user.phone || '—')}
                      </td>

                      {/* 5) الرمز السري للدخول (PIN) */}
                      <td className="py-3.5 px-4">
                        {isDevProtected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-500 border border-stone-200 text-[11px] font-bold">
                            <Lock className="w-3 h-3 text-stone-400" />
                            <span>مشفر ومحمي</span>
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold text-xs">
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              <span>{user.passcode || 'غير محدد'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => copyTeacherCredentials(user)}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition cursor-pointer"
                              title="نسخ بيانات الدخول لإرسالها للمعلمة"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 6) الحلقات المسندة */}
                      <td className="py-3.5 px-4">
                        {hasFullAccess(user) ? (
                          <span className="text-[11px] font-semibold text-stone-500">
                            جميع الحلقات والمسارات
                          </span>
                        ) : assignedCircles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedCircles.map(c => (
                              <span
                                key={c.id}
                                className="px-2 py-0.5 rounded-lg bg-stone-100 border border-stone-200 text-[10px] font-bold text-stone-700"
                              >
                                {(c.name || '').replace(/[🪴🤎]/g, '').trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-400">غير معين</span>
                        )}
                      </td>

                      {/* 7) التوقيع والإجراءات */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {user.signatureUrl ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>معتمد</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-400">غير مرفق</span>
                          )}

                          {!isDevProtected && (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenPermissionsModal(user)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                                title="تخصيص الصلاحيات"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>الصلاحيات</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenStaffModal(user)}
                                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                                title="تعديل البيانات"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>

                              {canDeleteTargetUser(currentUser, user) && (
                                <button
                                  type="button"
                                  onClick={() => setTeacherToDelete(user)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                                  title="حذف الحساب"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {users.map(user => {
            const isDevAccount =
              user.role === 'developer' ||
              user.id === 'u-dev' ||
              user.email?.trim().toLowerCase() === 'yr.play.com@gmail.com';
            const isCurrentDev = currentUser?.role === 'developer' || isTechnicalDeveloper(currentUser);
            const isDevProtected = isDevAccount && !isCurrentDev;

            const assignedCircles =
              user.role === 'supervisor'
                ? circles.filter(c => c.supervisorId === user.id || user.circleIds?.includes(c.id))
                : circles.filter(c => c.teacherId === user.id || user.circleIds?.includes(c.id));

            const roleInfo = roleLabels[user.role] || roleLabels.teacher;

            return (
              <div
                key={user.id}
                className="bg-white rounded-3xl border border-[#E8DFD8] p-5 shadow-2xs flex flex-col justify-between hover:border-[#D4C4BC] transition"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${user.avatarColor || '#8E5364'}15`,
                          borderColor: `${user.avatarColor || '#8E5364'}35`,
                          color: user.avatarColor || '#8E5364'
                        }}
                      >
                        {renderUserAvatarBadge(user.avatarIcon, user.avatarColor || '#8E5364', 'w-6 h-6')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900 text-sm sm:text-base privacy-teacher-name">
                            {user.name}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${roleInfo.bg}`}>
                            {roleInfo.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {user.title || roleInfo.label}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#FAF8F6] border border-[#EFE8E2] space-y-2 text-xs">
                    <div className="flex items-center justify-between text-stone-600">
                      <span className="inline-flex items-center gap-1.5 text-stone-500">
                        <Mail className="w-3.5 h-3.5 text-[#8E5364]" />
                        <span>البريد الإلكتروني:</span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-stone-800 truncate max-w-[180px]" dir="ltr">
                        {isDevProtected ? '🔒 حساب تقني مشفر' : (user.email || '—')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-stone-600">
                      <span className="inline-flex items-center gap-1.5 text-stone-500">
                        <Phone className="w-3.5 h-3.5 text-[#8E5364]" />
                        <span>الجوال:</span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-stone-800 privacy-phone" dir="ltr">
                        {isDevProtected ? '—' : (user.phone || '—')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#EFE8E2] flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 font-bold text-stone-700">
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        <span>الرمز السري (PIN):</span>
                      </span>
                      {isDevProtected ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-stone-100 border border-stone-200 text-[11px] font-bold text-stone-500">
                          مشفر ومحمي
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 font-mono font-bold text-xs text-amber-900">
                            {user.passcode || 'غير محدد'}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyTeacherCredentials(user)}
                            className="p-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
                            title="نسخ بيانات الدخول"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* الحلقات المسندة */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-stone-700 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#8E5364]" />
                        <span>الحلقات المسندة:</span>
                      </span>
                    </div>
                    {hasFullAccess(user) ? (
                      <div className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-[11px] font-semibold text-stone-600">
                        جميع الحلقات والمسارات
                      </div>
                    ) : assignedCircles.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedCircles.map(c => (
                          <span
                            key={c.id}
                            className="px-2.5 py-1 rounded-xl bg-stone-100 border border-stone-200 text-[11px] font-bold text-stone-700"
                          >
                            {(c.name || '').replace(/[🪴🤎]/g, '').trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-200/80 text-[11px] text-stone-400">
                        غير معين
                      </div>
                    )}
                  </div>

                  {!hasFullAccess(user) && (
                    <div className="p-3 rounded-2xl bg-[#FAF8F6] border border-[#EFE8E2] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <PenLine className="w-3.5 h-3.5 text-[#8E5364] shrink-0" />
                        <span className="text-[11px] font-bold text-stone-700">
                          صلاحية تعديل ترحيب الدخول
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleCanEditOwnWelcome(user)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                          isUserWelcomeSelfEditable(user)
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {isUserWelcomeSelfEditable(user) ? 'مفعّلة' : 'مغلقة'}
                      </button>
                    </div>
                  )}
                </div>

                {!isDevProtected && (
                  <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPermissionsModal(user)}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>الصلاحيات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenStaffModal(user)}
                      className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>

                    {canDeleteTargetUser(currentUser, user) && (
                      <button
                        type="button"
                        onClick={() => setTeacherToDelete(user)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                        title="حذف الحساب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Exact Original Edit Modal ("تعديل بيانات: {Name}") */}
      {staffModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 font-quran">
                  {editingStaff ? `تعديل بيانات: ${editingStaff.name}` : 'إضافة معلمة جديدة'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  تخصيص الصفة والمنصب، المسمى الوظيفي، البريد، والرمز السري للدخول (PIN)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              {/* Row 1: الاسم الكامل * & الصفة والمنصب * */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={staffForm.name}
                    onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="مثال: ريفة المنصوري"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white text-xs font-bold text-stone-900 focus:outline-none focus:border-[#8E5364]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">الصفة والمنصب *</label>
                  <select
                    value={staffForm.role}
                    disabled={editingStaff ? !canEditTargetRole(currentUser, editingStaff) : false}
                    onChange={e => {
                      const nextRole = e.target.value as UserRole;
                      const defaultTitle =
                        nextRole === 'owner'
                          ? 'مالك المنصة العام'
                          : nextRole === 'leader'
                          ? 'قائدة المقرأة'
                          : nextRole === 'developer'
                          ? 'المطور التقني'
                          : nextRole === 'supervisor'
                          ? 'مشرفة حلقات'
                          : 'معلمة حلقة';
                      setStaffForm({
                        ...staffForm,
                        role: nextRole,
                        title: staffForm.title || defaultTitle
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white text-xs font-bold text-stone-900 focus:outline-none focus:border-[#8E5364]"
                  >
                    <option value="owner">مالك المنصة</option>
                    <option value="leader">قائدة المقرأة</option>
                    <option value="developer">المطور التقني</option>
                    <option value="supervisor">مشرفة حلقات</option>
                    <option value="teacher">معلمة حلقة</option>
                  </select>
                  <p className="text-[10px] text-amber-700 font-semibold mt-1">
                    تعديل هذا المنصب متاح حصرياً للمطور التقني أو مالك المنصة
                  </p>
                </div>
              </div>

              {/* Row 2: المسمى الوظيفي, البريد الإلكتروني (لتسجيل الدخول) *, رقم الجوال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={staffForm.title}
                    onChange={e => setStaffForm({ ...staffForm, title: e.target.value })}
                    placeholder="مثال: مالك المنصة العام"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white text-xs text-stone-800 focus:outline-none focus:border-[#8E5364]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    البريد الإلكتروني (لتسجيل الدخول) *
                  </label>
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="reef@ghaym.org"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white font-mono text-xs text-stone-800 focus:outline-none focus:border-[#8E5364]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">رقم الجوال</label>
                  <input
                    type="text"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white font-mono text-xs text-stone-800 focus:outline-none focus:border-[#8E5364]"
                  />
                </div>
              </div>

              {/* PIN Box: الرمز السري للدخول (PIN) * with [ توليد رمز تلقائي ] */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-700" />
                    <span>الرمز السري للدخول (PIN) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAutoPin}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition cursor-pointer shadow-2xs self-start sm:self-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                    <span>توليد رمز تلقائي</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={staffForm.passcode}
                  onChange={e => setStaffForm({ ...staffForm, passcode: e.target.value })}
                  placeholder="مثال: 2005"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-white font-mono text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-amber-800">
                  تستخدم المعلمة أو المشرفة هذا الرمز السري لتسجيل الدخول المباشر إلى المنصة مع بريدها الإلكتروني أو اسمها.
                </p>
              </div>

              {/* Account Avatar/Theme Box */}
              <IslamicIconPicker
                selectedIconId={staffForm.avatarIcon}
                selectedColor={staffForm.avatarColor}
                onSelect={(iconId, color) =>
                  setStaffForm({ ...staffForm, avatarIcon: iconId, avatarColor: color })
                }
              />

              {/* Circle Assignment */}
              {staffForm.role !== 'leader' && staffForm.role !== 'owner' && staffForm.role !== 'developer' && (
                <div className="p-4 rounded-2xl bg-[#FAF8F6] border border-[#EFE8E2] space-y-2.5">
                  <label className="block text-xs font-bold text-stone-800">
                    الحلقات المسندة ({staffForm.circleIds.length} محددة):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {circles.filter(c => !c.isArchived).map(circle => {
                      const isSelected = staffForm.circleIds.includes(circle.id);
                      return (
                        <button
                          key={circle.id}
                          type="button"
                          onClick={() => handleToggleCircle(circle.id)}
                          className={`p-2.5 rounded-xl border text-right text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-[#FBF1F3] border-[#8E5364] text-[#8E5364]'
                              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          <span className="truncate">{(circle.name || '').replace(/[🪴🤎]/g, '').trim()}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#8E5364] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Signature Upload */}
              <div className="p-4 rounded-2xl bg-[#FAF8F6] border border-[#EFE8E2] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <FileSignature className="w-4 h-4 text-[#8E5364]" />
                      <span>التوقيع الرسمي المعتمد للشهادات</span>
                    </label>
                    <p className="text-[11px] text-stone-500">يظهر تلقائياً في شهادات الطالبات والتقارير الرسمية</p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 text-xs font-bold cursor-pointer transition shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>رفع صورة التوقيع</span>
                    <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                  </label>
                </div>

                {staffForm.signatureUrl && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200">
                    <img
                      src={staffForm.signatureUrl}
                      alt="معاينة التوقيع"
                      className="h-12 object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة التوقيع</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#8E5364] hover:bg-[#744251] text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingStaff ? 'حفظ التعديلات' : 'إضافة المعلمة ونسخ البيانات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Permissions Modal */}
      {permissionsModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#E8DFD8] space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    صلاحيات الوصول: {permissionsModalUser.name}
                  </h3>
                  <p className="text-xs text-stone-500">
                    تخصيص الصلاحيات الإدارية والأكاديمية الممنوحة لهذا الحساب
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPermissionsModalUser(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGrantAllPermissions}
                className="px-3 py-1.5 rounded-xl bg-[#F6EFEA] hover:bg-[#EFE3DA] text-[#7B3F30] border border-[#E5C3B3] text-xs font-bold transition cursor-pointer"
              >
                منح جميع الصلاحيات
              </button>
              <button
                type="button"
                onClick={handleResetToRoleDefault}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
              >
                الافتراضي حسب الدور
              </button>
              <button
                type="button"
                onClick={handleRevokeAllPermissions}
                className="px-3 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-500 border border-stone-200 text-xs font-bold transition cursor-pointer"
              >
                إلغاء الكل
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto p-1">
              {PERMISSION_ITEMS.map(item => {
                const IconComp = item.IconComponent;
                const enabled = !!userPermissionsState[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToggleSinglePermission(item.key)}
                    className={`p-3 rounded-2xl border text-right transition flex items-start gap-2.5 cursor-pointer ${
                      enabled
                        ? 'bg-[#F6EFEA] border-[#9A5643] text-[#7B3F30]'
                        : 'bg-[#FAF8F6] border-[#EFE8E2] text-stone-600 hover:bg-stone-100/70'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0 mt-0.5">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-stone-900">{item.title}</span>
                        {enabled && <CheckCircle2 className="w-4 h-4 text-[#9A5643] shrink-0" />}
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPermissionsModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-6 py-2.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ واعتماد الصلاحيات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {teacherToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E8DFD8] space-y-4 text-center" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900">
              تأكيد حذف حساب: {teacherToDelete.name}
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              هل أنتِ متأكدة من حذف حساب هذه العضوة من الكادر؟ سيتم إزالة الحساب من قائمة الدخول مع بقاء سجلات الطالبات محفوظة.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTeacherToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = teacherToDelete;
                  setTeacherToDelete(null);
                  await deleteUser(target.id);
                  showToast(`تم حذف حساب ${target.name}`, 'info');
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

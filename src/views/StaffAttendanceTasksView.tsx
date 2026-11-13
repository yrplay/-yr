import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  UserCheck, Clock, Wallet, ListTodo, FileText, CheckCircle2,
  AlertCircle, Trash2, PenLine, CheckSquare, Square, Calendar,
  Eye, EyeOff, Lock, Plus, X, Check, ClipboardList, ShieldCheck,
  MessageSquare, Pin, Send, BellRing, Bell, Save, RefreshCw
} from 'lucide-react';
import {
  User,
  UserRole,
  StaffTaskItem,
  StaffAttendanceStatus,
  StaffChatMessage,
  PinnedStaffAnnouncement
} from '../types';
import { renderUserAvatarBadge } from '../components/IslamicIconLibrary';
import {
  HijriDateNavigationBar,
  formatHijriDate,
  formatHijriShort,
  getTodayISO,
  getHijriParts
} from '../utils/hijriDate';
import {
  resolveStaffProfile,
  readAllStaffAttendanceRecords,
  readRawStaffAttendanceMap,
  writeLocalStaffAttendanceRecords,
  buildStaffAttendanceRecord,
  buildDeletedStaffAttendanceTombstone,
  formatCurrentArabicTime,
  getStaffShortRoleLabel,
  getStaffDropdownRoleBadge,
  getDefaultWorkingHoursForRole,
  readLocalStaffProfiles,
  writeLocalStaffProfiles,
  isFounderOrOwnerOrLeader,
  isSupervisorOrTeacherOnly,
  canEditOrDeleteStaffChat,
  readResolvedStaffChatMessages,
  writeLocalStaffChatMessages,
  readLocalDeletedStaffChatIds,
  writeLocalDeletedStaffChatIds,
  resolvePinnedStaffAnnouncement,
  writeLocalPinnedAnnouncement,
  STAFF_CHAT_TTL_MS
} from '../utils/staffHelpers';
import {
  deliverNativeOrPwaNotification,
  enableStaffNotifications,
  formatMinutesToArabicTime,
  getChatMessageSeenKey,
  getPinnedAnnouncementSeenKey,
  isStaffNotificationsEnabled,
  markMessageIdAsSeenByUser,
  markStaffChatSeenNow,
  parseShiftStartMinutes
} from '../utils/staffNotifications';

export const StaffAttendanceTasksView: React.FC = () => {
  const {
    users,
    circles,
    currentUser,
    updateUser,
    settings,
    updateSettings,
    showToast,
    isPrivacyMode,
    togglePrivacyMode,
    syncNow,
    cloudStatus
  } = useApp();

  // Both Founder ("مؤسس المنصة") and Platform Owner/Leader ("مالك المنصة" / "قائدة")
  // share identical 100% full administrative visibility and edit permissions.
  const isAdminOversight = isFounderOrOwnerOrLeader(currentUser);
  const isCurrentOperationalStaff = isSupervisorOrTeacherOnly(currentUser);

  const todayIso = getTodayISO();
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(todayIso);

  // Notification Activation & Test State
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() =>
    isStaffNotificationsEnabled()
  );

  useEffect(() => {
    const syncNotifState = () => {
      setNotificationsEnabled(isStaffNotificationsEnabled());
    };
    window.addEventListener('ghaith-staff-notifications-changed', syncNotifState);
    return () => window.removeEventListener('ghaith-staff-notifications-changed', syncNotifState);
  }, []);

  // Mark staff chat as seen when opening this view
  useEffect(() => {
    if (currentUser?.id) {
      markStaffChatSeenNow(currentUser.id, settings, users);
    }
  }, [currentUser?.id]);

  const handleActivateNotifications = async () => {
    const res = await enableStaffNotifications();
    setNotificationsEnabled(res.enabled);
    const roleSpecificMsg = isCurrentOperationalStaff
      ? 'تم تفعيل إشعارات الدوام (قبل الدوام بـ 15 دقيقة وعند بدايته) وإشعارات مساحة تواصل الكادر بنجاح'
      : 'تم تفعيل إشعارات الرسائل والتعاميم الفورية في مساحة تواصل الكادر بنجاح';

    await deliverNativeOrPwaNotification({
      title: 'تم تفعيل الإشعارات — مقرأة غيث الغيم',
      body: roleSpecificMsg,
      tag: 'ghaith-notif-enabled',
      playChime: true
    });
    showToast(roleSpecificMsg, 'success');
  };

  const handleTestNotification = async () => {
    const testBody = isCurrentOperationalStaff
      ? `تجربة إشعار ناجحة لـ ${currentUser?.name || 'عضو الكادر'} — ستصلكِ تنبيهات الدوام قبل موعده بـ 15 دقيقة ورسائل الكادر الجديدة فوراً.`
      : `تجربة إشعار ناجحة لـ ${currentUser?.name || 'إدارة المنصة'} — ستصلكِ إشعارات فورية عند إرسال أي رسالة جديدة في مساحة تواصل الكادر.`;

    await deliverNativeOrPwaNotification({
      title: 'إشعار تجريبي — مساحة تواصل وتحضير الكادر',
      body: testBody,
      tag: `ghaith-notif-test-${Date.now()}`,
      playChime: true
    });
    showToast(testBody, 'info');
  };

  // Strictly include ONLY Supervisors (مشرفة) and Teachers (معلمة)
  // Completely EXCLUDE Founders (مؤسس المنصة) and Platform Owners/Leaders (مالك المنصة / قائدة)
  const operationalStaffMembers = users.filter(u => isSupervisorOrTeacherOnly(u));

  const allAttendanceRecords = readAllStaffAttendanceRecords(settings);
  const selfTodayRecord =
    isCurrentOperationalStaff && currentUser
      ? allAttendanceRecords[`${currentUser.id}_${todayIso}`]
      : undefined;
  const selfResolvedProfile =
    isCurrentOperationalStaff && currentUser
      ? resolveStaffProfile(currentUser, settings)
      : null;

  const [showSelfExcuseForm, setShowSelfExcuseForm] = useState(false);
  const [selfExcuseText, setSelfExcuseText] = useState('');

  // Founder/Owner Attendance Override Modal State
  const [editingAttendanceTarget, setEditingAttendanceTarget] = useState<{
    user: User;
    dateIso: string;
    status: StaffAttendanceStatus;
    checkInTime: string;
    excuseText: string;
  } | null>(null);

  // Inline Editing States on Staff Operation Cards (Working Hours, Manual Salary, Tasks, Private Notes)
  const [hoursDrafts, setHoursDrafts] = useState<Record<string, string>>({});
  const [focusedHoursUserId, setFocusedHoursUserId] = useState<string | null>(null);
  const [savingHoursUserId, setSavingHoursUserId] = useState<string | null>(null);
  const hoursInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  const [editingSalaryUserId, setEditingSalaryUserId] = useState<string | null>(null);
  const [salaryDraft, setSalaryDraft] = useState<string>('');

  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});
  const [editingTaskKey, setEditingTaskKey] = useState<{ userId: string; taskId: string } | null>(null);
  const [editingTaskText, setEditingTaskText] = useState<string>('');

  const [editingNotesUserId, setEditingNotesUserId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');

  // =========================================================================
  // 24-Hour Staff Group Chat ("مساحة تواصل الكادر") State & Exclusive Controls
  // =========================================================================
  const canModerateStaffChat = canEditOrDeleteStaffChat(currentUser);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [chatInputText, setChatInputText] = useState<string>('');
  const [editingChatMsgId, setEditingChatMsgId] = useState<string | null>(null);
  const [editingChatMsgText, setEditingChatMsgText] = useState<string>('');

  const [isEditingPinnedAnnouncement, setIsEditingPinnedAnnouncement] = useState<boolean>(false);
  const [pinnedAnnouncementDraft, setPinnedAnnouncementDraft] = useState<string>('');
  const chatListEndRef = useRef<HTMLDivElement | null>(null);

  const activeChatMessages: StaffChatMessage[] = readResolvedStaffChatMessages(settings, nowTick, users);
  const pinnedAnnouncement: PinnedStaffAnnouncement = resolvePinnedStaffAnnouncement(settings, users);

  const syncChatPayloadToCentralUser = async (payload: {
    staffChatMessages?: StaffChatMessage[];
    deletedStaffChatIds?: string[];
    pinnedStaffAnnouncement?: PinnedStaffAnnouncement;
  }) => {
    const carrierUser =
      users.find(u => u.id === 'user-owner' || u.role === 'owner') ||
      users.find(u => u.id === 'user-leader' || u.role === 'leader') ||
      currentUser;
    if (carrierUser) {
      await updateUser(
        carrierUser.id,
        {
          ...(payload.staffChatMessages !== undefined ? { staffChatMessages: payload.staffChatMessages } : {}),
          ...(payload.deletedStaffChatIds !== undefined ? { deletedStaffChatIds: payload.deletedStaffChatIds } : {}),
          ...(payload.pinnedStaffAnnouncement !== undefined
            ? { pinnedStaffAnnouncement: payload.pinnedStaffAnnouncement }
            : {})
        },
        true
      );
    }
  };

  // Auto-prune expired messages (> 24 hours) periodically and sync with cloud
  useEffect(() => {
    const pruneExpiredMessages = () => {
      const currentNow = Date.now();
      setNowTick(currentNow);
      const rawSettingsMsgs = Array.isArray(settings?.staffChatMessages) ? settings.staffChatMessages : [];
      if (rawSettingsMsgs.length > 0) {
        const validMsgs = readResolvedStaffChatMessages(settings, currentNow, users);
        if (validMsgs.length < rawSettingsMsgs.length) {
          writeLocalStaffChatMessages(validMsgs);
          void updateSettings({ staffChatMessages: validMsgs }, true);
        }
      }
    };

    pruneExpiredMessages();
    const timer = setInterval(pruneExpiredMessages, 60000);
    return () => clearInterval(timer);
  }, [settings?.staffChatMessages]);

  const handleSendStaffChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = chatInputText.trim();
    if (!cleanText) return;

    const sender = currentUser || users[0];
    const nowMs = Date.now();
    const newMsg: StaffChatMessage = {
      id: `schat-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: sender?.id || 'staff',
      senderName: sender?.name || 'عضو الكادر',
      senderRole: sender?.role || 'teacher',
      senderTitle: getStaffDropdownRoleBadge(sender),
      text: cleanText,
      createdAt: nowMs,
      createdAtIso: new Date(nowMs).toISOString(),
      hijriTimeLabel: formatCurrentArabicTime(new Date(nowMs))
    };

    if (sender?.id) {
      markMessageIdAsSeenByUser(sender.id, getChatMessageSeenKey(newMsg));
    }

    const currentValid = readResolvedStaffChatMessages(settings, nowMs, users);
    const nextMessages = [...currentValid, newMsg];
    writeLocalStaffChatMessages(nextMessages);
    setChatInputText('');
    setNowTick(nowMs);
    if (sender?.id) {
      markStaffChatSeenNow(sender.id, { ...settings, staffChatMessages: nextMessages }, users);
    }
    await syncChatPayloadToCentralUser({ staffChatMessages: nextMessages });
    await updateSettings({ staffChatMessages: nextMessages }, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghaith-staff-sync'));
    }
    setTimeout(() => {
      chatListEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  };

  const handleSaveEditedChatMessage = async (msgId: string) => {
    if (!canModerateStaffChat) return;
    const cleanText = editingChatMsgText.trim();
    if (!cleanText) {
      showToast('لا يمكن حفظ رسالة فارغة', 'error');
      return;
    }
    const nowMs = Date.now();
    const currentValid = readResolvedStaffChatMessages(settings, nowMs, users);
    const nextMessages = currentValid.map(m =>
      m.id === msgId
        ? {
            ...m,
            text: cleanText,
            editedAt: nowMs,
            editedBy: currentUser?.name || 'إدارة المنصة'
          }
        : m
    );
    const updatedTarget = nextMessages.find(m => m.id === msgId);
    if (currentUser?.id && updatedTarget) {
      markMessageIdAsSeenByUser(currentUser.id, getChatMessageSeenKey(updatedTarget));
    }
    writeLocalStaffChatMessages(nextMessages);
    setEditingChatMsgId(null);
    setEditingChatMsgText('');
    setNowTick(nowMs);
    if (currentUser?.id) {
      markStaffChatSeenNow(currentUser.id, { ...settings, staffChatMessages: nextMessages }, users);
    }
    await syncChatPayloadToCentralUser({ staffChatMessages: nextMessages });
    await updateSettings({ staffChatMessages: nextMessages }, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghaith-staff-sync'));
    }
    showToast('تم تعديل الرسالة ومزامنتها فوراً', 'success');
  };

  const handleDeleteChatMessage = async (msgId: string) => {
    if (!canModerateStaffChat) return;
    const nowMs = Date.now();
    const currentDeleted = [
      ...new Set([
        ...readLocalDeletedStaffChatIds(),
        ...(Array.isArray(settings?.deletedStaffChatIds) ? settings.deletedStaffChatIds : []),
        msgId
      ])
    ];
    writeLocalDeletedStaffChatIds(currentDeleted);

    const nextMessages = readResolvedStaffChatMessages(settings, nowMs, users).filter(m => m.id !== msgId);
    writeLocalStaffChatMessages(nextMessages);
    setNowTick(nowMs);
    await syncChatPayloadToCentralUser({
      staffChatMessages: nextMessages,
      deletedStaffChatIds: currentDeleted
    });
    await updateSettings(
      {
        staffChatMessages: nextMessages,
        deletedStaffChatIds: currentDeleted
      },
      true
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghaith-staff-sync'));
    }
    showToast('تم حذف الرسالة من مساحة تواصل الكادر', 'info');
  };

  const handleSavePinnedAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModerateStaffChat) return;
    const cleanText = pinnedAnnouncementDraft.trim();
    const updatedAt = Date.now();
    const nextPinned: PinnedStaffAnnouncement = {
      text: cleanText,
      updatedAt,
      updatedBy: currentUser?.name || 'إدارة المنصة'
    };
    if (currentUser?.id) {
      markMessageIdAsSeenByUser(currentUser.id, getPinnedAnnouncementSeenKey(nextPinned));
    }
    writeLocalPinnedAnnouncement(nextPinned);
    setIsEditingPinnedAnnouncement(false);
    if (currentUser?.id) {
      markStaffChatSeenNow(currentUser.id, { ...settings, pinnedStaffAnnouncement: nextPinned }, users);
    }
    await syncChatPayloadToCentralUser({ pinnedStaffAnnouncement: nextPinned });
    await updateSettings({ pinnedStaffAnnouncement: nextPinned }, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghaith-staff-sync'));
    }
    showToast(cleanText ? 'تم تحديث التعميم الإداري المثبت بنجاح' : 'تم مسح التعميم الإداري المثبت', 'success');
  };

  const handleDeletePinnedAnnouncement = async () => {
    if (!canModerateStaffChat) return;
    const clearedPinned: PinnedStaffAnnouncement = {
      text: '',
      updatedAt: Date.now(),
      updatedBy: currentUser?.name || 'إدارة المنصة'
    };
    writeLocalPinnedAnnouncement(clearedPinned);
    setIsEditingPinnedAnnouncement(false);
    setPinnedAnnouncementDraft('');
    await syncChatPayloadToCentralUser({ pinnedStaffAnnouncement: clearedPinned });
    await updateSettings({ pinnedStaffAnnouncement: clearedPinned }, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghaith-staff-sync'));
    }
    showToast('تم حذف التعميم الإداري المثبت', 'info');
  };

  const formatRemaining24hLabel = (createdAtMs: number): string => {
    const elapsedMs = Math.max(0, nowTick - createdAtMs);
    const remainingMs = Math.max(0, STAFF_CHAT_TTL_MS - elapsedMs);
    const totalMinutes = Math.ceil(remainingMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `تُحذف بعد ${hours} س${minutes > 0 ? ` و${minutes} د` : ''}`;
    }
    return `تُحذف بعد ${ Math.max(1, minutes) } د`;
  };

  const roleBadgeStyles: Record<UserRole, string> = {
    developer: 'bg-[#F6EFEA] text-[#7B3F30] border-[#E5C3B3]',
    owner: 'bg-[#F6EFEA] text-[#7B3F30] border-[#E5C3B3]',
    leader: 'bg-[#F6EFEA] text-[#7B3F30] border-[#E5C3B3]',
    supervisor: 'bg-[#FDF6F2] text-[#9A5643] border-[#E5C3B3]',
    teacher: 'bg-[#EBF3EE] text-[#2D5A43] border-[#C5DEC9]'
  };

  // Persist Staff Profile Operations (Working Hours, Manual Salary, Tasks, Private Notes)
  const saveStaffProfileFields = async (
    targetUser: User,
    updates: Partial<{
      workingHours: string;
      monthlySalary: number;
      tasks: StaffTaskItem[];
      leaderPrivateNotes: string;
    }>,
    toastMessage?: string
  ) => {
    const currentResolved = resolveStaffProfile(targetUser, settings);
    const nowIso = new Date().toISOString();
    const mergedProfile = {
      workingHours: updates.workingHours !== undefined ? updates.workingHours : currentResolved.workingHours,
      monthlySalary: updates.monthlySalary !== undefined ? updates.monthlySalary : currentResolved.monthlySalary,
      tasks: updates.tasks !== undefined ? updates.tasks : currentResolved.tasks,
      leaderPrivateNotes:
        updates.leaderPrivateNotes !== undefined ? updates.leaderPrivateNotes : currentResolved.leaderPrivateNotes,
      updatedAt: nowIso
    };

    const localProfiles = readLocalStaffProfiles();
    const updatedProfilesMap = {
      ...(settings.staffProfiles || {}),
      ...(settings.staffOperations || {}),
      ...localProfiles,
      [targetUser.id]: mergedProfile
    };
    writeLocalStaffProfiles(updatedProfilesMap);

    await updateUser(
      targetUser.id,
      {
        workingHours: mergedProfile.workingHours,
        monthlySalary: mergedProfile.monthlySalary,
        tasks: mergedProfile.tasks,
        leaderPrivateNotes: mergedProfile.leaderPrivateNotes
      },
      true
    );

    await updateSettings(
      {
        staffProfiles: updatedProfilesMap,
        staffOperations: updatedProfilesMap
      },
      true
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghaith-staff-sync'));
    }

    if (toastMessage) {
      showToast(toastMessage, 'success');
    }
  };

  // Dedicated Working Hours Save Handler (persists immediately to cloud + broadcasts + shows toast)
  const handleSaveStaffWorkingHours = async (
    targetUser: User,
    rawValue?: string,
    onlyIfChanged: boolean = false
  ) => {
    const currentResolved = resolveStaffProfile(targetUser, settings);
    const candidate =
      (rawValue !== undefined ? rawValue : hoursDrafts[targetUser.id] ?? currentResolved.workingHours).trim() ||
      getDefaultWorkingHoursForRole(targetUser.role);

    if (onlyIfChanged && candidate === currentResolved.workingHours.trim()) {
      return;
    }

    setSavingHoursUserId(targetUser.id);
    setHoursDrafts(prev => ({
      ...prev,
      [targetUser.id]: candidate
    }));

    try {
      await saveStaffProfileFields(
        targetUser,
        { workingHours: candidate },
        'تم حفظ وتحديث ساعات الدوام سحابياً'
      );
    } finally {
      setSavingHoursUserId(null);
    }
  };

  const handleManualCloudRefresh = async () => {
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await syncNow();
      setNowTick(Date.now());
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ghaith-staff-sync'));
      }
      showToast('تم تحديث الرسائل وساعات الدوام من السحابة الفورية', 'info');
    } finally {
      setTimeout(() => setIsManualSyncing(false), 600);
    }
  };

  // Daily Self Check-In Handlers for Supervisors & Teachers ONLY (Restricted strictly to Today's Hijri Date)
  const handleSelfCheckInPresent = async () => {
    if (!currentUser || !isCurrentOperationalStaff) return;
    const nowTime = formatCurrentArabicTime();
    const record = buildStaffAttendanceRecord({
      user: currentUser,
      dateIso: todayIso,
      status: 'present',
      checkInTime: nowTime,
      excuseText: '',
      recordedBy: currentUser.name
    });
    const nextRecords = {
      ...readRawStaffAttendanceMap(settings),
      [record.id]: record
    };
    writeLocalStaffAttendanceRecords(nextRecords);
    setShowSelfExcuseForm(false);
    await updateSettings({ staffAttendanceRecords: nextRecords }, true);
    showToast(`تم تسجيل حضوركِ لليوم (${nowTime}) بنجاح`, 'success');
  };

  const handleSelfCheckInExcused = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isCurrentOperationalStaff) return;
    const cleanExcuse = selfExcuseText.trim();
    if (!cleanExcuse) {
      showToast('يرجى كتابة عذر الغياب وتفاصيله قبل الحفظ', 'error');
      return;
    }
    const record = buildStaffAttendanceRecord({
      user: currentUser,
      dateIso: todayIso,
      status: 'absent_excused',
      checkInTime: formatCurrentArabicTime(),
      excuseText: cleanExcuse,
      recordedBy: currentUser.name
    });
    const nextRecords = {
      ...readRawStaffAttendanceMap(settings),
      [record.id]: record
    };
    writeLocalStaffAttendanceRecords(nextRecords);
    setShowSelfExcuseForm(false);
    setSelfExcuseText('');
    await updateSettings({ staffAttendanceRecords: nextRecords }, true);
    showToast('تم تسجيل الغياب بعذر لليوم بنجاح', 'success');
  };

  // Founder/Owner Attendance Override Handlers (Any Hijri Date)
  const handleAdminQuickStatusChange = async (
    targetUser: User,
    dateIso: string,
    status: StaffAttendanceStatus
  ) => {
    if (!isAdminOversight) return;
    const existing = allAttendanceRecords[`${targetUser.id}_${dateIso}`];
    if (status === 'absent_excused' && !existing?.excuseText) {
      setEditingAttendanceTarget({
        user: targetUser,
        dateIso,
        status: 'absent_excused',
        checkInTime: existing?.checkInTime || formatCurrentArabicTime(),
        excuseText: existing?.excuseText || ''
      });
      return;
    }
    const record = buildStaffAttendanceRecord({
      user: targetUser,
      dateIso,
      status,
      checkInTime: status === 'present' ? (existing?.checkInTime || formatCurrentArabicTime()) : '',
      excuseText: status === 'absent_excused' ? (existing?.excuseText || '') : '',
      recordedBy: currentUser?.name || 'إدارة المنصة'
    });
    const nextRecords = {
      ...readRawStaffAttendanceMap(settings),
      [record.id]: record
    };
    writeLocalStaffAttendanceRecords(nextRecords);
    await updateSettings({ staffAttendanceRecords: nextRecords }, true);
    const statusAr =
      status === 'present' ? 'حاضرة' : status === 'absent_excused' ? 'غياب بعذر' : 'غياب بدون عذر';
    showToast(`تم تحديث حالة ${targetUser.name} إلى (${statusAr})`, 'success');
  };

  // Delete / Clear Attendance Record for a specific Hijri date (Reefa & Omar ONLY)
  const handleAdminDeleteAttendanceRecord = async (targetUser: User, dateIso: string) => {
    if (!isAdminOversight) return;
    const tombstone = buildDeletedStaffAttendanceTombstone({
      user: targetUser,
      dateIso,
      recordedBy: currentUser?.name || 'إدارة المنصة'
    });
    const nextRecords = {
      ...readRawStaffAttendanceMap(settings),
      [tombstone.id]: tombstone
    };
    writeLocalStaffAttendanceRecords(nextRecords);
    if (
      editingAttendanceTarget &&
      editingAttendanceTarget.user.id === targetUser.id &&
      editingAttendanceTarget.dateIso === dateIso
    ) {
      setEditingAttendanceTarget(null);
    }
    await updateSettings({ staffAttendanceRecords: nextRecords }, true);
    showToast(`تم حذف سجل الحضور والغياب لـ ${targetUser.name} وإعادته إلى (لم يُسجّل)`, 'info');
  };

  const handleSaveAdminAttendanceOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendanceTarget || !isAdminOversight) return;
    const { user, dateIso, status, checkInTime, excuseText } = editingAttendanceTarget;
    if (status === 'absent_excused' && !excuseText.trim()) {
      showToast('يرجى كتابة عذر الغياب وتفاصيله', 'error');
      return;
    }
    const record = buildStaffAttendanceRecord({
      user,
      dateIso,
      status,
      checkInTime: status === 'present' ? (checkInTime.trim() || formatCurrentArabicTime()) : checkInTime.trim(),
      excuseText: excuseText.trim(),
      recordedBy: currentUser?.name || 'إدارة المنصة'
    });
    const nextRecords = {
      ...readRawStaffAttendanceMap(settings),
      [record.id]: record
    };
    writeLocalStaffAttendanceRecords(nextRecords);
    setEditingAttendanceTarget(null);
    await updateSettings({ staffAttendanceRecords: nextRecords }, true);
    showToast(`تم اعتماد سجل التحضير لـ ${user.name} بنجاح`, 'success');
  };

  // Tasks Manipulation Handlers
  const handleToggleTaskCheckbox = async (targetUser: User, taskId: string) => {
    const profile = resolveStaffProfile(targetUser, settings);
    const nextTasks = profile.tasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            completed: !t.completed,
            completedAt: !t.completed ? new Date().toISOString() : undefined
          }
        : t
    );
    await saveStaffProfileFields(targetUser, { tasks: nextTasks });
  };

  const handleAddTaskToUser = async (targetUser: User) => {
    if (!isAdminOversight) return;
    const draft = (newTaskInputs[targetUser.id] || '').trim();
    if (!draft) {
      showToast('يرجى كتابة نص المهمة أولاً', 'error');
      return;
    }
    const profile = resolveStaffProfile(targetUser, settings);
    const newTask: StaffTaskItem = {
      id: `task-${targetUser.id}-${Date.now()}`,
      title: draft,
      completed: false,
      createdAt: new Date().toISOString()
    };
    const nextTasks = [...profile.tasks, newTask];
    setNewTaskInputs(prev => ({ ...prev, [targetUser.id]: '' }));
    await saveStaffProfileFields(targetUser, { tasks: nextTasks }, `تمت إضافة المهمة لـ ${targetUser.name}`);
  };

  const handleSaveEditedTaskText = async (targetUser: User, taskId: string) => {
    if (!isAdminOversight) return;
    const clean = editingTaskText.trim();
    if (!clean) {
      showToast('لا يمكن ترك نص المهمة فارغاً', 'error');
      return;
    }
    const profile = resolveStaffProfile(targetUser, settings);
    const nextTasks = profile.tasks.map(t => (t.id === taskId ? { ...t, title: clean } : t));
    setEditingTaskKey(null);
    setEditingTaskText('');
    await saveStaffProfileFields(targetUser, { tasks: nextTasks }, 'تم تحديث نص المهمة بنجاح');
  };

  const handleDeleteTaskFromUser = async (targetUser: User, taskId: string) => {
    if (!isAdminOversight) return;
    const profile = resolveStaffProfile(targetUser, settings);
    const nextTasks = profile.tasks.filter(t => t.id !== taskId);
    await saveStaffProfileFields(targetUser, { tasks: nextTasks }, 'تم حذف المهمة');
  };

  const effectiveAttendanceDate = isAdminOversight ? selectedAttendanceDate : todayIso;
  const selectedHijriParts = getHijriParts(effectiveAttendanceDate);

  const getStaffMonthlySummary = (userId: string) => {
    let presentDays = 0;
    let excusedDays = 0;
    let unexcusedDays = 0;

    for (const rec of Object.values(allAttendanceRecords)) {
      if (!rec || rec.userId !== userId || !rec.date) continue;
      const parts = getHijriParts(rec.date);
      if (parts.monthKey === selectedHijriParts.monthKey) {
        if (rec.status === 'present') presentDays++;
        else if (rec.status === 'absent_excused') excusedDays++;
        else if (rec.status === 'absent_unexcused') unexcusedDays++;
      }
    }
    return { presentDays, excusedDays, unexcusedDays };
  };

  // Displayed rows & cards:
  // - Founder / Platform Owner / Leader sees ALL Supervisors (مشرفة) and Teachers (معلمة) ONLY.
  // - A logged-in Supervisor or Teacher sees her own record/card ONLY.
  const displayedStaffList = isAdminOversight
    ? operationalStaffMembers
    : isCurrentOperationalStaff && currentUser
    ? [currentUser]
    : operationalStaffMembers;

  const renderNotificationControlBar = () => {
    return (
      <div className="flex flex-col items-start lg:items-end gap-1.5">
        {!notificationsEnabled ? (
          <button
            type="button"
            onClick={handleActivateNotifications}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
          >
            <BellRing className="w-3.5 h-3.5 shrink-0" />
            <span>تفعيل إشعارات الدوام والرسائل</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F3] text-[#7B3F30] border border-[#E5C3B3] text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
              <span>الإشعارات مفعّلة</span>
            </span>
            <button
              type="button"
              onClick={handleTestNotification}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F6EFEA] text-[#9A5643] border border-[#E8E2DC] text-[11px] font-bold transition cursor-pointer active:scale-95"
              title="إرسال إشعار تجريبي فوري للتأكد من عمل التنبيهات على جهازك"
            >
              <Bell className="w-3 h-3 shrink-0" />
              <span>تجربة إشعار</span>
            </button>
          </div>
        )}
        <p className="text-[10px] text-stone-500 flex items-center gap-1 leading-relaxed">
          <BellRing className="w-3 h-3 text-[#9A5643] shrink-0" />
          <span>
            لضمان وصول الإشعارات على الجوال، فعّلي الزر من جهازكِ (وفي الآيفون أضيفي المنصة للشاشة الرئيسية أولاً).
          </span>
        </p>
      </div>
    );
  };

  const renderCloudSyncControlBar = () => {
    const isSyncingNow = isManualSyncing || cloudStatus === 'syncing';
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F3] text-[#7B3F30] border border-[#E5C3B3] text-xs font-bold">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
          <span>محدّث سحابياً</span>
        </span>
        <button
          type="button"
          onClick={handleManualCloudRefresh}
          disabled={isSyncingNow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F6EFEA] text-[#9A5643] border border-[#E8E2DC] text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-70"
          title="تحديث فوري للرسائل وساعات الدوام والتحضير من السحابة"
        >
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncingNow ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>
    );
  };

  const parsedSelfShiftStartMins = selfResolvedProfile
    ? parseShiftStartMinutes(selfResolvedProfile.workingHours)
    : null;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-stone-900 font-quran">
                تحضير ومهام الكادر
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-[#F6EFEA] text-[#7B3F30] font-bold border border-[#E5C3B3]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
                <span>
                  {isAdminOversight
                    ? 'إشراف كامل على تحضير ومهام ودوام ورواتب المشرفات والمعلمات'
                    : 'واجهة التحضير اليومي الذاتي والمهام المسندة'}
                </span>
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {isAdminOversight
                ? 'مخصص للمشرفات والمعلمات — تصلكِ إشعارات فورية عند إرسال رسائل جديدة في مساحة تواصل الكادر دون إشعارات تحضير الدوام'
                : 'مخصص للمشرفات والمعلمات — تنبيه ذكي قبل الدوام بـ 15 دقيقة وعند بدايته، وإشعارات فورية لرسائل وتعاميم مساحة تواصل الكادر'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-start lg:items-center gap-2.5 self-start lg:self-auto">
          {renderCloudSyncControlBar()}
          {renderNotificationControlBar()}

          <button
            type="button"
            onClick={togglePrivacyMode}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              isPrivacyMode
                ? 'bg-[#9A5643] text-white border-[#7B3F30]'
                : 'bg-[#F6EFEA] text-[#7B3F30] border-[#E5C3B3] hover:bg-[#EFE3DA]'
            }`}
            title="تفعيل أو إيقاف تمويه الرواتب الشهرية والبيانات الحساسة"
          >
            {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{isPrivacyMode ? 'إظهار الرواتب' : 'تمويه الرواتب'}</span>
          </button>
        </div>
      </div>

      {/* Role-Based Top Shift Banner — Strictly for Supervisors (مشرفة حلقات) & Teachers (معلمة حلقة) ONLY.
          Never shown for Platform Owner (ريفة المنصوري) or Founder (أ. عمر عبدالرحمن). */}
      {!isAdminOversight && isCurrentOperationalStaff && currentUser && selfResolvedProfile && (
        <div className="bg-white rounded-3xl border border-[#E5C3B3] p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-stone-900">
                  ساعات الدوام المجدولة لليوم ({formatHijriDate(todayIso, { includeWeekday: true })}):
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-[#FAF6F3] text-[#7B3F30] border border-[#E5C3B3] text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
                  <span>{selfResolvedProfile.workingHours}</span>
                </span>
                {parsedSelfShiftStartMins !== null && (
                  <span className="text-[11px] font-semibold text-[#9A5643] bg-[#F6EFEA] px-2.5 py-0.5 rounded-md border border-[#E5C3B3]">
                    بداية الدوام: {formatMinutesToArabicTime(parsedSelfShiftStartMins)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
                <span>
                  يتم إرسال تنبيه صوتي وإشعار للجهاز قبل موعد دوامكِ بـ 15 دقيقة وتذكير ثانٍ عند بداية الدوام إذا لم يُسجّل الحضور
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0">
            {!selfTodayRecord ? (
              <button
                type="button"
                onClick={handleSelfCheckInPresent}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>تسجيل حضور اليوم</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EBF3EE] text-[#2D5A43] border border-[#C5DEC9] text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {selfTodayRecord.status === 'present'
                    ? `تم تسجيل حضور اليوم (${selfTodayRecord.checkInTime || 'حاضرة'})`
                    : 'تم تسجيل حالة اليوم'}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOP SECTION: 24-HOUR STAFF GROUP CHAT ("مساحة تواصل الكادر")
          Always visible and usable for ALL roles (Reefa, Omar, Supervisors, Teachers).
          Exclusive Edit & Delete (<PenLine /> & <Trash2 />) for Reefa & Omar ONLY.
         ===================================================================== */}
      <div id="staff-chat-section" className="bg-white rounded-3xl border border-[#E8E2DC] shadow-2xs overflow-hidden scroll-mt-20">
        {/* Chat Card Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#E8E2DC] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-stone-900 font-quran">
                  مساحة تواصل الكادر
                </h3>
                <span className="text-[11px] font-bold text-[#7B3F30] bg-[#FAF6F3] border border-[#E8E2DC] px-2.5 py-0.5 rounded-lg">
                  {activeChatMessages.length} رسالة نشطة
                </span>
              </div>
              <p className="text-xs text-[#9A5643] font-medium mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
                <span>الرسائل في هذه المساحة مؤقتة وتُحذف تلقائياً بعد مرور 24 ساعة</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {renderCloudSyncControlBar()}
            {renderNotificationControlBar()}

            {/* Add / Edit Pinned Announcement quick trigger for Reefa & Omar if announcement was deleted */}
            {canModerateStaffChat && !pinnedAnnouncement.text && !isEditingPinnedAnnouncement && (
              <button
                type="button"
                onClick={() => {
                  setPinnedAnnouncementDraft('');
                  setIsEditingPinnedAnnouncement(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F3] hover:bg-[#F3EAE3] text-[#7B3F30] border border-[#E8E2DC] text-xs font-bold transition cursor-pointer"
              >
                <Pin className="w-3.5 h-3.5 text-[#9A5643]" />
                <span>إضافة تعميم إداري مثبت</span>
              </button>
            )}
          </div>
        </div>

        {/* Pinned Administrative Announcement ("تعميم إداري مثبت") */}
        {(pinnedAnnouncement.text || isEditingPinnedAnnouncement) && (
          <div className="px-4 sm:px-5 py-3.5 bg-[#FAF6F3] border-b border-[#E8E2DC]">
            {isEditingPinnedAnnouncement && canModerateStaffChat ? (
              <form onSubmit={handleSavePinnedAnnouncement} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7B3F30]">
                    <Pin className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
                    <span>تعديل التعميم الإداري المثبت:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingPinnedAnnouncement(false)}
                    className="p-1 text-stone-400 hover:text-stone-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={pinnedAnnouncementDraft}
                    onChange={e => setPinnedAnnouncementDraft(e.target.value)}
                    placeholder="اكتبي نص التعميم الإداري المثبت لجميع المعلمات والمشرفات..."
                    className="flex-1 px-3.5 py-2 bg-white border border-[#E8E2DC] rounded-xl text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9A5643]"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>حفظ التعميم</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPinnedAnnouncement(false)}
                      className="px-3 py-2 rounded-xl bg-white border border-[#E8E2DC] text-stone-600 text-xs font-semibold hover:bg-stone-50 transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-white border border-[#E8E2DC] text-[#9A5643] flex items-center justify-center shrink-0 mt-0.5">
                    <Pin className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-[#7B3F30]">
                        تعميم إداري مثبت
                      </span>
                      {pinnedAnnouncement.updatedBy && (
                        <span className="text-[10px] text-stone-500">
                          • بواسطة: {pinnedAnnouncement.updatedBy}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-stone-800 mt-0.5 leading-relaxed break-words">
                      {pinnedAnnouncement.text}
                    </p>
                  </div>
                </div>

                {/* Exclusive Edit & Delete on Pinned Announcement for Reefa & Omar ONLY */}
                {canModerateStaffChat && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPinnedAnnouncementDraft(pinnedAnnouncement.text);
                        setIsEditingPinnedAnnouncement(true);
                      }}
                      title="تعديل التعميم الإداري المثبت"
                      aria-label="تعديل التعميم الإداري المثبت"
                      className="p-1.5 rounded-lg bg-white hover:bg-[#F6EFEA] text-[#9A5643] border border-[#E8E2DC] transition cursor-pointer"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePinnedAnnouncement}
                      title="حذف التعميم الإداري المثبت"
                      aria-label="حذف التعميم الإداري المثبت"
                      className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-[#E8E2DC] transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Messages Feed (24-Hour Active Messages) */}
        <div className="p-4 sm:p-5 bg-[#FAF8F6]/60 max-h-80 overflow-y-auto space-y-3">
          {activeChatMessages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8E2DC] p-6 text-center space-y-1.5">
              <div className="w-9 h-9 rounded-2xl bg-[#FAF6F3] border border-[#E8E2DC] text-[#9A5643] flex items-center justify-center mx-auto">
                <MessageSquare className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-stone-700">
                لا توجد رسائل خلال الـ 24 ساعة الماضية
              </p>
              <p className="text-[11px] text-stone-500">
                اكتبي رسالتكِ أدناه للتواصل المباشر مع إدارة المقرأة والمشرفات والمعلمات
              </p>
            </div>
          ) : (
            activeChatMessages.map(msg => {
              const isOwnMsg = currentUser?.id === msg.senderId || currentUser?.name === msg.senderName;
              const isEditingThisMsg = editingChatMsgId === msg.id && canModerateStaffChat;
              const isSenderLeaderOrOwner =
                msg.senderRole === 'owner' || msg.senderRole === 'leader' || msg.senderRole === 'developer';

              return (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-2xl bg-white border transition ${
                    isOwnMsg
                      ? 'border-[#D4B8A8] shadow-2xs'
                      : 'border-[#E8E2DC]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-stone-900">
                        {msg.senderName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          isSenderLeaderOrOwner
                            ? 'bg-[#F6EFEA] text-[#7B3F30] border-[#E5C3B3]'
                            : msg.senderRole === 'supervisor'
                            ? 'bg-[#FDF6F2] text-[#9A5643] border-[#E5C3B3]'
                            : 'bg-[#EBF3EE] text-[#2D5A43] border-[#C5DEC9]'
                        }`}
                      >
                        {msg.senderTitle || getStaffShortRoleLabel(msg.senderRole)}
                      </span>
                      <span className="text-[11px] text-stone-400 font-mono">
                        {msg.hijriTimeLabel || formatCurrentArabicTime(new Date(msg.createdAt))}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#9A5643] bg-[#FAF6F3] px-2 py-0.5 rounded-md border border-[#E8E2DC]">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span>{formatRemaining24hLabel(msg.createdAt)}</span>
                      </span>
                      {msg.editedAt && (
                        <span className="text-[10px] text-stone-400">
                          (معدّلة)
                        </span>
                      )}
                    </div>

                    {/* Exclusive Edit & Delete Icons on Messages for Reefa & Omar ONLY */}
                    {canModerateStaffChat && !isEditingThisMsg && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChatMsgId(msg.id);
                            setEditingChatMsgText(msg.text);
                          }}
                          title="تعديل نص الرسالة"
                          aria-label="تعديل نص الرسالة"
                          className="p-1.5 rounded-lg bg-[#FAF6F3] hover:bg-[#F3EAE3] text-[#9A5643] border border-[#E8E2DC] transition cursor-pointer"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChatMessage(msg.id)}
                          title="حذف الرسالة"
                          aria-label="حذف الرسالة"
                          className="p-1.5 rounded-lg bg-[#FAF6F3] hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-[#E8E2DC] transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditingThisMsg ? (
                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={editingChatMsgText}
                        onChange={e => setEditingChatMsgText(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#FAF8F6] border border-[#E8E2DC] rounded-xl text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9A5643]"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSaveEditedChatMessage(msg.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>حفظ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChatMsgId(null);
                            setEditingChatMsgText('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-[#E8E2DC] text-stone-600 text-xs font-semibold hover:bg-stone-50 transition cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>
                  )}
                </div>
              );
            })
          )}
          <div ref={chatListEndRef} />
        </div>

        {/* Message Input Bar — Visible and usable for ALL roles */}
        <form
          onSubmit={handleSendStaffChatMessage}
          className="p-3.5 sm:p-4 bg-white border-t border-[#E8E2DC] flex items-center gap-2.5"
        >
          <input
            id="staff-chat-input"
            type="text"
            value={chatInputText}
            onChange={e => setChatInputText(e.target.value)}
            placeholder={`اكتبي رسالة للكادر باسم (${currentUser?.name || 'عضو الكادر'})...`}
            className="flex-1 px-4 py-2.5 bg-[#FAF8F6] border border-[#E8E2DC] rounded-2xl text-xs sm:text-sm font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#9A5643] focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={!chatInputText.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-2xl bg-[#9A5643] hover:bg-[#7B3F30] disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shrink-0 shadow-2xs"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span>إرسال</span>
          </button>
        </form>
      </div>

      {/* =====================================================================
          PART 1: DAILY & MONTHLY HIJRI ATTENDANCE FOR SUPERVISORS & TEACHERS
          (جدول التحضير اليومي والشهري للمعلمات والمشرفات - تقويم أم القرى)
         ===================================================================== */}
      <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
        {/* Personal Self Check-In Bar:
            Strictly shown ONLY when logged in as a Supervisor (مشرفة) or Teacher (معلمة).
            Completely HIDDEN when a Founder (مؤسس المنصة) or Platform Owner/Leader (مالك المنصة / قائدة) opens this view. */}
        {!isAdminOversight && isCurrentOperationalStaff && currentUser && (
          <div className="p-5 sm:p-6 bg-[#FAF7F5] border-b border-[#E8DFD8] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-stone-900">
                      التحضير اليومي الذاتي ({currentUser.name})
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F6EFEA] text-[#7B3F30] border border-[#E5C3B3]">
                      <Calendar className="w-3.5 h-3.5 text-[#9A5643]" />
                      <span>تاريخ اليوم (تقويم أم القرى): {formatHijriDate(todayIso, { includeWeekday: true })}</span>
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#9A5643]" />
                    <span>مقيد حصرياً بتاريخ اليوم الهجري الحالي — يسجل وقت الحضور تلقائياً أو يطلب كتابة عذر الغياب</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSelfCheckInPresent}
                  className="px-4 py-2.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تسجيل حضور اليوم</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelfExcuseText(selfTodayRecord?.excuseText || '');
                    setShowSelfExcuseForm(prev => !prev);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#F6EFEA] hover:bg-[#EFE3DA] text-[#7B3F30] border border-[#E5C3B3] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <AlertCircle className="w-4 h-4 text-[#9A5643] shrink-0" />
                  <span>تسجيل غياب / اعتذار</span>
                </button>
              </div>
            </div>

            {selfTodayRecord && (
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                  selfTodayRecord.status === 'present'
                    ? 'bg-[#EBF3EE] border-[#C5DEC9] text-[#2D5A43]'
                    : 'bg-[#F6EFEA] border-[#E5C3B3] text-[#7B3F30]'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {selfTodayRecord.status === 'present' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#2D5A43] shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#9A5643] shrink-0" />
                  )}
                  <span className="font-bold">
                    حالتكِ المسجلة لليوم:{' '}
                    {selfTodayRecord.status === 'present'
                      ? 'حاضرة'
                      : selfTodayRecord.status === 'absent_excused'
                      ? 'غياب بعذر'
                      : 'غياب بدون عذر'}
                  </span>
                  {selfTodayRecord.checkInTime && (
                    <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-white/80">
                      وقت التسجيل: {selfTodayRecord.checkInTime}
                    </span>
                  )}
                  {selfTodayRecord.excuseText && (
                    <span className="text-[#7B3F30] font-medium">
                      • العذر: {selfTodayRecord.excuseText}
                    </span>
                  )}
                </div>
              </div>
            )}

            {showSelfExcuseForm && (
              <form
                onSubmit={handleSelfCheckInExcused}
                className="p-4 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#7B3F30] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#9A5643]" />
                    <span>
                      سبب وعذر الغياب ليوم {formatHijriShort(todayIso)}:
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSelfExcuseForm(false)}
                    className="text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  required
                  rows={2}
                  value={selfExcuseText}
                  onChange={e => setSelfExcuseText(e.target.value)}
                  placeholder="اكتبي عذر الغياب وتفاصيله..."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E5C3B3] rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9A5643]"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSelfExcuseForm(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs text-stone-600 hover:bg-white/70 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>حفظ كـ غياب بعذر</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Daily & Monthly Attendance Table (Strictly Supervisors & Teachers ONLY) */}
        <div className="p-5 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#9A5643]" />
              <span>جدول التحضير اليومي والشهري للمعلمات والمشرفات</span>
            </h4>
            <p className="text-xs text-stone-500 mt-0.5">
              إحصائيات الشهر الهجري المعروض: <strong className="text-[#7B3F30]">{selectedHijriParts.monthLabel}</strong>
              {isAdminOversight
                ? ' • صلاحية كاملة لمؤسس ومالك المنصة لتعديل الحالة أو العذر في أي تاريخ هجري'
                : ' • يعرض سجل حضوركِ اليومي وإحصائياتكِ الشهرية'}
            </p>
          </div>

          {isAdminOversight ? (
            <div className="w-full lg:w-auto">
              <HijriDateNavigationBar
                selectedDate={selectedAttendanceDate}
                onChangeDate={setSelectedAttendanceDate}
                compact
              />
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F6EFEA] border border-[#E5C3B3] text-xs font-bold text-[#7B3F30]">
              <Calendar className="w-3.5 h-3.5 text-[#9A5643]" />
              <span>{formatHijriDate(todayIso, { includeWeekday: true })}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#FAF7F5] border-b border-stone-200 text-stone-600">
              <tr>
                <th className="py-3.5 px-4 font-bold">المعلمة / المشرفة</th>
                <th className="py-3.5 px-4 font-bold">ساعات الدوام</th>
                <th className="py-3.5 px-4 font-bold">وقت التسجيل</th>
                <th className="py-3.5 px-4 font-bold">الحالة ({formatHijriShort(effectiveAttendanceDate)})</th>
                <th className="py-3.5 px-4 font-bold">عذر الغياب وتفاصيله</th>
                <th className="py-3.5 px-4 font-bold text-center">إحصائية الشهر ({selectedHijriParts.monthName})</th>
                {isAdminOversight && (
                  <th className="py-3.5 px-4 font-bold text-center">تحكم الإدارة</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {displayedStaffList.length > 0 ? (
                displayedStaffList.map(staff => {
                  const profile = resolveStaffProfile(staff, settings);
                  const rec = allAttendanceRecords[`${staff.id}_${effectiveAttendanceDate}`];
                  const monthly = getStaffMonthlySummary(staff.id);
                  const shortRole = getStaffShortRoleLabel(staff.role, staff);

                  return (
                    <tr key={staff.id} className="hover:bg-stone-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
                            {renderUserAvatarBadge(staff.avatarIcon, '#9A5643', 'w-4 h-4')}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 privacy-teacher-name">{staff.name}</div>
                            <span
                              className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                roleBadgeStyles[staff.role] || roleBadgeStyles.teacher
                              }`}
                            >
                              {shortRole}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-stone-700 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
                          <span>{profile.workingHours}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-stone-800">
                        {rec?.checkInTime ? (
                          <span className="px-2.5 py-1 rounded-lg bg-[#F6EFEA] text-[#7B3F30] border border-[#E5C3B3]">
                            {rec.checkInTime}
                          </span>
                        ) : (
                          <span className="text-stone-400 font-sans font-normal">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {rec?.status === 'present' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EBF3EE] text-[#2D5A43] border border-[#C5DEC9] text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>حاضرة</span>
                          </span>
                        ) : rec?.status === 'absent_excused' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F6EFEA] text-[#7B3F30] border border-[#E5C3B3] text-[11px] font-bold">
                            <AlertCircle className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
                            <span>غياب بعذر</span>
                          </span>
                        ) : rec?.status === 'absent_unexcused' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>غياب بدون عذر</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400">لم يُسجل</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-[260px]">
                        {rec?.excuseText ? (
                          <p className="text-xs text-[#7B3F30] bg-[#F6EFEA]/70 px-3 py-1.5 rounded-xl border border-[#E5C3B3] leading-relaxed">
                            {rec.excuseText}
                          </p>
                        ) : (
                          <span className="text-stone-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-mono">
                          <span className="px-2 py-0.5 rounded-lg bg-[#EBF3EE] text-[#2D5A43] font-bold">
                            حضور: {monthly.presentDays}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-[#F6EFEA] text-[#7B3F30] font-bold">
                            بعذر: {monthly.excusedDays}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 font-bold">
                            بدون عذر: {monthly.unexcusedDays}
                          </span>
                        </div>
                      </td>

                      {isAdminOversight && (
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleAdminQuickStatusChange(staff, effectiveAttendanceDate, 'present')}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                rec?.status === 'present'
                                  ? 'bg-[#2D5A43] text-white'
                                  : 'bg-stone-100 hover:bg-[#EBF3EE] text-stone-700 hover:text-[#2D5A43]'
                              }`}
                            >
                              حاضرة
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAdminQuickStatusChange(staff, effectiveAttendanceDate, 'absent_excused')
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                rec?.status === 'absent_excused'
                                  ? 'bg-[#9A5643] text-white'
                                  : 'bg-stone-100 hover:bg-[#F6EFEA] text-stone-700 hover:text-[#7B3F30]'
                              }`}
                            >
                              غياب بعذر
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAdminQuickStatusChange(staff, effectiveAttendanceDate, 'absent_unexcused')
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                rec?.status === 'absent_unexcused'
                                  ? 'bg-rose-700 text-white'
                                  : 'bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-rose-700'
                              }`}
                            >
                              بدون عذر
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingAttendanceTarget({
                                  user: staff,
                                  dateIso: effectiveAttendanceDate,
                                  status: rec?.status || 'present',
                                  checkInTime: rec?.checkInTime || formatCurrentArabicTime(),
                                  excuseText: rec?.excuseText || ''
                                })
                              }
                              className="p-1.5 rounded-lg bg-[#F6EFEA] hover:bg-[#EFE3DA] text-[#7B3F30] border border-[#E5C3B3] transition cursor-pointer"
                              title="تعديل الحالة أو وقت التسجيل أو العذر"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminDeleteAttendanceRecord(staff, effectiveAttendanceDate)}
                              disabled={!rec}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                rec
                                  ? 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 cursor-pointer active:scale-95'
                                  : 'bg-stone-50 text-stone-300 border-stone-200 cursor-not-allowed'
                              }`}
                              title="حذف سجل الحضور أو الغياب لهذا اليوم وإعادته إلى غير مسجّل"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdminOversight ? 7 : 6} className="py-8 text-center text-stone-400 text-xs">
                    لا توجد حسابات مشرفات أو معلمات مسجلة حالياً. يمكن إضافتهن من قسم «المعلمات والمشرفات».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          PART 2: DUTIES, WORKING HOURS, MANUAL SALARY & PRIVATE NOTES
          (بطاقة المهام والدوام والراتب للمشرفات والمعلمات فقط)
         ===================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center">
              <ListTodo className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 font-quran">
                بطاقة المهام والدوام والراتب (للمشرفات والمعلمات فقط)
              </h3>
              <p className="text-[11px] text-stone-500">
                ساعات الدوام، المهام والمسؤوليات، الراتب الشهري الثابت (بدون خصم تلقائي)، وملاحظات الإدارة الخاصة
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {displayedStaffList.map(user => {
            const shortRoleBadge = getStaffShortRoleLabel(user.role, user);
            const profile = resolveStaffProfile(user, settings);
            const monthlyStats = getStaffMonthlySummary(user.id);

            const assignedCircles =
              user.role === 'supervisor'
                ? circles.filter(c => c.supervisorId === user.id || user.circleIds?.includes(c.id))
                : circles.filter(c => c.teacherId === user.id || user.circleIds?.includes(c.id));

            return (
              <div
                key={user.id}
                className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-5 flex flex-col justify-between"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
                      {renderUserAvatarBadge(user.avatarIcon, '#9A5643', 'w-6 h-6')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-stone-900 text-base privacy-teacher-name">
                          {user.name}
                        </h4>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            roleBadgeStyles[user.role] || roleBadgeStyles.teacher
                          }`}
                        >
                          {shortRoleBadge}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {user.title}
                        {assignedCircles.length > 0 &&
                          ` • ${assignedCircles.map(c => (c.name || '').replace(/[🪴🤎]/g, '').trim()).join('، ')}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
                    <span className="px-2.5 py-1 rounded-xl bg-[#EBF3EE] text-[#2D5A43] font-bold">
                      حضور: {monthlyStats.presentDays}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-[#F6EFEA] text-[#7B3F30] font-bold">
                      بعذر: {monthlyStats.excusedDays}
                    </span>
                  </div>
                </div>

                {/* 1) ساعات الدوام & 3) الراتب الشهري الثابت */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Working Hours (ساعات الدوام) */}
                  <div className="p-4 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#7B3F30] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#9A5643]" />
                        <span>ساعات الدوام</span>
                      </span>
                      {isAdminOversight && (
                        <button
                          type="button"
                          onClick={() => {
                            setHoursDrafts(prev => ({
                              ...prev,
                              [user.id]: prev[user.id] ?? profile.workingHours
                            }));
                            setFocusedHoursUserId(user.id);
                            hoursInputRefs.current[user.id]?.focus();
                          }}
                          className="p-1 rounded-lg hover:bg-white/80 text-[#9A5643] transition cursor-pointer"
                          title="تعديل ساعات الدوام"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isAdminOversight ? (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={el => {
                              hoursInputRefs.current[user.id] = el;
                            }}
                            type="text"
                            value={
                              focusedHoursUserId === user.id
                                ? hoursDrafts[user.id] ?? profile.workingHours
                                : profile.workingHours
                            }
                            onFocus={() => {
                              setHoursDrafts(prev => ({
                                ...prev,
                                [user.id]: prev[user.id] ?? profile.workingHours
                              }));
                              setFocusedHoursUserId(user.id);
                            }}
                            onChange={e => {
                              const val = e.target.value;
                              setHoursDrafts(prev => ({
                                ...prev,
                                [user.id]: val
                              }));
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const currentVal = e.currentTarget.value;
                                setFocusedHoursUserId(null);
                                void handleSaveStaffWorkingHours(user, currentVal, false);
                                e.currentTarget.blur();
                              }
                            }}
                            onBlur={e => {
                              const currentVal = e.currentTarget.value;
                              setFocusedHoursUserId(null);
                              void handleSaveStaffWorkingHours(user, currentVal, true);
                            }}
                            placeholder="من 4:00 عصراً إلى 6:00 مساءً"
                            className="w-full px-2.5 py-1.5 bg-white border border-[#E5C3B3] focus:border-[#9A5643] rounded-xl text-xs font-bold text-stone-900 focus:outline-none transition"
                          />
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={async () => {
                              const valToSave =
                                focusedHoursUserId === user.id
                                  ? hoursDrafts[user.id] ?? profile.workingHours
                                  : profile.workingHours;
                              setFocusedHoursUserId(null);
                              await handleSaveStaffWorkingHours(user, valToSave, false);
                            }}
                            disabled={savingHoursUserId === user.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition cursor-pointer shrink-0 active:scale-95 disabled:opacity-60"
                            title="حفظ ساعات الدوام سحابياً"
                          >
                            <Save className="w-3.5 h-3.5 shrink-0" />
                            <span>حفظ الدوام</span>
                          </button>
                        </div>
                        {parseShiftStartMinutes(
                          focusedHoursUserId === user.id
                            ? hoursDrafts[user.id] ?? profile.workingHours
                            : profile.workingHours
                        ) !== null && (
                          <div className="text-[11px] font-semibold text-[#7B3F30] flex items-center gap-1">
                            <BellRing className="w-3 h-3 text-[#9A5643] shrink-0" />
                            <span>
                              بداية الدوام للتنبيه الذكي:{' '}
                              {formatMinutesToArabicTime(
                                parseShiftStartMinutes(
                                  focusedHoursUserId === user.id
                                    ? hoursDrafts[user.id] ?? profile.workingHours
                                    : profile.workingHours
                                )!
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 pt-0.5">
                        <div className="text-xs sm:text-sm font-bold text-stone-900">
                          {profile.workingHours}
                        </div>
                        {parseShiftStartMinutes(profile.workingHours) !== null && (
                          <div className="text-[11px] font-semibold text-[#7B3F30] flex items-center gap-1">
                            <BellRing className="w-3 h-3 text-[#9A5643] shrink-0" />
                            <span>
                              بداية الدوام للتنبيه الذكي:{' '}
                              {formatMinutesToArabicTime(parseShiftStartMinutes(profile.workingHours)!)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Monthly Salary (الراتب الشهري الثابت يدوياً - بدون خصم تلقائي + تمويه الخصوصية) */}
                  <div className="p-4 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#7B3F30] flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-[#9A5643]" />
                        <span>الراتب الشهري</span>
                      </span>
                      {isAdminOversight && editingSalaryUserId !== user.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSalaryUserId(user.id);
                            setSalaryDraft(String(profile.monthlySalary));
                          }}
                          className="p-1 rounded-lg hover:bg-white/80 text-[#9A5643] transition cursor-pointer"
                          title="تعديل الراتب الشهري يدوياً"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {editingSalaryUserId === user.id ? (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={salaryDraft}
                          onChange={e => setSalaryDraft(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#9A5643] rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-[#7B3F30]">ر.س</span>
                        <button
                          type="button"
                          onClick={async () => {
                            const num = Number(salaryDraft) || 0;
                            await saveStaffProfileFields(
                              user,
                              { monthlySalary: num },
                              `تم تحديث الراتب الشهري الثابت لـ ${user.name}`
                            );
                            setEditingSalaryUserId(null);
                          }}
                          className="p-1.5 rounded-xl bg-[#9A5643] text-white cursor-pointer"
                          title="حفظ"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSalaryUserId(null)}
                          className="p-1.5 rounded-xl bg-white text-stone-500 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-0.5">
                        <span
                          className={`text-sm font-bold font-mono text-[#7B3F30] bg-white px-3 py-1 rounded-xl border border-[#E5C3B3] privacy-salary ${
                            isPrivacyMode ? 'blur-[5px] select-none' : ''
                          }`}
                          style={isPrivacyMode ? { filter: 'blur(5px)', userSelect: 'none' } : undefined}
                        >
                          {profile.monthlySalary.toLocaleString('en-US')} ر.س
                        </span>
                        <span className="text-[10px] text-[#9A5643] font-semibold">
                          مبلغ ثابت يدوياً
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2) المهام والمسؤوليات (Editable & Deletable Tasks List) */}
                <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                      <ListTodo className="w-4 h-4 text-[#9A5643]" />
                      <span>المهام والمسؤوليات</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#7B3F30] bg-[#F6EFEA] px-2.5 py-0.5 rounded-full border border-[#E5C3B3]">
                      {profile.tasks.filter(t => t.completed).length} من {profile.tasks.length} مكتملة
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                    {profile.tasks.length > 0 ? (
                      profile.tasks.map(task => {
                        const isEditingThisTask =
                          editingTaskKey?.userId === user.id && editingTaskKey?.taskId === task.id;
                        return (
                          <div
                            key={task.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition ${
                              task.completed
                                ? 'bg-[#F6EFEA]/70 border-[#E5C3B3] text-[#7B3F30]'
                                : 'bg-white border-stone-200/80 text-stone-800'
                            }`}
                          >
                            {isEditingThisTask ? (
                              <div className="flex items-center gap-1.5 flex-1">
                                <input
                                  type="text"
                                  value={editingTaskText}
                                  onChange={e => setEditingTaskText(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-[#9A5643] rounded-lg text-xs text-stone-900 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditedTaskText(user, task.id)}
                                  className="p-1.5 rounded-lg bg-[#9A5643] text-white cursor-pointer"
                                  title="حفظ تعديل المهمة"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTaskKey(null)}
                                  className="p-1.5 rounded-lg bg-stone-100 text-stone-500 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleTaskCheckbox(user, task.id)}
                                  className="flex items-center gap-2.5 text-right flex-1 cursor-pointer"
                                >
                                  {task.completed ? (
                                    <CheckSquare className="w-4 h-4 text-[#9A5643] shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-[#9A5643] shrink-0" />
                                  )}
                                  <span
                                    className={`text-xs leading-snug ${
                                      task.completed ? 'line-through opacity-75' : 'font-medium'
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                </button>

                                {isAdminOversight && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTaskKey({ userId: user.id, taskId: task.id });
                                        setEditingTaskText(task.title);
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-[#F6EFEA] text-[#9A5643] transition cursor-pointer"
                                      title="تعديل نص المهمة"
                                    >
                                      <PenLine className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTaskFromUser(user, task.id)}
                                      className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                                      title="حذف المهمة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-stone-400 text-center py-2">لا توجد مهام مسندة حالياً</p>
                    )}
                  </div>

                  {/* Founder/Owner Add New Task Input */}
                  {isAdminOversight && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newTaskInputs[user.id] || ''}
                        onChange={e => setNewTaskInputs(prev => ({ ...prev, [user.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTaskToUser(user);
                          }
                        }}
                        placeholder="أضيفي مهمة جديدة لهذه المعلمة / المشرفة..."
                        className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:border-[#9A5643]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTaskToUser(user)}
                        className="px-3.5 py-2 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة مهمة</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4) ملاحظات الإدارة (Visible & Editable ONLY by Founders & Platform Owners/Leaders) */}
                {isAdminOversight && (
                  <div className="p-4 rounded-2xl bg-[#F6EFEA]/65 border border-[#E5C3B3] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#7B3F30] flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#9A5643]" />
                        <span>ملاحظات الإدارة (خاصة بمؤسس ومالك المنصة):</span>
                      </span>
                      {editingNotesUserId !== user.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesUserId(user.id);
                            setNotesDraft(profile.leaderPrivateNotes);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#9A5643] hover:text-[#7B3F30] cursor-pointer"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          <span>{profile.leaderPrivateNotes ? 'تعديل الملاحظة' : 'إضافة ملاحظة'}</span>
                        </button>
                      )}
                    </div>

                    {editingNotesUserId === user.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={notesDraft}
                          onChange={e => setNotesDraft(e.target.value)}
                          placeholder="اكتبي ملاحظات التقييم والمتابعة الخاصة بالإدارة..."
                          className="w-full px-3 py-2 bg-white border border-[#9A5643] rounded-xl text-xs text-stone-800 focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingNotesUserId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-white cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await saveStaffProfileFields(
                                user,
                                { leaderPrivateNotes: notesDraft.trim() },
                                `تم حفظ ملاحظات الإدارة الخاصة بـ ${user.name}`
                              );
                              setEditingNotesUserId(null);
                            }}
                            className="px-4 py-1.5 rounded-lg bg-[#9A5643] text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>حفظ الملاحظة</span>
                          </button>
                        </div>
                      </div>
                    ) : profile.leaderPrivateNotes ? (
                      <p className="text-xs text-[#7B3F30] leading-relaxed bg-white/85 p-3 rounded-xl border border-[#E5C3B3]">
                        {profile.leaderPrivateNotes}
                      </p>
                    ) : (
                      <p className="text-[11px] text-stone-400">
                        لا توجد ملاحظات إدارية مسجلة بعد (تظهر لمؤسس ومالك المنصة فقط).
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Founder/Owner Attendance Override Modal */}
      {editingAttendanceTarget && isAdminOversight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E8DFD8] space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#9A5643]" />
                <h3 className="font-bold text-stone-900 text-sm">
                  تعديل سجل التحضير: {editingAttendanceTarget.user.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAttendanceTarget(null)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminAttendanceOverride} className="space-y-4">
              <div className="p-3 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-xs font-bold text-[#7B3F30] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#9A5643]" />
                <span>التاريخ الهجري: {formatHijriDate(editingAttendanceTarget.dateIso, { includeWeekday: true })}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">الحالة اليومية:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'present', label: 'حاضرة' },
                      { value: 'absent_excused', label: 'غياب بعذر' },
                      { value: 'absent_unexcused', label: 'بدون عذر' }
                    ] as const
                  ).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setEditingAttendanceTarget(prev => (prev ? { ...prev, status: opt.value } : null))
                      }
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        editingAttendanceTarget.status === opt.value
                          ? 'bg-[#9A5643] text-white border-[#7B3F30]'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-[#F6EFEA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">وقت التسجيل:</label>
                <input
                  type="text"
                  value={editingAttendanceTarget.checkInTime}
                  onChange={e =>
                    setEditingAttendanceTarget(prev => (prev ? { ...prev, checkInTime: e.target.value } : null))
                  }
                  placeholder="مثال: 04:02 م"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  عذر الغياب وتفاصيله {editingAttendanceTarget.status === 'absent_excused' ? '*' : '(اختياري)'}:
                </label>
                <textarea
                  rows={3}
                  required={editingAttendanceTarget.status === 'absent_excused'}
                  value={editingAttendanceTarget.excuseText}
                  onChange={e =>
                    setEditingAttendanceTarget(prev => (prev ? { ...prev, excuseText: e.target.value } : null))
                  }
                  placeholder="اكتبي عذر الغياب وتفاصيله..."
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-xs text-stone-800"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() =>
                    handleAdminDeleteAttendanceRecord(editingAttendanceTarget.user, editingAttendanceTarget.dateIso)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>حذف السجل</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAttendanceTarget(null)}
                    className="px-4 py-2 text-xs text-stone-600 rounded-xl hover:bg-stone-100 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>حفظ واعتماد</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

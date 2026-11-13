import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessagesSquare,
  Clock,
  Pin,
  Send,
  PenLine,
  Trash2,
  Check,
  X,
  BellRing,
  Bell,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import {
  StaffChatMessage,
  PinnedStaffAnnouncement
} from '../types';
import {
  canEditOrDeleteStaffChat,
  readResolvedStaffChatMessages,
  writeLocalStaffChatMessages,
  readLocalDeletedStaffChatIds,
  writeLocalDeletedStaffChatIds,
  resolvePinnedStaffAnnouncement,
  writeLocalPinnedAnnouncement,
  formatCurrentArabicTime,
  getStaffShortRoleLabel,
  getStaffDropdownRoleBadge,
  isSupervisorOrTeacherOnly,
  STAFF_CHAT_TTL_MS
} from '../utils/staffHelpers';
import {
  deliverNativeOrPwaNotification,
  enableStaffNotifications,
  getChatMessageSeenKey,
  getPinnedAnnouncementSeenKey,
  isStaffNotificationsEnabled,
  markMessageIdAsSeenByUser,
  markStaffChatSeenNow
} from '../utils/staffNotifications';

interface FloatingStaffChatWidgetProps {
  unreadCount: number;
  externalOpenRequest?: number;
}

export const FloatingStaffChatWidget: React.FC<FloatingStaffChatWidgetProps> = ({
  unreadCount,
  externalOpenRequest
}) => {
  const {
    users,
    currentUser,
    updateUser,
    settings,
    updateSettings,
    showToast,
    syncNow,
    cloudStatus
  } = useApp();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [chatInputText, setChatInputText] = useState<string>('');
  const [editingChatMsgId, setEditingChatMsgId] = useState<string | null>(null);
  const [editingChatMsgText, setEditingChatMsgText] = useState<string>('');
  const [isEditingPinnedAnnouncement, setIsEditingPinnedAnnouncement] = useState<boolean>(false);
  const [pinnedAnnouncementDraft, setPinnedAnnouncementDraft] = useState<string>('');
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() =>
    isStaffNotificationsEnabled()
  );

  const chatListEndRef = useRef<HTMLDivElement | null>(null);

  const canModerateStaffChat = canEditOrDeleteStaffChat(currentUser);
  const isCurrentOperationalStaff = isSupervisorOrTeacherOnly(currentUser);

  const activeChatMessages: StaffChatMessage[] = readResolvedStaffChatMessages(
    settings,
    nowTick,
    users
  );
  const pinnedAnnouncement: PinnedStaffAnnouncement = resolvePinnedStaffAnnouncement(
    settings,
    users
  );

  useEffect(() => {
    const syncNotifState = () => {
      setNotificationsEnabled(isStaffNotificationsEnabled());
    };
    window.addEventListener('ghaith-staff-notifications-changed', syncNotifState);
    return () => window.removeEventListener('ghaith-staff-notifications-changed', syncNotifState);
  }, []);

  // Open widget when requested externally (e.g. clicking "عرض الرسالة" on floating alert or SW notification)
  useEffect(() => {
    if (externalOpenRequest && externalOpenRequest > 0) {
      setIsOpen(true);
    }
  }, [externalOpenRequest]);

  // Mark messages as seen when panel is opened or while open and new messages arrive
  useEffect(() => {
    if (isOpen && currentUser?.id) {
      markStaffChatSeenNow(currentUser.id, settings, users);
      setTimeout(() => {
        chatListEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  }, [isOpen, currentUser?.id, activeChatMessages.length, pinnedAnnouncement.updatedAt]);

  // Auto-prune expired messages (> 24 hours) periodically and sync with cloud
  useEffect(() => {
    const pruneExpiredMessages = () => {
      const currentNow = Date.now();
      setNowTick(currentNow);
      const rawSettingsMsgs = Array.isArray(settings?.staffChatMessages)
        ? settings.staffChatMessages
        : [];
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
          ...(payload.staffChatMessages !== undefined
            ? { staffChatMessages: payload.staffChatMessages }
            : {}),
          ...(payload.deletedStaffChatIds !== undefined
            ? { deletedStaffChatIds: payload.deletedStaffChatIds }
            : {}),
          ...(payload.pinnedStaffAnnouncement !== undefined
            ? { pinnedStaffAnnouncement: payload.pinnedStaffAnnouncement }
            : {})
        },
        true
      );
    }
  };

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

    const nextMessages = readResolvedStaffChatMessages(settings, nowMs, users).filter(
      m => m.id !== msgId
    );
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
    showToast(
      cleanText ? 'تم تحديث التعميم الإداري المثبت بنجاح' : 'تم مسح التعميم الإداري المثبت',
      'success'
    );
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
      title: 'إشعار تجريبي — مساحة تواصل الكادر',
      body: testBody,
      tag: `ghaith-notif-test-${Date.now()}`,
      playChime: true
    });
    showToast(testBody, 'info');
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
      showToast('تم تحديث رسائل الكادر من السحابة الفورية', 'info');
    } finally {
      setTimeout(() => setIsManualSyncing(false), 600);
    }
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
    return `تُحذف بعد ${Math.max(1, minutes)} د`;
  };

  const isSyncingNow = isManualSyncing || cloudStatus === 'syncing';
  const effectiveUnread = isOpen ? 0 : unreadCount;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col items-end" dir="rtl">
      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="mb-3 w-[350px] sm:w-[400px] max-w-[calc(100vw-2.5rem)] bg-white rounded-3xl border border-[#E8E2DC] shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Panel Header */}
          <div className="p-3.5 sm:p-4 bg-white border-b border-[#E8E2DC] space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
                  <MessagesSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-stone-900 font-quran">
                      مساحة تواصل الكادر
                    </h3>
                    <span className="text-[10px] font-bold text-[#7B3F30] bg-[#FAF6F3] border border-[#E8E2DC] px-2 py-0.5 rounded-lg tabular-nums">
                      {activeChatMessages.length} رسالة
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9A5643] font-medium mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#9A5643] shrink-0" />
                    <span>تُحذف الرسائل تلقائياً بعد 24 ساعة</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleManualCloudRefresh}
                  disabled={isSyncingNow}
                  title="تحديث فوري من السحابة"
                  className="p-1.5 rounded-xl bg-[#FAF6F3] hover:bg-[#EFE3DA] text-[#9A5643] border border-[#E8E2DC] transition cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="إغلاق مساحة التواصل"
                  aria-label="إغلاق مساحة التواصل"
                  className="p-1.5 rounded-xl bg-[#FAF6F3] hover:bg-stone-100 text-stone-500 border border-[#E8E2DC] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Notification & Admin Pinned Action Bar */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-stone-100">
              {!notificationsEnabled ? (
                <button
                  type="button"
                  onClick={handleActivateNotifications}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-[10px] font-bold transition cursor-pointer"
                >
                  <BellRing className="w-3 h-3 shrink-0" />
                  <span>تفعيل إشعارات الدوام والرسائل</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FAF6F3] text-[#7B3F30] border border-[#E5C3B3] text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-[#9A5643] shrink-0" />
                    <span>الإشعارات مفعّلة</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-[#F6EFEA] text-[#9A5643] border border-[#E8E2DC] text-[10px] font-bold transition cursor-pointer"
                    title="إرسال إشعار تجريبي فوري"
                  >
                    <Bell className="w-2.5 h-2.5 shrink-0" />
                    <span>تجربة إشعار</span>
                  </button>
                </div>
              )}

              {canModerateStaffChat && !pinnedAnnouncement.text && !isEditingPinnedAnnouncement && (
                <button
                  type="button"
                  onClick={() => {
                    setPinnedAnnouncementDraft('');
                    setIsEditingPinnedAnnouncement(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF6F3] hover:bg-[#F3EAE3] text-[#7B3F30] border border-[#E8E2DC] text-[10px] font-bold transition cursor-pointer"
                >
                  <Pin className="w-3 h-3 text-[#9A5643]" />
                  <span>تثبيت تعميم</span>
                </button>
              )}
            </div>
          </div>

          {/* Pinned Administrative Announcement ("تعميم إداري مثبت") */}
          {(pinnedAnnouncement.text || isEditingPinnedAnnouncement) && (
            <div className="px-3.5 py-2.5 bg-[#FAF6F3] border-b border-[#E8E2DC]">
              {isEditingPinnedAnnouncement && canModerateStaffChat ? (
                <form onSubmit={handleSavePinnedAnnouncement} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7B3F30]">
                      <Pin className="w-3 h-3 text-[#9A5643] shrink-0" />
                      <span>تعديل التعميم الإداري المثبت:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingPinnedAnnouncement(false)}
                      className="p-0.5 text-stone-400 hover:text-stone-600 rounded-lg cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={pinnedAnnouncementDraft}
                      onChange={e => setPinnedAnnouncementDraft(e.target.value)}
                      placeholder="اكتبي نص التعميم الإداري المثبت..."
                      className="flex-1 px-3 py-1.5 bg-white border border-[#E8E2DC] rounded-xl text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9A5643]"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-[11px] font-bold transition cursor-pointer shrink-0"
                    >
                      <Check className="w-3 h-3" />
                      <span>حفظ</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-white border border-[#E8E2DC] text-[#9A5643] flex items-center justify-center shrink-0 mt-0.5">
                      <Pin className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-[#7B3F30]">
                          تعميم إداري مثبت
                        </span>
                        {pinnedAnnouncement.updatedBy && (
                          <span className="text-[10px] text-stone-500">
                            · {pinnedAnnouncement.updatedBy}
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
                        className="p-1 rounded-lg bg-white hover:bg-[#F6EFEA] text-[#9A5643] border border-[#E8E2DC] transition cursor-pointer"
                      >
                        <PenLine className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleDeletePinnedAnnouncement}
                        title="حذف التعميم الإداري المثبت"
                        aria-label="حذف التعميم الإداري المثبت"
                        className="p-1 rounded-lg bg-white hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-[#E8E2DC] transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages Feed (24-Hour Active Messages) */}
          <div className="p-3.5 bg-[#FAF8F6]/70 max-h-80 min-h-[220px] overflow-y-auto space-y-2.5">
            {activeChatMessages.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E8E2DC] p-5 text-center space-y-1.5 my-4">
                <div className="w-8 h-8 rounded-2xl bg-[#FAF6F3] border border-[#E8E2DC] text-[#9A5643] flex items-center justify-center mx-auto">
                  <MessagesSquare className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-stone-700">
                  لا توجد رسائل خلال الـ 24 ساعة الماضية
                </p>
                <p className="text-[11px] text-stone-500">
                  اكتبي رسالتكِ أدناه للتواصل المباشر مع إدارة المقرأة والكادر
                </p>
              </div>
            ) : (
              activeChatMessages.map(msg => {
                const isOwnMsg =
                  currentUser?.id === msg.senderId || currentUser?.name === msg.senderName;
                const isEditingThisMsg = editingChatMsgId === msg.id && canModerateStaffChat;
                const isSenderLeaderOrOwner =
                  msg.senderRole === 'owner' ||
                  msg.senderRole === 'leader' ||
                  msg.senderRole === 'developer';

                return (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-2xl bg-white border transition ${
                      isOwnMsg ? 'border-[#D4B8A8] shadow-2xs' : 'border-[#E8E2DC]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-stone-900">
                          {msg.senderName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                            isSenderLeaderOrOwner
                              ? 'bg-[#F6EFEA] text-[#7B3F30] border-[#E5C3B3]'
                              : msg.senderRole === 'supervisor'
                              ? 'bg-[#FDF6F2] text-[#9A5643] border-[#E5C3B3]'
                              : 'bg-[#EBF3EE] text-[#2D5A43] border-[#C5DEC9]'
                          }`}
                        >
                          {msg.senderTitle || getStaffShortRoleLabel(msg.senderRole)}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono tabular-nums">
                          {msg.hijriTimeLabel || formatCurrentArabicTime(new Date(msg.createdAt))}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#9A5643]">
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span>{formatRemaining24hLabel(msg.createdAt)}</span>
                        </span>
                        {msg.editedAt && (
                          <span className="text-[10px] text-stone-400">(معدّلة)</span>
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
                            className="p-1 rounded-lg bg-[#FAF6F3] hover:bg-[#F3EAE3] text-[#9A5643] border border-[#E8E2DC] transition cursor-pointer"
                          >
                            <PenLine className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChatMessage(msg.id)}
                            title="حذف الرسالة"
                            aria-label="حذف الرسالة"
                            className="p-1 rounded-lg bg-[#FAF6F3] hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-[#E8E2DC] transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingThisMsg ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingChatMsgText}
                          onChange={e => setEditingChatMsgText(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-[#FAF8F6] border border-[#E8E2DC] rounded-xl text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9A5643]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditedChatMessage(msg.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-[11px] font-bold transition cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>حفظ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChatMsgId(null);
                            setEditingChatMsgText('');
                          }}
                          className="px-2 py-1.5 rounded-xl bg-white border border-[#E8E2DC] text-stone-600 text-[11px] font-semibold hover:bg-stone-50 transition cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-800 leading-relaxed whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                    )}
                  </div>
                );
              })
            )}
            <div ref={chatListEndRef} />
          </div>

          {/* Message Input Bar */}
          <form
            onSubmit={handleSendStaffChatMessage}
            className="p-3 bg-white border-t border-[#E8E2DC] flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInputText}
              onChange={e => setChatInputText(e.target.value)}
              placeholder={`اكتبي رسالة للكادر باسم (${currentUser?.name || 'عضو الكادر'})...`}
              className="flex-1 px-3.5 py-2 bg-[#FAF8F6] border border-[#E8E2DC] rounded-2xl text-xs font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#9A5643] focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!chatInputText.trim()}
              className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-2xl bg-[#9A5643] hover:bg-[#7B3F30] disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shrink-0 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>إرسال</span>
            </button>
          </form>
        </div>
      )}

      {/* Floating Circular Trigger Button (Bottom-Left Corner) */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="مساحة تواصل الكادر"
        title="مساحة تواصل الكادر (تُحذف الرسائل تلقائياً بعد 24 ساعة)"
        className="relative w-14 h-14 rounded-full bg-[#9A5643] hover:bg-[#7B3F30] text-white shadow-xl border-2 border-white flex items-center justify-center transition-transform duration-150 active:scale-95 cursor-pointer"
      >
        <MessagesSquare className="w-6 h-6" />
        {effectiveUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-white text-[#7B3F30] border-2 border-[#9A5643] text-[11px] font-bold flex items-center justify-center shadow-xs tabular-nums">
            {effectiveUnread > 99 ? '99+' : effectiveUnread}
          </span>
        )}
      </button>
    </div>
  );
};

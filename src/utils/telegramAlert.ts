// Utility for cleaning Telegram usernames and triggering 1-click Telegram absence alerts

export function cleanTelegramUsername(rawInput?: string): string {
  if (!rawInput) return '';
  return rawInput
    .trim()
    .replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i, '')
    .replace(/^(t\.me|telegram\.me)\//i, '')
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .trim();
}

export function buildTelegramAbsenceMessage(params: {
  studentName: string;
  circleName: string;
  absenceCount: number;
}): string {
  const { studentName, circleName, absenceCount } = params;
  return `السلام عليكم ورحمة الله وبركاته 🌿
نفيدكم من منصة «غيث الغيم» بأن الطالبة: ${studentName} قد تجاوزت الحد المسموح به للغياب في حلقة: ${circleName || 'الحلقة القرآنية'} (عدد الغيابات: ${absenceCount} أيام دون عذر)، وتم تحويل سجلها للأرشيف لحين إشعارنا بالعذر واستئناف الحفظ.
شاكرين حرصكم واهتمامكم بحفظ كتاب الله تعالى 🤍`;
}

export async function triggerStudentTelegramAlert(params: {
  studentName: string;
  circleName: string;
  absenceCount: number;
  telegramUsername?: string;
  showToast?: (msg: string, type?: any) => void;
}): Promise<void> {
  const { studentName, circleName, absenceCount, telegramUsername, showToast } = params;
  const message = buildTelegramAbsenceMessage({
    studentName,
    circleName,
    absenceCount: Math.max(1, absenceCount)
  });

  // 1) Copy formatted alert message automatically to clipboard
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = message;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  } catch {
    // Fallback copy if clipboard API is restricted
    try {
      const textarea = document.createElement('textarea');
      textarea.value = message;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      // ignore
    }
  }

  // 2) Show confirmation toast
  showToast?.('تم نسخ رسالة التنبيه، جاري فتح محادثة تيليجرام...');

  // 3) Open https://t.me/${student.telegramUsername} directly in a new window/app
  const cleanUser = cleanTelegramUsername(telegramUsername);
  const targetUrl = cleanUser
    ? `https://t.me/${encodeURIComponent(cleanUser)}`
    : `https://t.me/share/url?url=${encodeURIComponent('https://t.me/')}&text=${encodeURIComponent(message)}`;

  if (typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

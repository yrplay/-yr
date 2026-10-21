import React from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Heart, ShieldCheck, Code, Award } from 'lucide-react';

export const Footer: React.FC = () => {
  const { settings } = useApp();
  const primaryColor = settings?.primaryColor || '#8E5364';

  return (
    <footer className="mt-12 pt-6 pb-8 border-t border-[#E8DFD8] text-stone-600">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 text-xs">
        
        {/* Left: Platform & Institution Info */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-stone-500">
          <div className="flex items-center gap-1.5 font-bold text-stone-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{settings?.name || 'مقرأة غيث الغيم'}</span>
          </div>
          <span>•</span>
          <span className="text-stone-400">مسار مشكاة الغيم القرآني</span>
          <span className="hidden sm:inline">•</span>
          <span className="text-[11px] text-stone-400 hidden sm:inline">
            تحت إشراف: {settings?.leaderName || 'ريفة المنصوري'}
          </span>
        </div>

        {/* Center / Right: Signature & Developer Rights */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <div className="text-[11px] text-stone-400 font-medium">
            تطوير وإشراف تقني:
          </div>
          
          {/* Signature Badge */}
          <div 
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-2xs transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: '#FAF4F6',
              borderColor: '#E8D5DC'
            }}
          >
            <span className="text-xs">✍️</span>
            <span 
              className="font-bold font-mono tracking-tight text-xs"
              style={{ color: primaryColor }}
            >
              بواسطة ياسر التاج · yr_alhosine
            </span>
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-[10px] shadow-2xs">
              ✨
            </span>
          </div>
        </div>

      </div>

      {/* Subtle Bottom Line */}
      <div className="mt-4 pt-3 border-t border-stone-200/50 flex flex-col sm:flex-row items-center justify-between text-[11px] text-stone-400 gap-2 px-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>منصة موثوقة ومحمية بقواعد أمان ومزامنة فورية</span>
        </div>
        <div className="font-mono text-[10px]">
          حقوق الملكية الفكرية والبرمجية محفوظة © {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
};

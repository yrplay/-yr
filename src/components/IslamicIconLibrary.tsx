import React from 'react';

export interface IslamicIconOption {
  id: string;
  name: string;
  category: string;
  svg: (props: { className?: string; color?: string }) => React.JSX.Element;
}

export const ISLAMIC_ICONS: IslamicIconOption[] = [
  {
    id: 'mushaf',
    name: 'المصحف الشريف المذهب',
    category: 'القرآن والوحي',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 12C8 9.79086 9.79086 8 12 8H22C23.1046 8 24 8.89543 24 10V38C24 37 23 36 21 36H11C9.34315 36 8 37.3431 8 39V12Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M40 12C40 9.79086 38.2091 8 36 8H26C24.8954 8 24 8.89543 24 10V38C24 37 25 36 27 36H37C38.6569 36 40 37.3431 40 39V12Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M12 15H20M12 21H19M12 27H17" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M36 15H28M36 21H29M36 27H31" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2.5" fill={color} />
      </svg>
    )
  },
  {
    id: 'cloud_ghaym',
    name: 'غيمة الغيث والبركة',
    category: 'رمز غيث الغيم',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 32H35C38.866 32 42 28.866 42 25C42 21.4396 39.3444 18.4984 35.9085 18.067C34.9388 12.3929 30.0122 8 24 8C18.6657 8 14.1687 11.4552 12.6391 16.2995C9.42168 17.2023 7 20.1555 7 23.6667C7 28.269 10.5817 32 15 32Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M16 38L14 42M24 38L22 42M32 38L30 42" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'crescent',
    name: 'هلال البركة والنور',
    category: 'الأهلة والأنوار',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 8C19.1634 8 12 15.1634 12 24C12 32.8366 19.1634 40 28 40C32.1797 40 35.986 38.3986 38.8576 35.7656C36.6346 36.5562 34.2259 37 31.7143 37C20.8263 37 12 28.1737 12 17.2857C12 13.7915 12.9157 10.5117 14.5208 7.6836C18.4485 8.1257 23.8 8 28 8Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <polygon points="36,13 38,18 43,18 39,21 41,26 36,23 32,26 34,21 30,18 35,18" fill={color} />
      </svg>
    )
  },
  {
    id: 'minaret',
    name: 'المئذنة والمحراب الشامخ',
    category: 'المساجد والمحاريب',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 5L28 11H20L24 5Z" fill={color} />
        <path d="M24 5V2" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="2" r="1.5" fill={color} />
        <rect x="18" y="11" width="12" height="6" rx="1" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
        <rect x="19" y="17" width="10" height="23" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.1" />
        <path d="M21 27C21 25.3431 22.3431 24 24 24C25.6569 24 27 25.3431 27 27V33H21V27Z" fill={color} />
        <path d="M12 40H36" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'lantern',
    name: 'قنديل الهدى والمشكاة',
    category: 'مشكاة النور',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 6V11" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="24" cy="6" r="2.5" stroke={color} strokeWidth="2" />
        <path d="M17 14L20 11H28L31 14L33 24C33 29.5 29 34 24 35C19 34 15 29.5 15 24L17 14Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M20 35L18 42H30L28 35" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="2" />
        <circle cx="24" cy="23" r="3" fill={color} />
        <path d="M24 17V20M24 26V29M19 23H17M31 23H29" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'rihal',
    name: 'رحل المصحف الخشبي',
    category: 'القرآن والوحي',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 12L38 36M38 12L10 36" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M12 14L24 23L36 14" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M10 10H16M32 10H38M10 38H16M32 38H38" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'tasbih',
    name: 'مسبحة الذكر والاستغفار',
    category: 'الذكر والصلة',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="20" r="12" stroke={color} strokeWidth="2.5" strokeDasharray="3 3" />
        <circle cx="24" cy="8" r="2.5" fill={color} />
        <circle cx="32" cy="12" r="2.5" fill={color} />
        <circle cx="36" cy="20" r="2.5" fill={color} />
        <circle cx="32" cy="28" r="2.5" fill={color} />
        <circle cx="24" cy="32" r="2.5" fill={color} />
        <circle cx="16" cy="28" r="2.5" fill={color} />
        <circle cx="12" cy="20" r="2.5" fill={color} />
        <circle cx="16" cy="12" r="2.5" fill={color} />
        <path d="M24 32V38L21 44M24 38L27 44M24 38V44" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'lotus_arabesque',
    name: 'زهرة الأرابيسك الإسلامية',
    category: 'الزخرفة الإسلامية',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="2" />
        <path d="M24 7C26 13 28 17 24 19C20 17 22 13 24 7Z" fill={color} />
        <path d="M24 41C26 35 28 31 24 29C20 31 22 35 24 41Z" fill={color} />
        <path d="M7 24C13 26 17 28 19 24C17 20 13 22 7 24Z" fill={color} />
        <path d="M41 24C35 26 31 28 29 24C31 20 35 22 41 24Z" fill={color} />
        <circle cx="24" cy="24" r="17" stroke={color} strokeWidth="1.5" strokeDasharray="2 4" />
      </svg>
    )
  },
  {
    id: 'palm',
    name: 'النخلة الطيبة المباركة',
    category: 'الطبيعة والبركة',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 42V18" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <path d="M24 18C18 12 10 13 8 16M24 18C30 12 38 13 40 16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 18C19 16 14 20 11 25M24 18C29 16 34 20 37 25" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 18C21 11 24 6 24 5M24 18C27 11 24 6 24 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M16 42H32" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'sun_duha',
    name: 'شمس الضحى والإشراق',
    category: 'الأهلة والأنوار',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="9" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="2.5" />
        <path d="M24 5V10M24 38V43M5 24H10M38 24H43" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10.5 10.5L14 14M34 34L37.5 37.5M10.5 37.5L14 34M34 14L37.5 10.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" fill={color} />
      </svg>
    )
  },
  {
    id: 'mihrab',
    name: 'المحراب وقوس الإنابة',
    category: 'المساجد والمحاريب',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="8" width="28" height="32" rx="4" stroke={color} strokeWidth="2" />
        <path d="M16 40V24C16 19.5817 19.5817 16 24 16C28.4183 16 32 19.5817 32 24V40" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2.5" />
        <circle cx="24" cy="22" r="2" fill={color} />
        <path d="M24 10V14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'feather_ink',
    name: 'ريشة التدوين والضبط',
    category: 'العلم والتدوين',
    svg: ({ className = 'w-6 h-6', color = 'currentColor' }) => (
      <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M38 8C38 8 26 12 20 22C17 27 15 35 15 35L22 34C28 29 38 18 38 8Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M15 35L10 40H16L18 37" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 20L31 27" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
];

export const ISLAMIC_COLOR_PALETTES = [
  { name: 'العنابي الملكي', hex: '#8E5364' },
  { name: 'الأخضر الزمردي', hex: '#2D5A43' },
  { name: 'الكحلي الوقور', hex: '#1E3A8A' },
  { name: 'الذهبي الدافئ', hex: '#B45309' },
  { name: 'الوردي الهادئ', hex: '#9F5F73' },
  { name: 'الزيتي التراثي', hex: '#4D6B53' },
  { name: 'البني الخشبي', hex: '#634832' },
  { name: 'التركواز القرآني', hex: '#0D7490' }
];

export const getIslamicIcon = (iconId?: string) => {
  return ISLAMIC_ICONS.find(i => i.id === iconId) || ISLAMIC_ICONS[0];
};

interface IslamicIconPickerProps {
  selectedIconId?: string;
  selectedColor?: string;
  onSelect: (iconId: string, color: string) => void;
}

export const IslamicIconPicker: React.FC<IslamicIconPickerProps> = ({
  selectedIconId = 'mushaf',
  selectedColor = '#8E5364',
  onSelect
}) => {
  const [activeColor, setActiveColor] = React.useState(selectedColor);
  const [activeId, setActiveId] = React.useState(selectedIconId);

  const handlePickIcon = (id: string) => {
    setActiveId(id);
    onSelect(id, activeColor);
  };

  const handlePickColor = (hex: string) => {
    setActiveColor(hex);
    onSelect(activeId, hex);
  };

  return (
    <div className="space-y-4 p-4 bg-[#FAF7F4] rounded-2xl border border-[#EFE8E2]">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
            <span>✨</span>
            <span>المكتبة الرمزية الإسلامية للأيقونات المرسومة</span>
          </h4>
          <p className="text-[11px] text-stone-500 mt-0.5">
            اختاري أيقونتكِ المرسومة ولونها المفضل لتمثيل هويتكِ في المقرأة والحلقات
          </p>
        </div>

        {/* Current Preview Badge */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${activeColor}15` }}>
            {getIslamicIcon(activeId).svg({ className: 'w-5 h-5', color: activeColor })}
          </div>
          <span className="text-xs font-bold text-stone-800">
            {getIslamicIcon(activeId).name}
          </span>
        </div>
      </div>

      {/* Color Palette Row & Manual Color Picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold text-stone-600">
            اختاري لون الأيقونة (لوحة ألوان حرة أو باليتات معتمدة):
          </label>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <span>اللون المختار:</span>
            <span
              className="w-4 h-4 rounded-full border border-stone-300 shadow-2xs inline-block"
              style={{ backgroundColor: activeColor }}
            />
            <span className="font-mono text-[11px] font-bold text-stone-700">{activeColor}</span>
          </div>
        </div>

        {/* Manual color picker and HEX input */}
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-stone-50 border border-stone-200">
          <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-300 rounded-xl cursor-pointer hover:border-stone-400 shadow-2xs transition text-xs font-bold text-stone-700">
            <input
              type="color"
              value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#8E5364'}
              onChange={e => handlePickColor(e.target.value)}
              className="w-6 h-6 rounded-md border-0 p-0 cursor-pointer"
            />
            <span>🎨 لوحة الألوان اليدوية (اختيار حر)</span>
          </label>

          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-stone-200 text-xs">
            <span className="text-stone-400 font-mono text-[11px]">HEX:</span>
            <input
              type="text"
              value={activeColor}
              onChange={e => handlePickColor(e.target.value)}
              placeholder="#8E5364"
              className="w-20 font-mono text-xs font-bold text-stone-800 outline-none uppercase"
              maxLength={7}
            />
          </div>

          <div className="text-[11px] text-stone-400 mr-auto">
            أو اختاري سريعاً من الباليتات المقترحة:
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ISLAMIC_COLOR_PALETTES.map(c => (
            <button
              key={c.hex}
              type="button"
              onClick={() => handlePickColor(c.hex)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-[11px] font-bold border transition ${
                activeColor.toLowerCase() === c.hex.toLowerCase() ? 'border-stone-800 bg-stone-100 shadow-xs ring-1 ring-stone-800' : 'border-stone-200 bg-white hover:bg-stone-50'
              }`}
            >
              <span className="w-3 h-3 rounded-full inline-block shadow-2xs" style={{ backgroundColor: c.hex }} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Icons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
        {ISLAMIC_ICONS.map(icon => {
          const isSelected = activeId === icon.id;
          return (
            <button
              key={icon.id}
              type="button"
              onClick={() => handlePickIcon(icon.id)}
              className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 border transition text-center cursor-pointer ${
                isSelected
                  ? 'bg-white shadow-sm'
                  : 'bg-white/60 hover:bg-white border-stone-200/80 hover:border-stone-300'
              }`}
              style={{
                borderColor: isSelected ? activeColor : undefined,
                boxShadow: isSelected ? `0 0 0 2px ${activeColor}33` : undefined
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center transition"
                style={{ backgroundColor: `${activeColor}${isSelected ? '22' : '10'}` }}
              >
                {icon.svg({ className: 'w-6 h-6', color: activeColor })}
              </div>
              <span className="text-[11px] font-bold text-stone-800 leading-tight">
                {icon.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

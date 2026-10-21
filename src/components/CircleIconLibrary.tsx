import React from 'react';

export interface CircleIconOption {
  id: string;
  name: string;
  symbol: string;
  category: string;
  meaning: string;
}

export const CIRCLE_ICONS: CircleIconOption[] = [
  // القرآن والترتيل
  { id: 'mushaf', name: 'مصحف الترتيل', symbol: '📖', category: 'القرآن والترتيل', meaning: 'مدارسة وتلاوة آيات الذكر الحكيم' },
  { id: 'rihal', name: 'رحل الحفظ', symbol: '🪑', category: 'القرآن والترتيل', meaning: 'مجلس مدارسة القرآن الكريم' },
  { id: 'scroll', name: 'صحيفة التمكين', symbol: '📜', category: 'القرآن والترتيل', meaning: 'رسوخ الحفظ وضبط المتشابهات' },
  { id: 'feather', name: 'ريشة الإتقان', symbol: '🪶', category: 'القرآن والترتيل', meaning: 'تدوين العلم وضبط التجويد' },
  { id: 'crown', name: 'تاج الوقار', symbol: '👑', category: 'القرآن والترتيل', meaning: 'يلبسه والدا حافظ القرآن يوم القيامة' },

  // النماء والبركة
  { id: 'ghaym', name: 'غيث البركة', symbol: '🌧️', category: 'النماء والبركة', meaning: 'الغيث الذي يحيي القلوب بالقرآن' },
  { id: 'plant', name: 'نبات الغيم', symbol: '🪴', category: 'النماء والبركة', meaning: 'نماء الغراس وتعهد الحفظ' },
  { id: 'palm', name: 'نخلة الرسوخ', symbol: '🌴', category: 'النماء والبركة', meaning: 'المؤمن كالنخلة ثابت الأصل باسق الفرع' },
  { id: 'flower', name: 'أترجة الإتقان', symbol: '🌸', category: 'النماء والبركة', meaning: 'المؤمن الذي يقرأ القرآن كالأترجة' },
  { id: 'basil', name: 'ريحان الحفظ', symbol: '🌿', category: 'النماء والبركة', meaning: 'الريحان الطيب العبق بآيات الله' },
  { id: 'rose', name: 'زهرة الإخلاص', symbol: '🌹', category: 'النماء والبركة', meaning: 'إخلاص النية لوجه الله تعالى' },

  // النور والضياء
  { id: 'siraj', name: 'سراج الهدى', symbol: '🕯️', category: 'النور والضياء', meaning: 'نور الوحي المضيء للدروب' },
  { id: 'lantern', name: 'فانوس النور', symbol: '🏮', category: 'النور والضياء', meaning: 'إشراقة الهمم وتوقد العزائم' },
  { id: 'hilal', name: 'هلال التمام', symbol: '🌙', category: 'النور والضياء', meaning: 'تجدد العهد مع كتاب الله' },
  { id: 'sun', name: 'شمس الضحى', symbol: '☀️', category: 'النور والضياء', meaning: 'وضوح البيان وتمام الرسوخ' },
  { id: 'minaret', name: 'مئذنة الصالحات', symbol: '🕌', category: 'النور والضياء', meaning: 'نداء الفلاح والارتقاء في الدرجات' },
  { id: 'mihrab', name: 'محراب التهجد', symbol: '🕋', category: 'النور والضياء', meaning: 'قيام الليل بالقرآن وترتيله' },

  // الفضل والسكينة
  { id: 'tasbih', name: 'سبحة الذكر', symbol: '📿', category: 'الفضل والسكينة', meaning: 'دوام الاستغفار والذكر' },
  { id: 'gem', name: 'درة الفردوس', symbol: '💎', category: 'الفضل والسكينة', meaning: 'نفاسة آيات القرآن وجواهره' },
  { id: 'dove', name: 'يمامة السكينة', symbol: '🕊️', category: 'الفضل والسكينة', meaning: 'تنزل السكينة وحفوف الملائكة بمجالس القرآن' },
  { id: 'star', name: 'نجمة الثريا', symbol: '⭐', category: 'الفضل والسكينة', meaning: 'علو الهمة والتسابق في الخيرات' },
  { id: 'heart', name: 'قلب سليم', symbol: '🤍', category: 'الفضل والسكينة', meaning: 'سلامة الصدر وصدق الإقبال' },
  { id: 'shield', name: 'درع التثبيت', symbol: '🛡️', category: 'الفضل والسكينة', meaning: 'حصانة الحفظ بالحفظ والمراجعة' }
];

interface CircleIconPickerProps {
  selectedIcon: string;
  onSelectIcon: (icon: string) => void;
}

export const CircleIconPicker: React.FC<CircleIconPickerProps> = ({ selectedIcon, onSelectIcon }) => {
  const [activeCategory, setActiveCategory] = React.useState<string>('الكل');

  const categories = ['الكل', 'القرآن والترتيل', 'النماء والبركة', 'النور والضياء', 'الفضل والسكينة'];

  const filteredIcons = activeCategory === 'الكل'
    ? CIRCLE_ICONS
    : CIRCLE_ICONS.filter(i => i.category === activeCategory);

  const currentIconObj = CIRCLE_ICONS.find(i => i.symbol === selectedIcon) || CIRCLE_ICONS[0];

  return (
    <div className="space-y-3 bg-[#FAF7F5] p-3.5 rounded-2xl border border-[#EFE8E2]">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-stone-800">
          اختاري أيقونة ورمز الحلقة المعتمد:
        </label>
        <span className="text-[11px] font-bold text-[#8E5364] flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-stone-200">
          <span className="text-base">{selectedIcon || '🪴'}</span>
          <span>{currentIconObj ? currentIconObj.name : 'أيقونة مخصصة'}</span>
        </span>
      </div>

      {/* Categories Tabs */}
      <div className="flex flex-wrap gap-1">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
              activeCategory === cat
                ? 'bg-[#8E5364] text-white shadow-2xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/60'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Icons */}
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto p-1 bg-white rounded-xl border border-stone-200/80">
        {filteredIcons.map(icon => {
          const isSelected = selectedIcon === icon.symbol;
          return (
            <button
              key={icon.id}
              type="button"
              onClick={() => onSelectIcon(icon.symbol)}
              title={`${icon.name}: ${icon.meaning}`}
              className={`p-2 rounded-xl text-center transition flex flex-col items-center justify-center cursor-pointer ${
                isSelected
                  ? 'bg-[#FAF0F3] border-2 border-[#8E5364] scale-105 shadow-xs'
                  : 'hover:bg-stone-50 border border-transparent hover:border-stone-200'
              }`}
            >
              <span className="text-xl select-none">{icon.symbol}</span>
              <span className="text-[9px] text-stone-500 font-medium truncate w-full mt-0.5">
                {icon.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom Write-in or Paste Emoji Option */}
      <div className="flex items-center gap-2 pt-1 border-t border-stone-200/60 text-xs">
        <span className="text-[11px] text-stone-500">أو رمزا يدويا:</span>
        <input
          type="text"
          value={selectedIcon}
          onChange={e => onSelectIcon(e.target.value)}
          placeholder="ألصقي أي رمز هنا..."
          className="w-24 px-2 py-1 text-center text-sm font-bold border border-stone-200 rounded-lg bg-white"
        />
        <span className="text-[10px] text-stone-400">مثال: 🪴 أو 🌸 أو 📖</span>
      </div>
    </div>
  );
};

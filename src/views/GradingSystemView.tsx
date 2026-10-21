import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sliders, Plus, Edit, Save, Calculator, CheckCircle2,
  AlertCircle, Shield, Award, Check
} from 'lucide-react';
import { GradingItemConfig, TrackGradingConfig } from '../types';

export const GradingSystemView: React.FC = () => {
  const {
    gradingConfigs, tracks, updateGradingConfig, currentUser
  } = useApp();

  const [selectedTrackId, setSelectedTrackId] = useState<string>(tracks[0]?.id || 't-1');
  const currentConfig = gradingConfigs.find(g => g.trackId === selectedTrackId) || gradingConfigs[0];

  // Local editable state for config
  const [configState, setConfigState] = useState<TrackGradingConfig>(currentConfig);

  React.useEffect(() => {
    if (currentConfig) {
      setConfigState(JSON.parse(JSON.stringify(currentConfig)));
    }
  }, [currentConfig, selectedTrackId]);

  // Modal for adding a custom grading item
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [customItemForm, setCustomItemForm] = useState<Partial<GradingItemConfig>>({
    name: '',
    category: 'custom',
    maxScore: 10,
    weightPercentage: 5,
    isMandatory: false,
    includesInFinalGrade: true,
    description: ''
  });

  const handleSaveConfig = async () => {
    await updateGradingConfig(selectedTrackId, configState);
  };

  const handleUpdateItem = (itemId: string, field: keyof GradingItemConfig, value: any) => {
    const updatedItems = configState.items.map(item => {
      if (item.id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setConfigState({ ...configState, items: updatedItems });
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemForm.name?.trim()) return;

    const newItem: GradingItemConfig = {
      id: `gi-${Date.now()}`,
      code: `custom_${Date.now()}`,
      name: customItemForm.name,
      category: 'custom',
      maxScore: Number(customItemForm.maxScore || 10),
      weightPercentage: Number(customItemForm.weightPercentage || 5),
      isMandatory: !!customItemForm.isMandatory,
      includesInFinalGrade: !!customItemForm.includesInFinalGrade,
      description: customItemForm.description || ''
    };

    setConfigState({
      ...configState,
      items: [...configState.items, newItem]
    });
    setCustomItemModalOpen(false);
  };

  const totalWeights = configState.items
    .filter(i => i.includesInFinalGrade)
    .reduce((acc, i) => acc + (Number(i.weightPercentage) || 0), 0);

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">⚖️</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">نظام الدرجات والنسب المئوية والمعايير</h2>
          </div>
          <p className="text-xs text-stone-500">
            تخصيص بنود التقييم، الأوزان النسبية، معادلات خصومات التسميع، وضوابط احتساب النسبة النهائية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCustomItemModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF6F2] hover:bg-[#F2ECE6] text-[#744251] border border-[#E2D5CC] rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة بند تقييم مخصص</span>
          </button>
          <button
            onClick={handleSaveConfig}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات في النظام</span>
          </button>
        </div>
      </div>

      {/* Calculation Method Selection */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
        <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#8E5364]" />
          <span>طريقة احتساب النسبة المئوية للمسار:</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
            configState.calculationMethod === 'weighted_percentage'
              ? 'border-[#8E5364] bg-[#FAF3F5]'
              : 'border-stone-200 bg-white hover:border-stone-300'
          }`}>
            <input
              type="radio"
              name="calcMethod"
              checked={configState.calculationMethod === 'weighted_percentage'}
              onChange={() => setConfigState({ ...configState, calculationMethod: 'weighted_percentage' })}
              className="mt-1 text-[#8E5364]"
            />
            <div>
              <div className="font-bold text-stone-900 text-xs sm:text-sm">
                نظام الأوزان والنسب المئوية الموزونة (موصى به)
              </div>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                تحدد الإدارة نسبة كل بند من الدرجة النهائية (مثلاً: ٢٥٪ للحفظ، ١٥٪ للاختبار، ١٠٪ للتجويد، إلخ) بحيث يكون المجموع ١٠٠٪.
              </p>
            </div>
          </label>

          <label className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
            configState.calculationMethod === 'points_ratio'
              ? 'border-[#8E5364] bg-[#FAF3F5]'
              : 'border-stone-200 bg-white hover:border-stone-300'
          }`}>
            <input
              type="radio"
              name="calcMethod"
              checked={configState.calculationMethod === 'points_ratio'}
              onChange={() => setConfigState({ ...configState, calculationMethod: 'points_ratio' })}
              className="mt-1 text-[#8E5364]"
            />
            <div>
              <div className="font-bold text-stone-900 text-xs sm:text-sm">
                مجموع النقاط المكتسبة / مجموع النقاط الممكنة
              </div>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                حساب النسبة بقسمة إجمالي النقاط التي حصدتها الطالبة على إجمالي النقاط المتاحة لجميع البنود مباشرة.
              </p>
            </div>
          </label>
        </div>

        {configState.calculationMethod === 'weighted_percentage' && (
          <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between ${
            totalWeights === 100
              ? 'bg-[#EBF3EE] text-[#2D5A43] border border-[#CDE0D4]'
              : 'bg-amber-50 text-amber-900 border border-amber-200'
          }`}>
            <span>مجموع أوزان البنود المفعلة: <strong>{totalWeights}%</strong></span>
            <span>{totalWeights === 100 ? '✅ الأوزان متطابقة تماماً مع ١٠٠٪' : '⚠️ يرجى ضبط الأوزان لتساوي ١٠٠٪'}</span>
          </div>
        )}
      </div>

      {/* Recitation Deduction Formula Settings */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
        <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#8E5364]" />
          <span>معادلة تقييم جلسة التسميع والخصومات التلقائية:</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">الدرجة الأساسية</label>
            <input
              type="number"
              value={configState.recitationFormula.baseGrade}
              onChange={e => setConfigState({
                ...configState,
                recitationFormula: { ...configState.recitationFormula, baseGrade: Number(e.target.value) }
              })}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-xl text-center font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-rose-800 mb-1">خصم خطأ الحفظ</label>
            <input
              type="number"
              step="0.1"
              value={configState.recitationFormula.deductionPerMistake}
              onChange={e => setConfigState({
                ...configState,
                recitationFormula: { ...configState.recitationFormula, deductionPerMistake: Number(e.target.value) }
              })}
              className="w-full px-2.5 py-1.5 border border-rose-200 rounded-xl text-center font-bold text-rose-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-amber-800 mb-1">خصم التنبيه</label>
            <input
              type="number"
              step="0.05"
              value={configState.recitationFormula.deductionPerHint}
              onChange={e => setConfigState({
                ...configState,
                recitationFormula: { ...configState.recitationFormula, deductionPerHint: Number(e.target.value) }
              })}
              className="w-full px-2.5 py-1.5 border border-amber-200 rounded-xl text-center font-bold text-amber-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-purple-800 mb-1">خصم خطأ التجويد</label>
            <input
              type="number"
              step="0.05"
              value={configState.recitationFormula.deductionPerTajweedError}
              onChange={e => setConfigState({
                ...configState,
                recitationFormula: { ...configState.recitationFormula, deductionPerTajweedError: Number(e.target.value) }
              })}
              className="w-full px-2.5 py-1.5 border border-purple-200 rounded-xl text-center font-bold text-purple-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">الحد الأعلى للخصم</label>
            <input
              type="number"
              value={configState.recitationFormula.maxDeduction}
              onChange={e => setConfigState({
                ...configState,
                recitationFormula: { ...configState.recitationFormula, maxDeduction: Number(e.target.value) }
              })}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-xl text-center"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">الحد الأدنى للدرجة</label>
            <input
              type="number"
              value={configState.recitationFormula.minGrade}
              onChange={e => setConfigState({
                ...configState,
                recitationFormula: { ...configState.recitationFormula, minGrade: Number(e.target.value) }
              })}
              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-xl text-center"
            />
          </div>
        </div>
      </div>

      {/* Grading Items Table */}
      <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h4 className="font-bold text-stone-800 text-sm">
            بنود الدرجات المستقلة وتوزيع الأوزان ({configState.items.length} بنود)
          </h4>
          <span className="text-xs text-stone-500">
            يمكن تعديل أوزان البنود وإدخالها أو استبعادها من النسبة الشهرية
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                <th className="p-3.5">البند</th>
                <th className="p-3.5">الوصف والشروط</th>
                <th className="p-3.5 text-center">الدرجة القصوى</th>
                <th className="p-3.5 text-center">الوزن النسبي (%)</th>
                <th className="p-3.5 text-center">إلزامي؟</th>
                <th className="p-3.5 text-center">يدخل في النسبة النهائية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {configState.items.map(item => (
                <tr key={item.id} className="hover:bg-[#FCF9FA] transition">
                  <td className="p-3.5 font-bold text-stone-900 text-sm">
                    {item.name}
                  </td>
                  <td className="p-3.5 text-stone-500 text-[11px] max-w-xs">
                    {item.description}
                  </td>
                  <td className="p-3.5 text-center">
                    <input
                      type="number"
                      min="1"
                      value={item.maxScore}
                      onChange={e => handleUpdateItem(item.id, 'maxScore', Number(e.target.value))}
                      className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-center text-xs font-bold"
                    />
                  </td>
                  <td className="p-3.5 text-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={item.weightPercentage}
                      onChange={e => handleUpdateItem(item.id, 'weightPercentage', Number(e.target.value))}
                      className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-center text-xs font-bold text-[#8E5364]"
                    />
                  </td>
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={item.isMandatory}
                      onChange={e => handleUpdateItem(item.id, 'isMandatory', e.target.checked)}
                      className="rounded text-[#8E5364]"
                    />
                  </td>
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={item.includesInFinalGrade}
                      onChange={e => handleUpdateItem(item.id, 'includesInFinalGrade', e.target.checked)}
                      className="rounded text-[#8E5364]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade Scale (التقديرات النهائية) */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
        <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
          <Award className="w-4 h-4 text-[#8E5364]" />
          <span>سلم التقديرات والرموز المعتمدة:</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {configState.gradeScale.map(scale => (
            <div key={scale.minPercentage} className="p-3 rounded-2xl border border-stone-200 bg-[#FCFAF8] flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-stone-900 block">{scale.label} ({scale.letter})</span>
                <span className="text-[10px] text-stone-400">من {scale.minPercentage}% فأعلى</span>
              </div>
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: scale.color }}></span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Item Modal */}
      {customItemModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-3">
              إضافة بند درجات مخصص جديد
            </h3>
            <form onSubmit={handleAddCustomItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اسم البند</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: النشاط الصيفي، مسابقة التلاوة..."
                  value={customItemForm.name}
                  onChange={e => setCustomItemForm({ ...customItemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الدرجة القصوى</label>
                  <input
                    type="number"
                    min="1"
                    value={customItemForm.maxScore}
                    onChange={e => setCustomItemForm({ ...customItemForm, maxScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الوزن النسبي (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={customItemForm.weightPercentage}
                    onChange={e => setCustomItemForm({ ...customItemForm, weightPercentage: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الوصف والشروط</label>
                <textarea
                  rows={2}
                  value={customItemForm.description}
                  onChange={e => setCustomItemForm({ ...customItemForm, description: e.target.value })}
                  placeholder="وصف معايير استحقاق الدرجة..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomItemModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251]"
                >
                  إضافة البند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

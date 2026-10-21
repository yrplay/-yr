import React from 'react';

interface OfficialSealProps {
  institutionName?: string;
  sealText?: string;
  sealSubtitle?: string;
  sealImageUrl?: string;
  leaderName?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const OfficialSeal: React.FC<OfficialSealProps> = ({
  institutionName = 'غيث الغيم',
  sealText = 'ختم الاعتماد الرسمي',
  sealSubtitle = 'معتمد للعام ١٤٤٦هـ',
  sealImageUrl,
  leaderName = 'ريفة المنصوري',
  color = '#8E5364',
  size = 'md',
  className = ''
}) => {
  const sizeMap = {
    sm: 'w-24 h-24 text-[9px]',
    md: 'w-32 h-32 text-[10px]',
    lg: 'w-40 h-40 text-xs'
  };

  if (sealImageUrl) {
    return (
      <div className={`relative inline-flex items-center justify-center p-1 ${className}`}>
        <img
          src={sealImageUrl}
          alt="ختم الاعتماد الرسمي"
          className={`${sizeMap[size].split(' ')[0]} ${sizeMap[size].split(' ')[1]} object-contain drop-shadow-xs rotate-[-3deg] mix-blend-multiply`}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center rounded-full border-2 border-dashed p-2 text-center rotate-[-3deg] transition select-none ${sizeMap[size]} ${className}`}
      style={{
        borderColor: color,
        color: color,
        backgroundColor: `${color}06`
      }}
    >
      {/* Outer decorative ring */}
      <div
        className="absolute inset-1 rounded-full border border-solid pointer-events-none opacity-80"
        style={{ borderColor: color }}
      />
      <div
        className="absolute inset-2.5 rounded-full border border-dotted pointer-events-none opacity-60"
        style={{ borderColor: color }}
      />

      {/* Top text */}
      <span className="font-bold tracking-tight opacity-90 text-[10px] leading-tight">
        {sealText}
      </span>

      {/* Middle Brand in Amiri calligraphy */}
      <span
        className="font-bold font-quran text-base sm:text-lg my-0.5 tracking-wide leading-tight drop-shadow-2xs"
        style={{ color: color }}
      >
        مقرأة {institutionName}
      </span>

      {/* Leader & Date */}
      <span className="font-medium text-[9px] opacity-80 leading-tight">
        {leaderName}
      </span>
      <span className="text-[8px] opacity-70 font-mono mt-0.5">
        {sealSubtitle}
      </span>
    </div>
  );
};

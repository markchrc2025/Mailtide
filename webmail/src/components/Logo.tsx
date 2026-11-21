export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M3.5 8.5l8.5 6 8.5-6" fill="none" stroke="#F2ECE4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 17c2.6-2.3 5.2-2.3 7.8 0s5.2 2.3 7.8 0" fill="none" stroke="#F2ECE4" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      <circle cx="19.2" cy="5" r="2.6" fill="#E8693A" />
    </svg>
  );
}

export function Brand({ tagline = "by Sentire", big = false }: { tagline?: string; big?: boolean }) {
  const box = big ? 44 : 40;
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="tile flex items-center justify-center rounded-[11px]" style={{ width: box, height: box }}>
        <LogoMark size={big ? 26 : 24} />
      </div>
      <div className="flex flex-col leading-tight">
        <b className={`font-head font-semibold tracking-tight text-white ${big ? "text-[19px]" : "text-base"}`}>MailTide</b>
        <span className={`${big ? "text-xs" : "text-[11px] tracking-wide"} text-espresso-dim`}>{tagline}</span>
      </div>
    </div>
  );
}

export function Spark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8z" fill="#E8693A" />
    </svg>
  );
}

// A frosted "liquid glass" button — plain JS + Tailwind, no extra dependencies.
export default function GlassButton({ children, onClick, type = 'button', glow = 'blue', className = '' })
{
  const glowRing =
    glow === 'green' ? 'hover:shadow-[0_0_24px_rgba(34,197,94,0.45)]'
    : glow === 'red' ? 'hover:shadow-[0_0_24px_rgba(239,68,68,0.45)]'
    : 'hover:shadow-[0_0_24px_rgba(59,130,246,0.45)]';

  return (
    <button
      type={type}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center gap-2 rounded-full px-8 py-3
        text-sm font-semibold text-white
        bg-white/10 backdrop-blur-md
        border border-white/20
        shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_24px_rgba(0,0,0,0.35)]
        transition-all duration-300
        hover:bg-white/15 hover:scale-[1.03] active:scale-95
        ${glowRing} ${className}`}
    >
      {/* subtle top sheen */}
      <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      {children}
    </button>
  );
}
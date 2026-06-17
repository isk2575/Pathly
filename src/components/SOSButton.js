import { useState, useRef } from 'react';

export default function SOSButton({ isNavigating = false }) {
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  const handlePressStart = () => {
    setPressing(true);
    let prog = 0;
    intervalRef.current = setInterval(() => {
      prog += 5;
      setProgress(prog);
      if (prog >= 100) {
        clearInterval(intervalRef.current);
        triggerSOS();
      }
    }, 100);
  };

  const handlePressEnd = () => {
    setPressing(false);
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const triggerSOS = () => {
    setPressing(false);
    setProgress(0);
    window.location.href = 'tel:911';
  };

  // During navigation, sit just above the bottom card on the left (mirrors the
  // Recenter button on the right). Otherwise, the big centered button.
  const containerClass = isNavigating
    ? 'absolute bottom-full mb-5 left-4 flex flex-col items-center gap-1 z-30'
    : 'absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10';

  const buttonClass = isNavigating
    ? 'relative w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-900/50 flex items-center justify-center select-none'
    : 'relative w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xl shadow-lg shadow-red-900/50 flex items-center justify-center select-none';

  return (
    <div className={containerClass}>

      {/* Hold instruction — only on the main screen, hidden in nav to save space */}
      {!isNavigating && (
        <p className="text-white text-xs font-medium relative">
          <span className="absolute -inset-1 rounded-lg animate-pulse bg-red-600/30 blur-sm" />
          <span className="relative">Hold 2 seconds to activate SOS</span>
        </p>
      )}

      {/* SOS Button */}
      <button
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        className={buttonClass}
        style={{
          background: pressing
            ? `conic-gradient(white ${progress * 3.6}deg, #dc2626 0deg)`
            : '#dc2626',
        }}
      >
        <span className="relative z-10">SOS</span>

        {/* Pulse ring */}
        <span className="absolute inset-2 rounded-full animate-ping bg-red-600/20" />
      </button>
    </div>
  );
}
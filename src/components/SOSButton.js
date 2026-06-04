import { useState } from 'react';

export default function SOSButton() {
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);

  let interval = null;

  const handlePressStart = () => {
    setPressing(true);
    let prog = 0;
    interval = setInterval(() => {
      prog += 5;
      setProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        triggerSOS();
      }
    }, 100);
  };

  const handlePressEnd = () => {
    setPressing(false);
    setProgress(0);
    clearInterval(interval);
  };

  const triggerSOS = () => {
    setPressing(false);
    setProgress(0);
    window.location.href = 'tel:911';
  };

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
      
      {/* Hold instruction */}
      <p className="text-white text-xs font-medium opacity-70">
        Hold 2 seconds to activate SOS
      </p>

      {/* SOS Button */}
      <button
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        className="relative w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xl shadow-lg shadow-red-900/50 flex items-center justify-center select-none"
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
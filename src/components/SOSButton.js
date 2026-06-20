import { useState, useRef } from 'react';

export default function SOSButton({ isNavigating = false, inline = false }) {
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

  // Clean look: dark circle, thin red ring, red "SOS", fills red while held.
  //  - inline:        lives inside the mobile bottom stack (no absolute positioning)
  //  - isNavigating:  compact, pinned above the nav card
  //  - default:       big, centered (desktop main screen)
  let containerClass;
  if (inline)
  {
    containerClass = 'flex flex-col items-center gap-1';
  }
  else if (isNavigating)
  {
    containerClass = 'absolute bottom-full mb-5 left-4 flex flex-col items-center gap-1 z-30';
  }
  else
  {
    containerClass = 'absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10';
  }

  const sizeClass = isNavigating ? 'w-16 h-16 text-sm' : 'w-20 h-20 text-lg';

  return (
    <div className={containerClass}>
      <button
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        className={`relative ${sizeClass} rounded-full border flex flex-col items-center justify-center select-none transition-colors`}
        style={{
          borderColor: 'rgba(239,68,68,0.5)',
          background: pressing
            ? `conic-gradient(#dc2626 ${progress * 3.6}deg, #171717 0deg)`
            : '#171717',
        }}
      >
        <span className="relative z-10 text-red-500 font-extrabold leading-none">SOS</span>
        {!isNavigating && (
          <span className="relative z-10 text-neutral-500 mt-1 leading-tight text-center" style={{ fontSize: 9 }}>
            Hold to<br />activate
          </span>
        )}
      </button>
    </div>
  );
}
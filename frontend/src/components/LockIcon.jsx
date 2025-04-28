// src/components/LockIcon.jsx
import React, { useState } from 'react';

export const LockIcon = () => {
  const [mode, setMode] = useState(0);          // 0 = ±10%, 1 = manual scale
  const handleClick = () => setMode((m) => (m + 1) % 2);
  const color =
    mode === 1 ? 'text-yellow-400'
    : 'text-text-secondary';

  const num = mode === 0 ? 'Auto' : 'Mode1';       

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      className={`w-80 h-0 select-none cursor-pointer transition-colors duration-200 outline-none focus:outline-none ${color}`}
    >
      {num}
    </span>
  );
};

export default LockIcon;

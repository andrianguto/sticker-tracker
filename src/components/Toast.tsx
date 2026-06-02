import React from 'react';

interface ToastProps {
  msg: string;
}

export const Toast: React.FC<ToastProps> = ({ msg }) => {
  if (!msg) return null;
  return (
    <div className="toast">
      <span className="ic">✓</span>
      {msg}
    </div>
  );
};

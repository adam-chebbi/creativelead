import React from 'react';

export const Spinner: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className = '', ...props }) => (
  <span className={`spinner ${className}`} {...props} />
);

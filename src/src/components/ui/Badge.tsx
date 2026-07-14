import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'navbar' | 'format' | 'review-count';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'navbar', children, className = '', ...props }) => {
  const baseClass = variant === 'navbar' ? 'navbar-badge' 
                  : variant === 'format' ? 'format-badge' 
                  : 'review-count-chip';
  
  return (
    <span className={`${baseClass} ${className}`} {...props}>
      {children}
    </span>
  );
};

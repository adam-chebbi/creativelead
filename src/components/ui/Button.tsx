import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, 'ref'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', loading, children, className = '', ...props }) => {
  return (
    <motion.button
      className={`btn btn-${variant} btn-${size} ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="spinner" />
          <span style={{ opacity: 0.7 }}>{children as React.ReactNode}</span>
        </motion.div>
      ) : (
        children
      )}
    </motion.button>
  );
};

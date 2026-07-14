import React from 'react';
import { motion } from 'framer-motion';
import { AlertIcon } from '@/components/icons';

export interface ImportErrorsListProps {
  errors: string[];
}

export const ImportErrorsList: React.FC<ImportErrorsListProps> = ({ errors }) => {
  if (errors.length === 0) return null;

  return (
    <motion.div 
      className="section section-alert" 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="alert alert-error">
        <AlertIcon />
        <div className="alert-content">
          <strong>{errors.length} validation issue{errors.length > 1 ? 's' : ''}</strong>
          <ul className="alert-list">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i} className="alert-list-item">{e}</li>
            ))}
            {errors.length > 5 && <li className="alert-list-more">…and {errors.length - 5} more</li>}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

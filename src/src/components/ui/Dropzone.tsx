import React from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import { motion } from 'framer-motion';
import { UploadIcon } from '@/components/icons';

export interface DropzoneProps extends DropzoneOptions {
  className?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({ className = '', ...props }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone(props);

  return (
    <motion.div
      {...(getRootProps() as any)}
      className={`dropzone-wrapper ${isDragActive ? 'drag-active' : ''} ${className}`}
      aria-label="File upload dropzone"
      animate={{ scale: isDragActive ? 1.02 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <input {...getInputProps()} />
      <motion.div 
        className="dropzone-icon"
        animate={isDragActive ? { y: [0, -5, 0], scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1 }}
      >
        <UploadIcon />
      </motion.div>
      {isDragActive ? (
        <p className="dropzone-title">Drop your file here…</p>
      ) : (
        <>
          <p className="dropzone-title">
            Drag & drop or <span style={{ color: 'var(--color-primary-light)', cursor: 'pointer' }}>browse file</span>
          </p>
          <p className="dropzone-subtitle">Exported from the CreativeLead extension</p>
        </>
      )}
      <div className="format-badges">
        <span className="format-badge">.json</span>
      </div>
    </motion.div>
  );
};

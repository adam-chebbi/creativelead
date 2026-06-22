import React from 'react';
import { FileQuestion, FolderOpen, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon = FolderOpen, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed" style={{ borderColor: '#1e3232', background: '#0a1414' }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: '#111c1c' }}>
        <Icon className="w-6 h-6 text-[#6a9090]" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-sm text-[#6a9090] max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

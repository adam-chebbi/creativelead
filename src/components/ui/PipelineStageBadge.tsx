import React from 'react';
import { motion } from 'framer-motion';
import { PipelineStage } from '@/types';
import { Badge } from './Badge';

export const PIPELINE_STAGES: PipelineStage[] = [
  'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export const STAGE_CLASS: Record<PipelineStage, string> = {
  new: 'pipeline-stage-new',
  contacted: 'pipeline-stage-contacted',
  qualified: 'pipeline-stage-qualified',
  proposal: 'pipeline-stage-proposal',
  negotiation: 'pipeline-stage-negotiation',
  won: 'pipeline-stage-won',
  lost: 'pipeline-stage-lost',
};

export interface PipelineStageBadgeProps {
  stage: PipelineStage;
  animate?: boolean;
}

export const PipelineStageBadge: React.FC<PipelineStageBadgeProps> = ({ stage, animate }) => {
  const badge = <span className={`pipeline-stage ${STAGE_CLASS[stage]}`}>{STAGE_LABELS[stage]}</span>;
  if (animate) {
    return (
      <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
        {badge}
      </motion.span>
    );
  }
  return badge;
};
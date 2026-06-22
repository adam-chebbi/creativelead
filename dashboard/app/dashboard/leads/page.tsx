'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLeads, getLeadFilters, bulkStageLeads, bulkDeleteLeads, updateLead, deleteLead } from '@/lib/api';
import { stageColor, timeAgo } from '@/lib/utils';
import { ExternalLink, Star, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { LeadDetailPanel } from '@/components/LeadDetailPanel';
const STAGES = ['New','Contacted','Replied','Closed','Unsubscribed'];
export default function LeadsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [stage, setStage] = useState('');
  const [hasEmail, setHasEmail] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const [bulkStage, setBulkStage] = useState('');
  const [viewLeadId, setViewLeadId] = useState(null);
  const filters = useQuery({ queryKey: ['lead-filters'], queryFn: getLeadFilters });
  const params = { page, limit: 50, sortBy, sortDir };
  const { data, refetch } = useQuery({ queryKey: ['leads', params], queryFn: () => getLeads(params) });
  const leads = data?.data ?? [];
  const pagination = data?.pagination;
  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return;
    await deleteLead(id); refetch();
  };
  return (
    <div className="p-8">
      <div>working</div>
    </div>
  );
}

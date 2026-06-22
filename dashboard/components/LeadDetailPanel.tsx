'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLead, updateLead } from '@/lib/api';
import { stageColor, timeAgo } from '@/lib/utils';
import { X, Star, ExternalLink, Check } from 'lucide-react';
import { Lead } from '@/lib/types';

interface LeadDetailPanelProps {
  leadId: string | null;
  onClose: () => void;
}

const STAGES = ['New','Contacted','Replied','Closed','Unsubscribed'];

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="1em" height="1em"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
);

export function LeadDetailPanel({ leadId, onClose }: LeadDetailPanelProps) {
  const [showReviews, setShowReviews] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: lead, refetch } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => getLead(leadId!),
    enabled: !!leadId,
  });

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || '');
      setShowReviews(false);
    }
  }, [lead]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!leadId) return null;

  const handleStageChange = async (stage: string) => {
    await updateLead(leadId, { stage }); 
    refetch();
  };

  const handleNotesSave = async () => {
    setSaving(true);
    await updateLead(leadId, { notes });
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div 
        className="fixed inset-y-0 right-0 w-[500px] shadow-2xl z-50 flex flex-col transition-transform"
        style={{ background: '#0a1414', borderLeft: '1px solid #1e3232' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#1e3232' }}>
          <h2 className="text-lg font-bold text-white">Lead Details</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#1e3232] text-[#6a9090] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!lead ? (
          <div className="p-8 text-center text-[#6a9090]">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            <div className="p-5 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">{lead.name}</h1>
                  <p className="text-[#6a9090] text-sm mt-1">{lead.category}</p>
                  {lead.rating && <p className="text-sm mt-2 flex items-center gap-1"><Star className="w-4 h-4" fill="currentColor" /> {lead.rating} <span className="text-[#6a9090]">({lead.reviewCount} reviews)</span></p>}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs border ${stageColor(lead.stage)}`}>{lead.stage}</span>
              </div>
              {lead.googleMapsUrl && (
                <a href={lead.googleMapsUrl} target="_blank" rel="noreferrer" className="text-xs text-[#4ecdc4] hover:underline mt-3 inline-flex items-center gap-1"><GoogleIcon /> View on Google Maps <ExternalLink className="w-3 h-3" /></a>
              )}
            </div>

            <div className="p-5 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <h2 className="text-white font-semibold mb-3">Contact Information</h2>
              <div className="space-y-2 text-sm">
                {lead.address  && <p className="flex"><span className="text-[#6a9090] w-24 shrink-0">Address</span><span className="text-white">{lead.address}</span></p>}
                {lead.phone    && <p className="flex"><span className="text-[#6a9090] w-24 shrink-0">Phone</span><a href={`tel:${lead.phone}`} className="text-[#4ecdc4]">{lead.phone}</a></p>}
                {lead.website  && <p className="flex"><span className="text-[#6a9090] w-24 shrink-0">Website</span><a href={lead.website} target="_blank" rel="noreferrer" className="text-[#4ecdc4] truncate max-w-[280px]">{lead.website}</a></p>}
                {lead.email    && <p className="flex"><span className="text-[#6a9090] w-24 shrink-0">Email</span><span className="text-white">{lead.email}</span></p>}
              </div>
            </div>

            <div className="p-5 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <h2 className="text-white font-semibold mb-3">Pipeline Stage</h2>
              <select value={lead.stage} onChange={e => handleStageChange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#111c1c', border: '1px solid #1e3232' }}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="p-5 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-white font-semibold">Notes</h2>
                {saving && <span className="text-xs text-[#6a9090]">Saving...</span>}
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNotesSave}
                rows={3} placeholder="Add notes about this lead..."
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
                style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
            </div>

            {lead.openingHours && Object.keys(lead.openingHours).length > 0 && (
              <div className="p-5 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
                <h2 className="text-white font-semibold mb-3">Opening Hours</h2>
                <div className="space-y-1 text-sm">
                  {Object.entries(lead.openingHours).map(([day, time]) => (
                    <div key={day} className="flex justify-between">
                      <span className="text-[#6a9090]">{day}</span>
                      <span className="text-white">{time as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-5 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold">Reviews <span className="text-[#6a9090] text-sm">({lead._count?.reviews ?? 0})</span></h2>
                {!showReviews && lead._count?.reviews > 0 && (
                  <button onClick={() => setShowReviews(true)} className="text-sm text-[#4ecdc4] hover:underline">Show Reviews</button>
                )}
              </div>
              {showReviews && lead.reviews?.map((r: any) => (
                <div key={r.id} className="py-3 border-t first:border-0 first:pt-0" style={{ borderColor: '#1e3232' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-medium">{r.authorName}</span>
                    <span className="text-[#6a9090] text-xs">{r.publishedAt}</span>
                  </div>
                  {r.rating && <p className="text-xs mb-1 flex items-center">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 text-yellow-400" fill="currentColor" />)}</p>}
                  {r.text && <p className="text-[#6a9090] text-sm leading-relaxed">{r.text}</p>}
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </>
  );
}

'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLead, updateLead } from '@/lib/api';
import { stageColor, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Star, ExternalLink } from 'lucide-react';

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="1em" height="1em"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
);
import Link from 'next/link';

const STAGES = ['New','Contacted','Replied','Closed','Unsubscribed'];

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const { data: lead, refetch } = useQuery({ queryKey: ['lead', params.id], queryFn: () => getLead(params.id) });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showReviews, setShowReviews] = useState(false);

  if (!lead) return <div className="p-8 text-[#6a9090]">Loading...</div>;

  const handleStageChange = async (stage: string) => {
    await updateLead(params.id, { stage }); refetch();
  };

  const handleNotesSave = async () => {
    setSaving(true);
    await updateLead(params.id, { notes });
    setSaving(false);
  };

  const hours = lead.openingHours as Record<string, string> | null;
  const attrs = lead.attributes as string[] | null;

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/dashboard/leads" className="text-sm text-[#6a9090] hover:text-white mb-6 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to Leads</Link>

      {/* Header */}
      <div className="p-6 rounded-xl border mb-4" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{lead.name}</h1>
            <p className="text-[#6a9090] text-sm mt-1">{lead.category}</p>
            {lead.rating && <p className="text-sm mt-2 flex items-center gap-1"><Star className="w-4 h-4" fill="currentColor" /> {lead.rating} <span className="text-[#6a9090]">({lead.reviewCount} reviews)</span></p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs border ${stageColor(lead.stage)}`}>{lead.stage}</span>
        </div>
        {lead.googleMapsUrl && (
          <a href={lead.googleMapsUrl} target="_blank" rel="noreferrer" className="text-xs text-[#4ecdc4] hover:underline mt-3 inline-flex items-center gap-1"><GoogleIcon /> View on Google Maps <ExternalLink className="w-3 h-3" /></a>
        )}
      </div>

      {/* Contact */}
      <div className="p-6 rounded-xl border mb-4" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">Contact Information</h2>
        <div className="space-y-2 text-sm">
          {lead.address  && <p><span className="text-[#6a9090] w-20 inline-block">Address</span><span className="text-white">{lead.address}</span></p>}
          {lead.phone    && <p><span className="text-[#6a9090] w-20 inline-block">Phone</span><a href={`tel:${lead.phone}`} className="text-[#4ecdc4]">{lead.phone}</a></p>}
          {lead.website  && <p><span className="text-[#6a9090] w-20 inline-block">Website</span><a href={lead.website} target="_blank" rel="noreferrer" className="text-[#4ecdc4]">{lead.website}</a></p>}
          {lead.email    && <p><span className="text-[#6a9090] w-20 inline-block">Email</span><span className="text-white">{lead.email}</span></p>}
        </div>
      </div>

      {/* Stage */}
      <div className="p-6 rounded-xl border mb-4" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">Pipeline Stage</h2>
        <select value={lead.stage} onChange={e => handleStageChange(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#111c1c', border: '1px solid #1e3232' }}>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Notes */}
      <div className="p-6 rounded-xl border mb-4" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">Notes</h2>
        <textarea defaultValue={lead.notes ?? ''} onChange={e => setNotes(e.target.value)} onBlur={handleNotesSave}
          rows={4} placeholder="Add notes about this lead..."
          className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none resize-none"
          style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
        {saving && <p className="text-xs text-[#6a9090] mt-1">Saving...</p>}
      </div>

      {/* Hours */}
      {hours && Object.keys(hours).length > 0 && (
        <div className="p-6 rounded-xl border mb-4" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
          <h2 className="text-white font-semibold mb-4">Opening Hours</h2>
          <div className="space-y-1">
            {Object.entries(hours).map(([day, time]) => (
              <div key={day} className="flex justify-between text-sm">
                <span className="text-[#6a9090] w-28">{day}</span>
                <span className="text-white">{time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attributes */}
      {attrs && attrs.length > 0 && (
        <div className="p-6 rounded-xl border mb-4" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
          <h2 className="text-white font-semibold mb-4">Attributes</h2>
          <div className="flex flex-wrap gap-2">
            {attrs.map(a => (
              <span key={a} className="px-3 py-1 rounded-full text-xs border" style={{ borderColor: '#1e3232', color: '#4ecdc4' }}>{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Reviews <span className="text-[#6a9090] text-sm">({lead._count?.reviews ?? 0})</span></h2>
          {!showReviews && lead._count?.reviews > 0 && (
            <button onClick={() => setShowReviews(true)} className="text-sm text-[#4ecdc4] hover:underline">Load Reviews</button>
          )}
        </div>
        {showReviews && lead.reviews?.map((r: any) => (
          <div key={r.id} className="py-4 border-t" style={{ borderColor: '#1e3232' }}>
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
  );
}

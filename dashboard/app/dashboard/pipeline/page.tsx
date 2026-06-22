'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPipeline, updateLead } from '@/lib/api';
import type { Lead, PipelineData } from '@/lib/types';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Check, Star, ArrowRight } from 'lucide-react';

const STAGES = ['New','Contacted','Replied','Closed'];
const STAGE_COLORS: Record<string,string> = {
  New: '#4ecdc4', Contacted: '#3b82f6', Replied: '#f59e0b', Closed: '#22c55e',
};

function KanbanCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id, data: { lead } });
  const style = transform ? { transform: `translate(${transform.x}px,${transform.y}px)`, opacity: isDragging ? 0.4 : 1 } : {};
  return (
    <div ref={setNodeRef} style={{ ...style, background: '#111c1c', borderColor: '#1e3232' }} {...listeners} {...attributes} className="p-4 rounded-xl border cursor-grab active:cursor-grabbing">
     
      <p className="text-white text-sm font-medium truncate">{lead.name}</p>
      <p className="text-[#6a9090] text-xs mt-1 truncate">{lead.city}</p>
      {lead.email && <p className="text-green-400 text-xs mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> email</p>}
      {lead.rating && <p className="text-xs text-[#6a9090] mt-1 flex items-center gap-1"><Star className="w-3 h-3" fill="currentColor" /> {lead.rating}</p>}
    </div>
  );
}

function KanbanColumn({ stage, leads, color }: { stage: string; leads: Lead[]; color: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="flex-1 min-w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-white text-sm font-semibold">{stage}</span>
        </div>
        <span className="text-xs text-[#6a9090] px-2 py-0.5 rounded-full" style={{ background: '#1e3232' }}>{leads.length}</span>
      </div>
      <div ref={setNodeRef} className="space-y-3 min-h-[200px] p-2 rounded-xl transition-colors"
        style={{ background: isOver ? 'rgba(78,205,196,0.05)' : 'transparent', border: isOver ? '1px dashed #4ecdc4' : '1px solid transparent' }}>
        {leads.map(lead => <KanbanCard key={lead.id} lead={lead} />)}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { data, refetch } = useQuery<PipelineData>({ queryKey: ['pipeline'], queryFn: getPipeline });
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const stages = data?.stages ?? {};
  const counts = data?.counts;
  const rates  = data?.conversionRates;

  const allLeads = Object.values(stages).flat() as Lead[];
  const activeLead = allLeads.find(l => l.id === activeId);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const newStage = over.id as string;
    if (!STAGES.includes(newStage)) return;
    await updateLead(active.id as string, { stage: newStage });
    refetch();
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Pipeline</h1>

      {/* Conversion rates */}
      {rates && (
        <div className="flex gap-6 mb-8 text-sm">
          <span className="text-[#6a9090] flex items-center gap-1">New <ArrowRight className="w-3 h-3" /> Contacted: <span className="text-white font-medium ml-1">{rates.newToContacted}%</span></span>
          <span className="text-[#6a9090] flex items-center gap-1">Contacted <ArrowRight className="w-3 h-3" /> Replied: <span className="text-white font-medium ml-1">{rates.contactedToReplied}%</span></span>
          <span className="text-[#6a9090] flex items-center gap-1">Replied <ArrowRight className="w-3 h-3" /> Closed: <span className="text-white font-medium ml-1">{rates.repliedToClosed}%</span></span>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={e => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => (
            <KanbanColumn key={stage} stage={stage} leads={(stages[stage] ?? []) as Lead[]} color={STAGE_COLORS[stage]} />
          ))}
        </div>
        <DragOverlay>
          {activeLead ? <KanbanCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

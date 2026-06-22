'use client';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function OnboardingChecklist() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(false);

  const onboardingStep = (session?.user as any)?.onboardingStep ?? 0;
  
  // If the user has completed onboarding or dismissed it, don't show
  if (onboardingStep >= 3 || dismissed) return null;

  const steps = [
    { label: 'Download Desktop App', href: '/download', done: onboardingStep >= 1 },
    { label: 'Run First Scrape', href: '/dashboard/leads', done: onboardingStep >= 2 },
    { label: 'Configure Settings', href: '/dashboard/settings', done: onboardingStep >= 3 },
  ];

  return (
    <div className="mx-4 mb-4 mt-auto rounded-lg p-3 relative" style={{ background: '#111c1c', border: '1px solid #1e3232' }}>
      <button 
        onClick={() => setDismissed(true)} 
        className="absolute top-2 right-2 text-[#6a9090] hover:text-white"
        title="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
      <h3 className="text-xs font-semibold text-white mb-2 uppercase tracking-wide">Getting Started</h3>
      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2">
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-[#4ecdc4]" />
            ) : (
              <Circle className="w-4 h-4 text-[#6a9090]" />
            )}
            <Link 
              href={step.href} 
              className={cn(
                "text-xs transition-colors", 
                step.done ? "text-[#6a9090] line-through" : "text-[#cde0de] hover:text-white"
              )}
            >
              {step.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 bg-[#0a1414] h-1.5 rounded-full overflow-hidden">
        <div 
          className="h-full bg-[#4ecdc4] transition-all duration-500" 
          style={{ width: `${(onboardingStep / 3) * 100}%` }} 
        />
      </div>
    </div>
  );
}

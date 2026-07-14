import { getSettings } from '@/hooks/useSettingsStore';

export interface EnrichmentApiResult {
  emails: { email: string; confidence: 'high' | 'medium' | 'low'; source?: string }[];
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
}

export async function enrichViaHunter(domain: string, companyName: string): Promise<EnrichmentApiResult> {
  const settings = getSettings();
  const apiKey = settings.enrichmentKey;
  if (!apiKey) return { emails: [] };

  const result: EnrichmentApiResult = { emails: [] };

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return result;
    const data = await resp.json();

    if (data?.data?.emails) {
      for (const entry of data.data.emails) {
        const email = entry.value || entry.email;
        if (email) {
          let confidence: 'high' | 'medium' | 'low' = 'medium';
          if (entry.confidence && entry.confidence >= 90) confidence = 'high';
          else if (entry.confidence && entry.confidence < 50) confidence = 'low';
          result.emails.push({ email, confidence, source: entry.sources?.[0]?.domain || 'hunter.io' });
        }
      }
    }
  } catch {
    // API unreachable — silently return empty
  }

  return result;
}

export async function enrichViaClearbit(domain: string): Promise<EnrichmentApiResult> {
  const settings = getSettings();
  const apiKey = settings.enrichmentKey;
  if (!apiKey) return { emails: [] };

  const result: EnrichmentApiResult = { emails: [] };

  try {
    const resp = await fetch(`https://person.clearbit.com/v1/combined/find?email=${encodeURIComponent('info@' + domain)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!resp.ok) return result;

    const data = await resp.json();
    if (data?.person?.email) {
      result.emails.push({ email: data.person.email, confidence: 'high', source: 'clearbit' });
    }

    if (data?.company) {
      const social = data.company;
      if (social.linkedin?.handle) result.linkedin = `https://linkedin.com/company/${social.linkedin.handle}`;
      if (social.facebook?.handle) result.facebook = `https://facebook.com/${social.facebook.handle}`;
      if (social.twitter?.handle) {
        result.instagram = `https://instagram.com/${social.twitter.handle}`;
      }
    }
  } catch {
    // skip
  }

  return result;
}

export async function enrichViaApollo(domain: string, companyName: string): Promise<EnrichmentApiResult> {
  const settings = getSettings();
  const apiKey = settings.enrichmentKey;
  if (!apiKey) return { emails: [] };

  const result: EnrichmentApiResult = { emails: [] };

  try {
    const resp = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': apiKey },
      body: JSON.stringify({ domain, organization_name: companyName }),
    });
    if (!resp.ok) return result;

    const data = await resp.json();
    if (data?.person?.email) {
      result.emails.push({ email: data.person.email, confidence: 'medium', source: 'apollo.io' });
    }

    if (data?.organization) {
      const org = data.organization;
      if (org.linkedin_url) result.linkedin = org.linkedin_url;
      if (org.facebook_url) result.facebook = org.facebook_url;
    }
  } catch {
    // skip
  }

  return result;
}

export async function runEnrichmentApi(domain: string, companyName: string): Promise<EnrichmentApiResult> {
  const provider = getSettings().enrichmentProvider;
  switch (provider) {
    case 'clearbit': return enrichViaClearbit(domain);
    case 'apollo': return enrichViaApollo(domain, companyName);
    case 'hunter':
    default:
      return enrichViaHunter(domain, companyName);
  }
}
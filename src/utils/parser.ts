import { Lead, ImportResult, REQUIRED_FIELDS } from '@/types';

/** Validate a single lead record — returns array of error strings */
function validateLead(lead: Record<string, unknown>, rowIdx: number): string[] {
  return REQUIRED_FIELDS
    .filter(f => !lead[f])
    .map(f => `Row ${rowIdx + 1}: missing required field "${f}"`);
}

export function parseJson(text: string, fileName: string): ImportResult {
  const errors: string[] = [];
  let leads: Lead[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { leads: [], errors: ['Invalid JSON: ' + (e as Error).message], source: 'json', fileName };
  }

  if (!Array.isArray(raw)) {
    return { leads: [], errors: ['JSON file must contain an array of lead objects.'], source: 'json', fileName };
  }

  const seenUrls = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    const rowErrors = validateLead(item, i);
    
    if (rowErrors.length === 0) {
      const lead = item as Lead;
      const url = (lead.google_maps_url || lead.maps_url) as string;
      if (url) {
        if (seenUrls.has(url)) {
          errors.push(`Row ${i + 1}: duplicate entry for maps URL (${url})`);
          continue;
        }
        seenUrls.add(url);
      }
      leads.push(lead);
    } else {
      errors.push(...rowErrors);
    }
  }

  return { leads, errors, source: 'json', fileName };
}

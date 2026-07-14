import { describe, it, expect } from 'vitest';
import { parseJson } from '../utils/parser';

// ─── Helpers ──────────────────────────────────────────────────────────────

const validLead = { business_name: 'Acme Pizza', category: 'Restaurant' };

function makeJsonFile(leads: unknown[]): string {
  return JSON.stringify(leads);
}

// ─── parseJson ─────────────────────────────────────────────────────────────

describe('parseJson', () => {
  it('parses a valid JSON array of leads', () => {
    const result = parseJson(makeJsonFile([validLead]), 'test.json');
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].business_name).toBe('Acme Pizza');
    expect(result.errors).toHaveLength(0);
    expect(result.source).toBe('json');
  });

  it('returns an error for invalid JSON', () => {
    const result = parseJson('not json!!', 'bad.json');
    expect(result.leads).toHaveLength(0);
    expect(result.errors[0]).toMatch(/Invalid JSON/);
  });

  it('returns an error if JSON is not an array', () => {
    const result = parseJson('{"business_name":"Acme"}', 'obj.json');
    expect(result.leads).toHaveLength(0);
    expect(result.errors[0]).toMatch(/array/);
  });

  it('skips records missing required field business_name', () => {
    const data = [{ category: 'Food' }, validLead];
    const result = parseJson(makeJsonFile(data), 'test.json');
    expect(result.leads).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/missing required field "business_name"/);
  });

  it('deduplicates by google_maps_url', () => {
    const url = 'https://maps.google.com/place/123';
    const lead1 = { ...validLead, google_maps_url: url };
    const lead2 = { ...validLead, business_name: 'Acme Pizza 2', google_maps_url: url };
    const result = parseJson(makeJsonFile([lead1, lead2]), 'test.json');
    expect(result.leads).toHaveLength(1);
    expect(result.errors[0]).toMatch(/duplicate/);
  });

  it('handles an empty array gracefully', () => {
    const result = parseJson('[]', 'empty.json');
    expect(result.leads).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

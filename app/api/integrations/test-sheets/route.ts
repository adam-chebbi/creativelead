import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const authContext = await requireAuth(req);
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { sheetUrl } = body;

    if (!sheetUrl) {
      return NextResponse.json({ error: 'No sheet URL provided' }, { status: 400 });
    }

    if (!sheetUrl.startsWith('https://script.google.com/')) {
      return NextResponse.json({ error: 'Invalid URL — must be a Google Apps Script Web App URL (https://script.google.com/...)' }, { status: 400 });
    }

    const response = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json({ error: `Sheets API returned ${response.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, message: 'Connection successful — Web App is reachable.' });
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Request timed out (15s). Check the URL.' }, { status: 504 });
    }
    return NextResponse.json({ error: `Could not reach the URL: ${error?.message || 'Unknown error'}` }, { status: 502 });
  }
}

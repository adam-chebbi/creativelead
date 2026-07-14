export async function apiRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});

  if (typeof window !== 'undefined') {
    try {
      const clerk = (window as any).Clerk;
      if (clerk?.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
    } catch {
      // Clerk not available — proceed without token
    }
  }

  return fetch(url, { ...options, headers });
}

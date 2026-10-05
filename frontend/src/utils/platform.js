import { supabase } from '../supabaseClient';

export async function platform(action, input = {}, authenticated = true, method = 'POST', options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in to continue.');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const query = new URLSearchParams({ action, ...(method === 'GET' ? input : {}) });
  const response = await fetch(`/api/platform?${query}`, { method, headers, signal: options.signal, ...(method !== 'GET' ? { body: JSON.stringify(input) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed. Please try again.');
  return result;
}

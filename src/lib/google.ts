import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { APP_SCHEME } from '../config';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in via Supabase OAuth using an in-app browser tab.
 *
 * Flow: ask Supabase for the Google auth URL with a redirect back to our app's
 * deep link (fitpilot://auth-callback), open it in a browser tab, then parse
 * the returned tokens and hand them to supabase.auth.setSession — which
 * persists them (so the login survives restarts).
 *
 * Requires, in the Supabase dashboard:
 *   Auth -> Providers -> Google (enabled, with your Google client id/secret)
 *   Auth -> URL Configuration -> add redirect URL: fitpilot://auth-callback
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth-callback'); // fitpilot://auth-callback

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth URL returned by Supabase.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in was cancelled.');
  }

  await completeSessionFromUrl(result.url);
}

/**
 * Extract the session from a redirect URL. Supabase returns tokens either in
 * the URL fragment (#access_token=...) or as a ?code= to exchange.
 */
async function completeSessionFromUrl(url: string): Promise<void> {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};

  // PKCE code-exchange path.
  const code = params['code'];
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  // Implicit token path (tokens in the fragment).
  const fragment = url.split('#')[1] ?? '';
  const frag = new URLSearchParams(fragment);
  const access_token = frag.get('access_token');
  const refresh_token = frag.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return;
  }

  throw new Error('Could not parse the sign-in response.');
}

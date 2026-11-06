function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates a PKCE code verifier and its SHA-256 base64url-encoded challenge.
 * Uses `crypto.subtle` — works in both Node.js (Nitro) and edge runtimes.
 */
export async function generatePkce(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64url(bytes.buffer as ArrayBuffer);

  const encoded = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const codeChallenge = base64url(digest);

  return { codeVerifier, codeChallenge };
}

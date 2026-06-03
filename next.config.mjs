/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // The Content-Security-Policy for /pulse is set per-request in middleware
    // (src/lib/supabase/middleware.ts) so it can carry a fresh nonce. Setting it
    // here too would double-set a conflicting CSP header, so it is omitted.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

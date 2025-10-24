export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth (authentication endpoints)
     * - /api/cron (automated/cron endpoints with Bearer token auth)
     * - /login (login page)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     */
    '/((?!api/auth|api/cron|login|_next|favicon.ico|robots.txt).*)',
  ],
};

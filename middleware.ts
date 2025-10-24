export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth (authentication endpoints)
     * - /login (login page)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     */
    '/((?!api/auth|login|_next|favicon.ico|robots.txt).*)',
  ],
};

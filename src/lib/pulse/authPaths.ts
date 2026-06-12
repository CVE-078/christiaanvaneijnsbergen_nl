// Paths under /pulse reachable WITHOUT an authenticated session.
// The middleware bounces every other /pulse/* path to the login page.
// /pulse/reset-password is intentionally NOT public: the recovery email link
// runs through /pulse/auth/confirm, which establishes a recovery session before
// redirecting there, so the user is authenticated by the time the form renders.
// /pulse/account-deleted is public because the delete flow destroys the session
// before redirecting there; otherwise the middleware would bounce it to login.
const PUBLIC_AUTH_PATHS = [
    '/pulse/login',
    '/pulse/signup',
    '/pulse/forgot-password',
    '/pulse/auth/confirm',
    '/pulse/account-deleted',
];

/** Exact-match (trailing slash tolerated) test for the public auth paths. Subpaths are NOT public. */
export function isPublicAuthPath(pathname: string): boolean {
    const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    return PUBLIC_AUTH_PATHS.includes(normalized);
}

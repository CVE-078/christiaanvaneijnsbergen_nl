import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  // Use startsWith to handle both /pulse/login and /pulse/login/ (trailing slash)
  if (req.nextUrl.pathname.startsWith('/pulse/login')) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!await verifySession(cookie))
    return NextResponse.redirect(new URL('/pulse/login', req.url));

  return NextResponse.next();
}

export const config = { matcher: ['/pulse/:path*'] };

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/weight-tracker/login') return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/weight-tracker')) {
    const cookie = req.cookies.get(COOKIE_NAME)?.value;
    if (!await verifySession(cookie))
      return NextResponse.redirect(new URL('/weight-tracker/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/weight-tracker/:path*'] };

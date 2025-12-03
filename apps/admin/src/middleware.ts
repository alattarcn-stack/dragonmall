import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Skip middleware for login page
  if (request.nextUrl.pathname === '/admin/login') {
    return NextResponse.next()
  }

  // Check for admin token in cookie or header
  const token = request.cookies.get('admin_token')?.value || 
                request.headers.get('Authorization')?.replace('Bearer ', '')

  // If no token and trying to access admin routes, redirect to login
  if (!token && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}


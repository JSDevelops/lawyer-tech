/**
 * Next.js Middleware — Route Protection (Server-Side)
 * ====================================================
 * ป้องกัน /dashboard/superadmin ให้เข้าได้เฉพาะ role=superadmin
 * และ redirect ไป /login ถ้าไม่ได้ login
 *
 * วิธีทำงาน:
 * - อ่าน access_token จาก cookie (หรือ header)
 * - Decode JWT payload (ไม่ verify signature เพราะต้องใช้ crypto ใน Edge runtime)
 * - ตรวจสอบ role แล้ว redirect ตามสิทธิ์
 *
 * Note: Signature verification ทำที่ Backend API เสมอ
 * Middleware นี้เป็น UX protection ชั้นแรกเท่านั้น
 */

import { NextRequest, NextResponse } from 'next/server'

/** Decode JWT payload (Base64URL) without verifying signature */
function decodeJWTPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    // Base64URL → Base64 → JSON
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      Math.ceil(payload.length / 4) * 4,
      '='
    )
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
  } catch {
    return null
  }
}

/** Route configurations */
const SUPERADMIN_ROUTES = ['/dashboard/superadmin']
const PROTECTED_ROUTES = ['/dashboard', '/cases', '/clients', '/documents', '/calendar', '/billing', '/hr', '/ai', '/settings']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Read token from cookie (preferred) or Authorization header
  const token =
    request.cookies.get('access_token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '')

  // ─── 1. Super Admin Route Protection ───────────────────
  if (SUPERADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    if (!token) {
      // Not logged in → redirect to login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const payload = decodeJWTPayload(token)
    if (!payload || payload.role !== 'superadmin') {
      // Logged in but not SuperAdmin → redirect to tenant dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ─── 2. General Protected Routes ───────────────────────
  if (PROTECTED_ROUTES.some(r => pathname.startsWith(r))) {
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check token expiry
    const payload = decodeJWTPayload(token)
    if (!payload) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
    
    // exp check (JWT exp is Unix timestamp in seconds)
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('reason', 'session_expired')
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  /*
   * Match all routes EXCEPT:
   * - Static files (_next/static, _next/image, favicon.ico)
   * - Public API routes
   * - Login/register pages
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|login|register|api/).*)',
  ],
}

'use client'

/**
 * LINE OAuth Callback Page
 * ========================
 * URL: /auth/line/callback?code=...&state=...
 *
 * Flow:
 * 1. Backend ตั้ง LINE_REDIRECT_URI = http://localhost:3000/auth/line/callback
 * 2. LINE redirects user มาที่ URL นี้พร้อม ?code=...&state=...
 * 3. Page นี้ส่ง code+state ไป backend /api/v1/line/callback
 * 4. Backend ตรวจสอบ, สร้าง JWT แล้วส่งกลับ
 * 5. บันทึก token และ redirect ไป /dashboard
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

type Status = 'loading' | 'success' | 'error'

export default function LineCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('กำลังยืนยันตัวตนกับ LINE...')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')

    // LINE returned an error (user denied, etc.)
    if (error) {
      setStatus('error')
      setMessage(errorDesc || `LINE Login ถูกปฏิเสธ: ${error}`)
      setTimeout(() => router.push('/login'), 3000)
      return
    }

    if (!code || !state) {
      setStatus('error')
      setMessage('ข้อมูล callback ไม่ครบถ้วน กรุณาลองใหม่')
      setTimeout(() => router.push('/login'), 3000)
      return
    }

    // Exchange code for JWT via backend
    const exchangeCode = async () => {
      try {
        setMessage('กำลังแลก authorization code...')
        const res = await fetch(
          `${API}/line/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
          { method: 'GET' }
        )
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.detail || 'LINE authentication failed')
        }

        // Save token and user info
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('user', JSON.stringify(data.user))

        setStatus('success')
        setMessage(`ยินดีต้อนรับ, ${data.user.full_name} 🎉`)

        // Redirect to dashboard after short delay
        setTimeout(() => router.push('/dashboard'), 1500)

      } catch (err: any) {
        setStatus('error')
        setMessage(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE')
        setTimeout(() => router.push('/login'), 4000)
      }
    }

    exchangeCode()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-10 border border-white/10 max-w-sm w-full text-center space-y-6">
        {/* LINE Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#06C755] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.16 2 11.27c0 4.56 3.42 8.37 8.06 9.12.31.07.74.21.85.48.10.24.06.61.03.85l-.14.82c-.04.24-.19.94.83.51 1.02-.43 5.51-3.25 7.52-5.55C20.44 15.32 22 13.4 22 11.27 22 6.16 17.52 2 12 2z"/>
            </svg>
          </div>
        </div>

        {/* Status icon */}
        <div className="flex justify-center">
          {status === 'loading' && (
            <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          )}
          {status === 'error' && (
            <XCircle className="w-12 h-12 text-red-400" />
          )}
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-bold text-white mb-2">
            {status === 'loading' && 'LINE Login'}
            {status === 'success' && 'เข้าสู่ระบบสำเร็จ'}
            {status === 'error' && 'เกิดข้อผิดพลาด'}
          </h2>
          <p className="text-slate-400 text-sm">{message}</p>
        </div>

        {/* Progress bar for loading */}
        {status === 'loading' && (
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#06C755] to-primary-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        )}

        {/* Redirect notice */}
        {status !== 'loading' && (
          <p className="text-slate-500 text-xs">
            {status === 'success' ? 'กำลัง redirect ไป dashboard...' : 'กำลัง redirect ไปหน้า login...'}
          </p>
        )}
      </div>
    </div>
  )
}

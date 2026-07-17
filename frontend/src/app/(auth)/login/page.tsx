'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Shield, Zap, Lock, Scale } from 'lucide-react'
import toast from 'react-hot-toast'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lineLoading, setLineLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // If already logged in, redirect
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token')
      if (token) router.push('/dashboard')
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'เข้าสู่ระบบไม่สำเร็จ')

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      toast.success(`ยินดีต้อนรับ, ${data.user.full_name} 🎉`)

      // Route based on role
      if (data.user.role === 'superadmin') {
        router.push('/dashboard/superadmin')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const handleLineLogin = async () => {
    setLineLoading(true)
    try {
      const res = await fetch(`${API}/line/login-url`)
      const data = await res.json()
      if (!res.ok || !data.login_url) throw new Error('ไม่สามารถสร้าง LINE Login URL ได้')
      window.location.href = data.login_url
    } catch (err: any) {
      toast.error(err.message || 'LINE Login ล้มเหลว')
      setLineLoading(false)
    }
  }

  const features = [
    { icon: '👥', text: 'จัดการลูกความ CRM + KYC ครบวงจร' },
    { icon: '⚖️', text: 'ระบบจัดการคดีและนัดหมายศาล' },
    { icon: '🤖', text: 'AI ค้นหาฎีกาและร่างเอกสารกฎหมาย' },
    { icon: '💰', text: 'ระบบบัญชีและใบแจ้งหนี้อัตโนมัติ' },
    { icon: '🔐', text: 'ระบบสิทธิ์แบบ Multi-role RBAC' },
  ]

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0a0f1e] flex overflow-hidden">

      {/* ===== Left Panel — Branding (Desktop only) ===== */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden flex-shrink-0">
        {/* Gradient backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1f3a] via-[#0f172a] to-[#0a0f1e]" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-600/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/3 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 xl:p-16 text-center">
          {/* Logo */}
          <div className="w-24 h-24 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/20 backdrop-blur">
            <img src="/images/logo.png" alt="Lawyer Tech Logo" className="w-16 h-16 object-contain" />
          </div>

          {/* Thai flag accent */}
          <div className="thai-flag-accent w-20 mb-6" />

          <h1 className="text-4xl xl:text-5xl font-extrabold gradient-text mb-3 tracking-tight">
            Lawyer Tech
          </h1>
          <p className="text-slate-300 text-lg font-medium mb-1">ERP & AI Platform</p>
          <p className="text-amber-400/70 text-sm italic mb-12">
            "ระบบบริหารสำนักงานกฎหมายครบวงจร"
          </p>

          {/* Feature list */}
          <div className="space-y-3 text-left max-w-sm w-full">
            {features.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white/4 backdrop-blur border border-white/6 rounded-2xl px-4 py-3 transition-all hover:bg-white/6"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <span className="text-slate-300 text-sm">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Version badge */}
          <div className="mt-10 flex items-center gap-2 text-xs text-slate-600">
            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
            <span>System Online — v2.0.0</span>
          </div>
        </div>
      </div>

      {/* ===== Right Panel — Login Form ===== */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative overflow-y-auto">
        {/* Mobile background */}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-br from-[#0f172a] to-[#0a0f1e]" />
        <div className="lg:hidden absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-indigo-600/8 rounded-full blur-3xl" />

        <div className="w-full max-w-[400px] relative z-10">

          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
              <img src="/images/logo.png" alt="Lawyer Tech Logo" className="w-12 h-12 object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold gradient-text">Lawyer Tech</h1>
            <p className="text-slate-500 text-sm mt-1">ระบบบริหารสำนักงานกฎหมาย</p>
          </div>

          {/* Form Card */}
          <div className="bg-[#0f1929] border border-white/8 rounded-3xl p-7 lg:p-8 shadow-2xl shadow-black/40">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white">เข้าสู่ระบบ</h2>
              <p className="text-slate-500 text-sm mt-1.5">กรุณากรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  อีเมล
                </label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  className="input-field"
                  placeholder="lawyer@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="input-field pr-12"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn-primary w-full py-3.5 text-base mt-2"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> กำลังเข้าสู่ระบบ...</>
                ) : (
                  <><Shield className="w-5 h-5" /> เข้าสู่ระบบ</>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/6" />
              <span className="text-xs text-slate-600 px-1">หรือ</span>
              <div className="flex-1 h-px bg-white/6" />
            </div>

            {/* LINE Login */}
            <button
              type="button"
              onClick={handleLineLogin}
              disabled={lineLoading || loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl font-semibold text-sm transition-all duration-200
                bg-[#06C755] hover:bg-[#05B34C] active:bg-[#04A044] active:scale-98
                text-white shadow-lg shadow-green-500/20
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lineLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.365 9.89c.50 0 .91.41.91.91s-.41.91-.91.91h-2.28v1.37h2.28c.50 0 .91.41.91.91s-.41.91-.91.91h-3.19c-.50 0-.91-.41-.91-.91V9.89c0-.50.41-.91.91-.91h3.19zm-4.58 0c.50 0 .91.41.91.91v4.1c0 .50-.41.91-.91.91s-.91-.41-.91-.91V10.8c0-.50.41-.91.91-.91zm-1.82 0c.50 0 .91.41.91.91v4.1c0 .50-.41.91-.91.91s-.91-.41-.91-.91v-2.25l-2.3 2.87c-.17.21-.43.29-.68.23-.25-.06-.44-.27-.49-.52v-4.43c0-.50.41-.91.91-.91s.91.41.91.91v2.25l2.3-2.87c.17-.21.43-.29.68-.23.25.06.44.27.49.52zM5.54 9.89c.50 0 .91.41.91.91v4.1c0 .50-.41.91-.91.91s-.91-.41-.91-.91V10.8c0-.50.41-.91.91-.91zM12 2C6.48 2 2 6.16 2 11.27c0 4.56 3.42 8.37 8.06 9.12.31.07.74.21.85.48.10.24.06.61.03.85l-.14.82c-.04.24-.19.94.83.51 1.02-.43 5.51-3.25 7.52-5.55C20.44 15.32 22 13.4 22 11.27 22 6.16 17.52 2 12 2z"/>
                </svg>
              )}
              {lineLoading ? 'กำลังเชื่อมต่อ LINE...' : 'เข้าสู่ระบบด้วย LINE'}
            </button>

            {/* Security note */}
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600">
              <Lock className="w-3 h-3" />
              <span>เข้ารหัสด้วย JWT + HTTPS — ข้อมูลปลอดภัย 100%</span>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-700 mt-6">
            © 2025 Lawyer Tech ERP — All rights reserved
          </p>
        </div>
      </div>
    </div>
  )
}

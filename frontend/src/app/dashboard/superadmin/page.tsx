'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldAlert, ShieldCheck, Database, Users, Scale, CreditCard,
  Settings, Save, Loader2, KeyRound, Mail, BadgeAlert,
  Coins, Lock, Terminal, Activity, ToggleLeft, ToggleRight,
  TrendingUp, HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export default function SuperAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'stats' | 'tenants' | 'ai' | 'smtp' | 'billing' | 'maintenance'>('stats')

  // Auth/Role
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Tenants list
  const [tenants, setTenants] = useState<any[]>([])
  const [topupAmount, setTopupAmount] = useState<{ [key: string]: number }>({})

  // Stats State
  const [stats, setStats] = useState({
    total_tenants: 0,
    active_tenants: 0,
    total_users: 0,
    total_cases: 0,
    total_plans: 0,
    database_connections: 0,
    revenue_thb: 0
  })

  // System Settings State
  const [settingsData, setSettingsData] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: 'noreply@lawyertech.co.th',
    smtp_password: '••••••••',
    
    gemini_api_key_override: '',
    gemini_model: 'gemini-2.0-flash',
    openai_api_key: '',
    openai_model: 'gpt-4o',
    
    bank_name: 'ธนาคารกสิกรไทย',
    bank_account_name: 'บริษัท เลเยอร์ เทค จำกัด',
    bank_account_number: '',
    promptpay_id: '',
    enable_bank_transfer: true,
    
    stripe_publishable_key: '',
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    enable_stripe: false,
    
    maintenance_mode: false,
    allow_new_registrations: true
  })

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  // Load and verify superadmin permissions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        toast.error('กรุณาเข้าสู่ระบบก่อนการใช้งาน')
        router.push('/login')
        return
      }

      const parsedUser = JSON.parse(storedUser)
      setCurrentUser(parsedUser)

      if (parsedUser.role !== 'superadmin') {
        toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้าระบบควบคุมกลาง')
        router.push('/dashboard')
        return
      }
    }

    fetchSuperAdminData()
  }, [router])

  const fetchSuperAdminData = async () => {
    setPageLoading(true)
    try {
      const headers = getHeaders()

      // 1. Fetch Stats
      const statsRes = await fetch(`${API}/superadmin/stats`, { headers })
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      // 2. Fetch System Settings
      const settingsRes = await fetch(`${API}/superadmin/settings`, { headers })
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json()
        setSettingsData(settingsJson)
      } else {
        toast.error('โหลดข้อมูลการตั้งค่าระบบส่วนกลางล้มเหลว')
      }

      // 3. Fetch Tenants
      const tenantsRes = await fetch(`${API}/superadmin/tenants`, { headers })
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json()
        setTenants(tenantsData)
      }
    } catch (err) {
      console.error(err)
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับ API หลังบ้าน')
    } finally {
      setPageLoading(false)
    }
  }

  const handleTopupCredits = async (tenantId: string) => {
    const amount = topupAmount[tenantId]
    if (!amount || amount <= 0) {
      toast.error('กรุณาระบุจำนวนเครดิตที่ต้องการเติม')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/superadmin/tenants/${tenantId}/add-credits`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount })
      })

      if (res.ok) {
        toast.success(`เติมเครดิต ${amount} AI Credits สำเร็จ! 🎉`)
        setTopupAmount({ ...topupAmount, [tenantId]: 0 })
        fetchSuperAdminData()
      } else {
        const errJson = await res.json()
        toast.error(errJson.detail || 'เติมเครดิตล้มเหลว')
      }
    } catch (err) {
      toast.error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API}/superadmin/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settingsData)
      })

      if (res.ok) {
        toast.success('บันทึกการตั้งค่าระบบส่วนกลางเรียบร้อยแล้ว')
        // Refetch to refresh masks
        fetchSuperAdminData()
      } else {
        const errJson = await res.json()
        toast.error(errJson.detail || 'บันทึกข้อมูลล้มเหลว')
      }
    } catch {
      toast.error('ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านได้')
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <span className="ml-3 text-slate-400 text-sm">กำลังโหลดข้อมูลระบบควบคุมกลาง...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[85vh]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-rose-500" /> ระบบควบคุมกลางแพลตฟอร์ม (SaaS SuperAdmin)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            ควบคุมระบบ AI ส่วนกลาง, บริหารคีย์ API, ตั้งค่าการจ่ายเงิน และสถิติภาพรวมของผู้เช่าใช้ระบบทั้งหมด
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchSuperAdminData}
            className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition"
          >
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {/* Thai Flag accent */}
      <div className="thai-flag-accent" />

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
            ${activeTab === 'stats'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <Activity className="w-4 h-4" />
          สถิติภาพรวมระบบ
        </button>
        <button
          onClick={() => setActiveTab('tenants')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
            ${activeTab === 'tenants'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <Users className="w-4 h-4" />
          สำนักงาน & เครดิต AI
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
            ${activeTab === 'ai'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <KeyRound className="w-4 h-4" />
          ระบบปัญญาประดิษฐ์ (AI Studio)
        </button>
        <button
          onClick={() => setActiveTab('smtp')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
            ${activeTab === 'smtp'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <Mail className="w-4 h-4" />
          ตั้งค่าอีเมล (SMTP)
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
            ${activeTab === 'billing'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <Coins className="w-4 h-4" />
          การรับชำระเงิน (SaaS Plans)
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
            ${activeTab === 'maintenance'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          <Lock className="w-4 h-4" />
          ความปลอดภัย & กฎระบบ
        </button>
      </div>

      {/* TAB CONTENT: STATS */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-5 space-y-2 border-l-4 border-l-primary-500">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">สำนักงานที่ใช้งาน (Tenants)</p>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-extrabold text-white">{stats.total_tenants}</span>
                <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                  ใช้งานจริง {stats.active_tenants}
                </span>
              </div>
            </div>

            <div className="card p-5 space-y-2 border-l-4 border-l-indigo-500">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">ผู้ใช้งานในระบบ (Total Users)</p>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-extrabold text-white">{stats.total_users}</span>
                <span className="text-xs text-slate-500">ทนายความ / เสมียน</span>
              </div>
            </div>

            <div className="card p-5 space-y-2 border-l-4 border-l-pink-500">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">คดีความในระบบทั้งหมด (Cases)</p>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-extrabold text-white">{stats.total_cases}</span>
                <span className="text-xs text-slate-500">ทุกสำนักงาน</span>
              </div>
            </div>

            <div className="card p-5 space-y-2 border-l-4 border-l-amber-500">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">รายได้ประมาณการต่อเดือน</p>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-extrabold text-amber-400">
                  ฿{stats.revenue_thb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500">SaaS Subs</span>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" /> ข้อมูลการทำงานของเซิร์ฟเวอร์กลาง (System Status)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">Database Connection Pools (Supabase)</span>
                <span className="font-mono text-sm text-emerald-400">{stats.database_connections} Active Connections</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">แพ็กเกจราคาในระบบ (SaaS Plans)</span>
                <span className="font-mono text-sm text-white">{stats.total_plans} Packages</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">การเชื่อมต่อ AI Studio Engine</span>
                <span className="text-sm text-emerald-400">ปกติ (Connected)</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">โหมดบำรุงรักษาระบบ (Maintenance Mode)</span>
                <span className={`text-sm font-semibold ${settingsData.maintenance_mode ? 'text-red-400' : 'text-slate-500'}`}>
                  {settingsData.maintenance_mode ? 'เปิดการใช้งานอยู่' : 'ปิดอยู่ (ใช้งานปกติ)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">ปริมาณการใช้งาน AI เครดิต (สะสมทั้งหมด)</span>
                <span className="font-mono text-sm text-rose-400">ใช้ไป {(stats as any).total_ai_credits_used || 0} เครดิต</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">เครดิต AI คงเหลือ (รวมทุกสำนักงาน)</span>
                <span className="font-mono text-sm text-emerald-400">คงเหลือ {(stats as any).total_ai_credits_remaining || 0} เครดิต</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TENANTS & AI CREDITS */}
      {activeTab === 'tenants' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-400" />
                รายชื่อสำนักงานกฎหมาย & โควตาการใช้งาน AI (Tenants & AI Credits)
              </h3>
              <span className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full">
                ทั้งหมด {tenants.length} สำนักงาน
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 text-xs uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">สำนักงาน (Subdomain)</th>
                    <th className="py-3 px-4">สถานะการเช่าใช้</th>
                    <th className="py-3 px-4">ทนาย / คดี</th>
                    <th className="py-3 px-4">แพ็กเกจปัจจุบัน</th>
                    <th className="py-3 px-4 w-[250px]">เครดิต AI คงเหลือ (ใช้ไป / ทั้งหมด)</th>
                    <th className="py-3 px-4 text-right">เติมเครดิต AI (จำนวน)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tenants.map(tenant => {
                    const total = tenant.ai_credits_total || 100
                    const used = tenant.ai_credits_used || 0
                    const rem = tenant.ai_credits_remaining || 0
                    const pct = Math.min(100, Math.round((used / total) * 100))
                    
                    return (
                      <tr key={tenant.id} className="hover:bg-white/2 transition">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white">{tenant.name}</p>
                          <p className="text-xs text-rose-400 font-mono mt-0.5">{tenant.subdomain || 'N/A'}.lawyertech.co.th</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                            ${tenant.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {tenant.status === 'active' ? 'เปิดใช้งาน' : 'ระงับการใช้'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-white text-xs">{tenant.user_count} คน / {tenant.case_count} คดี</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-white text-xs font-medium">{tenant.plan_name}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5">
                            {tenant.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'} 
                            {tenant.end_date ? ` (หมดอายุ ${new Date(tenant.end_date).toLocaleDateString('th-TH')})` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-rose-400">{rem} เครดิต</span>
                              <span className="text-slate-500">ใช้ไป {used}/{total}</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300
                                  ${pct > 90 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number"
                              className="w-20 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-center text-xs text-white focus:outline-none focus:border-rose-500"
                              placeholder="จำนวน"
                              value={topupAmount[tenant.id] || ''}
                              onChange={e => setTopupAmount({ 
                                ...topupAmount, 
                                [tenant.id]: parseInt(e.target.value) || 0 
                              })}
                            />
                            <button
                              onClick={() => handleTopupCredits(tenant.id)}
                              disabled={loading || !(topupAmount[tenant.id] > 0)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shrink-0"
                            >
                              เติมเครดิต
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 text-sm">
                        ไม่พบข้อมูลสำนักงานกฎหมายในระบบ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AI */}
      {activeTab === 'ai' && (
        <form onSubmit={handleSaveSettings} className="card p-6 space-y-6">
          <div className="pb-3 border-b border-white/5">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-rose-400" />
              การเชื่อมต่อระบบปัญญาประดิษฐ์ (AI Studio Settings)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              คีย์เหล่านี้จะถูกใช้เป็นคีย์ตั้งต้นสำหรับทุกสำนักงานกฎหมายที่เข้ามาเช่าใช้งานระบบ (เว้นแต่จะมีคีย์สำนักงานระบุเฉพาะ)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">Google Gemini API Key (คีย์หลักระบบ)</label>
              <input
                type="password"
                className="input-field"
                placeholder={settingsData.gemini_api_key_override ? '••••••••••••••••' : 'ใส่คีย์ API Key ที่ขึ้นต้นด้วย AIzaSy...'}
                value={settingsData.gemini_api_key_override || ''}
                onChange={e => setSettingsData({ ...settingsData, gemini_api_key_override: e.target.value })}
              />
              <p className="text-[11px] text-slate-500">
                หากเว้นว่างไว้ จะถอยกลับไปใช้ตัวแปรสภาพแวดล้อมระบบหลักของเครื่อง (Environment Variable)
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">โมเดลประมวลผล Gemini เริ่มต้น</label>
              <select
                className="input-field"
                value={settingsData.gemini_model || 'gemini-2.0-flash'}
                onChange={e => setSettingsData({ ...settingsData, gemini_model: e.target.value })}
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (แนะนำ - เร็วและประหยัดที่สุด)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (ฉลาด วิเคราะห์คดีกฎหมายซับซ้อนสูงสุด)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (โมเดลมาตรฐานดั้งเดิม)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">OpenAI API Key (สำรอง)</label>
              <input
                type="password"
                className="input-field"
                placeholder={settingsData.openai_api_key ? '••••••••••••••••' : 'ใส่คีย์ API Key ที่ขึ้นต้นด้วย sk-...'}
                value={settingsData.openai_api_key || ''}
                onChange={e => setSettingsData({ ...settingsData, openai_api_key: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">โมเดลประมวลผล OpenAI เริ่มต้น</label>
              <select
                className="input-field"
                value={settingsData.openai_model || 'gpt-4o'}
                onChange={e => setSettingsData({ ...settingsData, openai_model: e.target.value })}
              >
                <option value="gpt-4o">GPT-4o (โมเดลหลักประสิทธิภาพสูง)</option>
                <option value="gpt-4o-mini">GPT-4o-mini (ประหยัด รวดเร็ว)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/5">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกการตั้งค่า AI
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT: SMTP */}
      {activeTab === 'smtp' && (
        <form onSubmit={handleSaveSettings} className="card p-6 space-y-6">
          <div className="pb-3 border-b border-white/5">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              การส่งการแจ้งเตือนและระบบอีเมลส่วนกลาง (SMTP Email Server)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ใช้สำหรับส่งใบเสร็จรับเงิน, ลิงก์กู้คืนรหัสผ่าน, และอีเมลแจ้งเตือนต่างๆ ให้ผู้ใช้งานในระบบ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">SMTP Host Server *</label>
              <input
                type="text"
                className="input-field"
                placeholder="เช่น smtp.gmail.com"
                value={settingsData.smtp_host}
                onChange={e => setSettingsData({ ...settingsData, smtp_host: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">SMTP Port *</label>
              <input
                type="number"
                className="input-field"
                placeholder="เช่น 587 หรือ 465"
                value={settingsData.smtp_port}
                onChange={e => setSettingsData({ ...settingsData, smtp_port: parseInt(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">อีเมลส่งข้อความ (SMTP Username/Email) *</label>
              <input
                type="email"
                className="input-field"
                placeholder="เช่น system@lawyertech.co.th"
                value={settingsData.smtp_user}
                onChange={e => setSettingsData({ ...settingsData, smtp_user: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">รหัสผ่านอีเมล (SMTP Password/App Password) *</label>
              <input
                type="password"
                className="input-field"
                placeholder="ป้อนรหัสผ่าน SMTP"
                value={settingsData.smtp_password}
                onChange={e => setSettingsData({ ...settingsData, smtp_password: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/5">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกรหัส SMTP
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT: BILLING */}
      {activeTab === 'billing' && (
        <form onSubmit={handleSaveSettings} className="card p-6 space-y-6">
          <div className="pb-3 border-b border-white/5">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              การจัดการธุรกรรมและสลิปเงินฝากส่วนกลาง (SaaS Plan Payments)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ข้อมูลบัญชีปลายทางสำหรับการชำระค่าเช่าแพ็กเกจของสำนักงานกฎหมายลูกค้า
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">1. โอนเงินบัญชีธนาคาร (Bank Transfer)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400">ชื่อธนาคาร</label>
                <input
                  type="text"
                  className="input-field"
                  value={settingsData.bank_name || ''}
                  onChange={e => setSettingsData({ ...settingsData, bank_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400">ชื่อบัญชีเงินฝาก</label>
                <input
                  type="text"
                  className="input-field"
                  value={settingsData.bank_account_name || ''}
                  onChange={e => setSettingsData({ ...settingsData, bank_account_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400">เลขที่บัญชี</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="เช่น 000-0-00000-0"
                  value={settingsData.bank_account_number || ''}
                  onChange={e => setSettingsData({ ...settingsData, bank_account_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400">หมายเลขพร้อมเพย์ (PromptPay ID)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="เบอร์โทรศัพท์ หรือ เลขบัตรประชาชน"
                  value={settingsData.promptpay_id || ''}
                  onChange={e => setSettingsData({ ...settingsData, promptpay_id: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <div
                  onClick={() => setSettingsData({ ...settingsData, enable_bank_transfer: !settingsData.enable_bank_transfer })}
                  className={`flex justify-between items-center p-4 rounded-xl border transition-all cursor-pointer select-none
                    ${settingsData.enable_bank_transfer
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                >
                  <div>
                    <p className="text-sm font-medium text-white">เปิดรับการชำระเงินโอนบัญชีธนาคาร</p>
                    <p className="text-xs text-slate-500 mt-0.5">เปิดช่องทางนี้เพื่อให้ลูกค้าสามารถส่งสลิปเพื่อขออนุมัติใช้งานคลาวด์ได้</p>
                  </div>
                  {settingsData.enable_bank_transfer ? (
                    <ToggleRight className="w-8 h-8 text-emerald-400 shrink-0" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-600 shrink-0" />
                  )}
                </div>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-white pt-4 border-t border-white/5">2. ระบบตัดบัตรเครดิตออนไลน์ (Stripe API)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="block text-xs font-medium text-slate-400">Stripe Publishable Key</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="pk_test_..."
                  value={settingsData.stripe_publishable_key || ''}
                  onChange={e => setSettingsData({ ...settingsData, stripe_publishable_key: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400">Stripe Secret Key</label>
                <input
                  type="password"
                  className="input-field font-mono"
                  placeholder={settingsData.stripe_secret_key ? '••••••••••••••••' : 'sk_test_...'}
                  value={settingsData.stripe_secret_key || ''}
                  onChange={e => setSettingsData({ ...settingsData, stripe_secret_key: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400">Stripe Webhook Secret</label>
                <input
                  type="password"
                  className="input-field font-mono"
                  placeholder={settingsData.stripe_webhook_secret ? '••••••••••••••••' : 'whsec_...'}
                  value={settingsData.stripe_webhook_secret || ''}
                  onChange={e => setSettingsData({ ...settingsData, stripe_webhook_secret: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <div
                  onClick={() => setSettingsData({ ...settingsData, enable_stripe: !settingsData.enable_stripe })}
                  className={`flex justify-between items-center p-4 rounded-xl border transition-all cursor-pointer select-none
                    ${settingsData.enable_stripe
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                >
                  <div>
                    <p className="text-sm font-medium text-white">เปิดรับการชำระผ่านระบบบัตรเครดิตอัตโนมัติ (Stripe)</p>
                    <p className="text-xs text-slate-500 mt-0.5">เปิดระบบตัดเงินและขยายระยะเวลาใช้งานแบบรายเดือน/ปีโดยระบบอัตโนมัติ</p>
                  </div>
                  {settingsData.enable_stripe ? (
                    <ToggleRight className="w-8 h-8 text-emerald-400 shrink-0" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-600 shrink-0" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/5">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกข้อมูลธนาคาร
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT: MAINTENANCE */}
      {activeTab === 'maintenance' && (
        <form onSubmit={handleSaveSettings} className="card p-6 space-y-6">
          <div className="pb-3 border-b border-white/5">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-500" />
              การบำรุงรักษาระบบและข้อจำกัดการสมัครใช้บริการ (Platform Rules)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ใช้สำหรับปิดปรับปรุงระบบชั่วคราว หรือควบคุมอัตราการเติบโตและการรับลงทะเบียนของลูกค้าใหม่
            </p>
          </div>

          <div className="space-y-4">
            <div
              onClick={() => setSettingsData({ ...settingsData, maintenance_mode: !settingsData.maintenance_mode })}
              className={`flex justify-between items-center p-4 rounded-xl border transition-all cursor-pointer select-none
                ${settingsData.maintenance_mode
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-white/5 border-white/5 hover:border-white/10'}`}
            >
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-1.5">
                  <BadgeAlert className="w-4 h-4 text-red-400" /> เปิดโหมดบำรุงรักษาเซิร์ฟเวอร์ (Maintenance Mode)
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  บล็อกผู้ใช้ทุกคนยกเว้น Super Admin ไม่ให้ใช้งานระบบ และหน้าเว็บจะแสดงสถานะ "ปิดปรับปรุงชั่วคราว"
                </p>
              </div>
              {settingsData.maintenance_mode ? (
                <ToggleRight className="w-8 h-8 text-red-400 shrink-0" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-600 shrink-0" />
              )}
            </div>

            <div
              onClick={() => setSettingsData({ ...settingsData, allow_new_registrations: !settingsData.allow_new_registrations })}
              className={`flex justify-between items-center p-4 rounded-xl border transition-all cursor-pointer select-none
                ${settingsData.allow_new_registrations
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-white/5 border-white/5 hover:border-white/10'}`}
            >
              <div>
                <p className="text-sm font-medium text-white">อนุญาตให้มีลูกค้าใหม่สมัครสมาชิกบนแพลตฟอร์ม</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  หากปิดใช้งาน ปุ่มลงทะเบียนสำหรับหน้าแลนดิ้งเพจภายนอกจะปิดใช้งานชั่วคราวเพื่อไม่ให้สร้าง Tenant เพิ่มเติม
                </p>
              </div>
              {settingsData.allow_new_registrations ? (
                <ToggleRight className="w-8 h-8 text-emerald-400 shrink-0" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-600 shrink-0" />
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/5">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกกฎของแพลตฟอร์ม
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

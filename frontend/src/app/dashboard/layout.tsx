'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Scale, LayoutDashboard, Users, FileText, Calendar,
  FolderOpen, CreditCard, Bot, Settings, LogOut,
  Bell, Search, Menu, X, ChevronRight, UserCheck,
  ShieldCheck, ChevronLeft, Sparkles
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', labelShort: 'หน้าหลัก' },
  { href: '/clients',   icon: Users,           label: 'ลูกความ (CRM)', labelShort: 'ลูกความ' },
  { href: '/cases',     icon: Scale,           label: 'จัดการคดี', labelShort: 'คดี' },
  { href: '/calendar',  icon: Calendar,        label: 'ปฏิทิน & นัดหมาย', labelShort: 'ปฏิทิน' },
  { href: '/documents', icon: FolderOpen,      label: 'เอกสาร', labelShort: 'เอกสาร' },
  { href: '/hr',        icon: UserCheck,       label: 'บริหารงานบุคคล', labelShort: 'HR', adminOnly: true },
  { href: '/billing',   icon: CreditCard,      label: 'บัญชีและการเงิน', labelShort: 'บัญชี', adminOnly: true },
  { href: '/ai',        icon: Bot,             label: 'AI Assistant', labelShort: 'AI' },
  { href: '/dashboard/superadmin', icon: ShieldCheck,   label: 'ระบบควบคุมกลาง', labelShort: 'Admin', superAdminOnly: true },
]

// Bottom nav items (5 most important for mobile)
const bottomNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'หน้าหลัก' },
  { href: '/cases',     icon: Scale,           label: 'คดี' },
  { href: '/ai',        icon: Sparkles,        label: 'AI', featured: true },
  { href: '/clients',   icon: Users,           label: 'ลูกความ' },
  { href: '/calendar',  icon: Calendar,        label: 'ปฏิทิน' },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<any>({})
  const [searchFocused, setSearchFocused] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setUser(JSON.parse(localStorage.getItem('user') || '{}'))
      } catch { setUser({}) }
      // Auto-collapse sidebar on small screens
      if (window.innerWidth < 1280) setSidebarOpen(false)
    }

    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem('user')
        if (stored) setUser(JSON.parse(stored))
      } catch { /* ignore */ }
    }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('user-profile-updated', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('user-profile-updated', handleStorageChange)
    }
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const isSuperAdmin = user?.role === 'superadmin'
  const isAdminOrAbove = user?.role === 'admin' || user?.role === 'partner' || isSuperAdmin

  const visibleNavItems = navItems.filter(({ adminOnly, superAdminOnly }) => {
    if (superAdminOnly && !isSuperAdmin) return false
    if (adminOnly && !isAdminOrAbove) return false
    return true
  })

  const roleLabel: Record<string, string> = {
    superadmin: '⚡ Super Admin',
    admin: '🔧 Admin',
    partner: '🤝 Partner',
    lawyer: '⚖️ ทนายความ',
    clerk: '📋 เสมียน',
  }

  const currentPageLabel = navItems.find(n => n.href !== '/dashboard' ? pathname.startsWith(n.href) : pathname === n.href)?.label || 'Lawyer Tech'

  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">

      {/* ===== Mobile Overlay ===== */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ===== Sidebar ===== */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        flex flex-col h-full
        bg-[#0d1526] border-r border-white/5
        transition-all duration-300 ease-in-out flex-shrink-0
        ${sidebarOpen ? 'w-64' : 'w-[70px]'}
        ${mobileOpen ? 'translate-x-0 shadow-2xl shadow-black/50' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Area */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 ${!sidebarOpen ? 'justify-center' : ''}`}>
          <div className="flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <img src="/images/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          {sidebarOpen && (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-sm leading-tight">Lawyer Tech</p>
                <p className="text-[10px] text-slate-500">ERP & AI Platform</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors lg:flex hidden"
                title="ย่อ Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Thai Flag */}
        <div className="px-4 pt-3 pb-1">
          <div className="thai-flag-accent" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {visibleNavItems.map(({ href, icon: Icon, label, superAdminOnly }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-0' : ''} ${superAdminOnly ? 'mt-2 border-t border-white/5 pt-2' : ''}`}
                title={!sidebarOpen ? label : undefined}
              >
                <Icon className={`sidebar-icon w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                {sidebarOpen && (
                  <span className={`flex-1 truncate text-[13.5px] ${superAdminOnly ? 'text-rose-300' : ''}`}>
                    {label}
                  </span>
                )}
                {sidebarOpen && isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Settings + Logout + User */}
        <div className="border-t border-white/5 p-2 space-y-0.5">
          <Link
            href="/settings"
            className={`sidebar-link ${pathname.startsWith('/settings') ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-0' : ''}`}
            title={!sidebarOpen ? 'ตั้งค่า' : undefined}
          >
            <Settings className={`w-[18px] h-[18px] flex-shrink-0 ${pathname.startsWith('/settings') ? 'text-indigo-400' : 'text-slate-500'}`} />
            {sidebarOpen && <span className="text-[13.5px]">ตั้งค่า</span>}
          </Link>
          <button
            onClick={handleLogout}
            className={`sidebar-link w-full text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/5 ${!sidebarOpen ? 'justify-center px-0' : ''}`}
            title={!sidebarOpen ? 'ออกจากระบบ' : undefined}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {sidebarOpen && <span className="text-[13.5px]">ออกจากระบบ</span>}
          </button>

          {/* User info strip */}
          {sidebarOpen && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-xl bg-white/3 border border-white/5">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-indigo-300">
                  {user?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'ผู้ใช้'}</p>
                <p className="text-[10px] text-slate-500 truncate">{roleLabel[user?.role] || user?.role}</p>
              </div>
            </div>
          )}
        </div>

        {/* Expand button (collapsed state) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="hidden lg:flex absolute -right-3 top-24 w-6 h-6 bg-indigo-600 rounded-full items-center justify-center shadow-lg border border-indigo-500/50 z-10 hover:bg-indigo-500 transition-colors"
            title="ขยาย Sidebar"
          >
            <ChevronRight className="w-3 h-3 text-white" />
          </button>
        )}
      </aside>

      {/* ===== Main Content Area ===== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ===== Top Header ===== */}
        <header className="h-14 lg:h-16 flex items-center gap-3 px-4 lg:px-6 border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl flex-shrink-0">
          {/* Mobile: Hamburger + Page Title */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <h1 className="lg:hidden font-semibold text-white text-sm truncate flex-1">
            {currentPageLabel}
          </h1>

          {/* Desktop: Search */}
          <div className="hidden lg:flex flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาลูกความ, คดี, เอกสาร..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={`w-full bg-white/4 border rounded-xl pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none transition-all
                ${searchFocused
                  ? 'border-indigo-500/50 bg-white/6 ring-2 ring-indigo-500/15'
                  : 'border-white/8 hover:border-white/12'
                }`}
            />
          </div>

          {/* Right Actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-[#0a0f1e]" />
            </button>

            {/* User Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/8">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center cursor-pointer hover:bg-indigo-600/40 transition-colors">
                <span className="text-xs font-bold text-indigo-300">
                  {user?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{user?.full_name || 'ผู้ใช้'}</p>
                <p className="text-[10px] text-slate-500">{roleLabel[user?.role] || user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* ===== Page Content ===== */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 lg:p-6 pb-24 lg:pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* ===== Bottom Navigation Bar (Mobile Only) ===== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d1526]/95 backdrop-blur-2xl border-t border-white/6"
           style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
        <div className="flex items-center justify-around h-[58px]">
          {bottomNavItems.map(({ href, icon: Icon, label, featured }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all active:scale-90 ${
                  featured ? '-mt-4' : ''
                }`}
              >
                {featured ? (
                  // Featured center button (AI)
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/40'
                      : 'bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-500/30'
                  }`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                ) : (
                  <div className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                    isActive ? 'bg-indigo-500/15' : ''
                  }`}>
                    <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
                      {label}
                    </span>
                  </div>
                )}
                {featured && (
                  <span className={`text-[10px] font-semibold mt-1 transition-colors ${isActive ? 'text-amber-400' : 'text-indigo-400'}`}>
                    {label}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

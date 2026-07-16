import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Lawyer Tech ERP | ระบบบริหารสำนักงานกฎหมาย',
  description: 'ระบบ ERP และ AI สำหรับสำนักงานกฎหมาย — จัดการลูกความ คดี เอกสาร และการเงินครบวงจร',
  keywords: ['สำนักงานกฎหมาย', 'ERP', 'ทนายความ', 'จัดการคดี', 'AI กฎหมาย'],
  authors: [{ name: 'Lawyer Tech Team' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lawyer Tech',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    title: 'Lawyer Tech ERP',
    description: 'ระบบบริหารสำนักงานกฎหมายครบวงจร',
    siteName: 'Lawyer Tech ERP',
  },
  icons: {
    icon: '/images/logo.png',
    shortcut: '/images/logo.png',
    apple: '/images/logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* PWA iOS */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lawyer Tech" />
        {/* MS Tile */}
        <meta name="msapplication-TileColor" content="#6366f1" />
        <meta name="msapplication-tap-highlight" content="no" />
        {/* SW Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[SW] Registered:', reg.scope);
                  }).catch(function(err) {
                    console.log('[SW] Registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-dark-bg text-white antialiased">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '12px',
              fontSize: '14px',
              fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
              maxWidth: '380px',
              boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#fff' },
            },
          }}
        />
        {children}
      </body>
    </html>
  )
}

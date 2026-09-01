import type { Metadata, Viewport } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ورشة منتصر - نظام الإدارة',
  description: 'نظام إدارة الصيانة والمخزون لورشة منتصر للكهرباء السيارات',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="bg-[#f0f2f7] text-slate-800 font-cairo antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#1e1b4b',
              border: '1px solid #e2e4ef',
              fontFamily: 'var(--font-cairo)',
              direction: 'rtl',
              borderRadius: '14px',
              boxShadow: '0 8px 30px rgba(120,100,200,0.15)',
            },
            success: { iconTheme: { primary: '#7c3aed', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}

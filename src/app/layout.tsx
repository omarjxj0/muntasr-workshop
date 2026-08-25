import type { Metadata } from 'next'
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="bg-slate-950 text-slate-100 font-cairo antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              fontFamily: 'var(--font-cairo)',
              direction: 'rtl',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}

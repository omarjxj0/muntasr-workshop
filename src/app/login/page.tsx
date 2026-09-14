'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('بيانات الدخول غير صحيحة')
      setLoading(false)
      return
    }

    toast.success('مرحباً بك!')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f7] relative overflow-hidden p-4">
      {/* Background decorative blobs */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8 space-y-3">
          <div className="flex justify-center">
            <div className="w-24 h-24 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="ورشة منتصر"
                width={96}
                height={96}
                className="w-full h-full object-contain"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text">ورشة منتصر</h1>
          <p className="text-slate-500">كهرباء السيارات — نظام الإدارة</p>
        </div>

        {/* Login Card */}
        <div className="soft-card p-8 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 text-center">تسجيل الدخول</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-500 mb-2 font-medium">البريد الإلكتروني</label>
              <div className="relative">
                <Mail size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@montaser.com"
                  className="w-full pr-10 pl-4 py-3 rounded-2xl text-slate-700 transition-all border-2 border-slate-200 bg-white focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] placeholder-slate-400"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-2 font-medium">كلمة المرور</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-4 py-3 rounded-2xl text-slate-700 transition-all border-2 border-slate-200 bg-white focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] placeholder-slate-400"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl font-bold text-lg transition-all duration-200 text-white disabled:opacity-60 mt-2"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                boxShadow: '0 6px 20px rgba(124,58,237,0.4)',
              }}
            >
              {loading ? 'جارٍ الدخول...' : 'دخول'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          ورشة منتصر للكهرباء السيارات © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

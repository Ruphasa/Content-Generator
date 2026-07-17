import { login } from '@/app/actions/auth'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function LoginPage({ searchParams }: { searchParams: { registered?: string } }) {
  const isRegistered = searchParams?.registered === 'true'

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Decorators */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--venturo-teal)]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--venturo-teal)]/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="glass rounded-3xl p-8 w-full max-w-md relative z-10 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[var(--venturo-teal)] to-[var(--venturo-dark)] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Selamat Datang Kembali</h2>
        <p className="text-center text-gray-500 mb-8">Login untuk melanjutkan pembuatan AI Video Anda.</p>

        {isRegistered && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-6 text-sm text-center border border-green-200">
            Pendaftaran berhasil! Silakan login dengan akun Anda.
          </div>
        )}

        <form action={async (formData) => { "use server"; await login(formData); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              name="email"
              type="email" 
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              name="password"
              type="password" 
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] transition-all"
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full mt-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--venturo-teal)] to-[var(--venturo-dark)] text-white shadow-lg shadow-[var(--venturo-teal)]/30 hover:scale-[1.02] transition-transform"
          >
            Login <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Belum punya akun?{' '}
          <Link href="/register" className="text-[var(--venturo-teal)] font-bold hover:underline">
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  )
}

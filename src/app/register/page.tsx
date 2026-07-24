import { signup } from '@/app/actions/auth'
import Link from 'next/link'
import { Sparkles, UserPlus } from 'lucide-react'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Decorators */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-gradient-to-br from-[var(--venturo-teal)]/40 to-blue-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-emerald-400/20 to-[var(--venturo-teal)]/40 rounded-full blur-[150px] pointer-events-none mix-blend-multiply" />

      <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 w-full max-w-md relative z-10 shadow-[0_8px_32px_0_rgba(31,38,135,0.1)]">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[var(--venturo-teal)] to-[var(--venturo-dark)] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Buat Akun Baru</h2>
        <p className="text-center text-gray-500 mb-8">Bergabunglah dan mulai ciptakan video AI tanpa batas.</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm text-center border border-red-200">
            {error}
          </div>
        )}

        <form action={async (formData) => { "use server"; await signup(formData); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              name="email"
              type="email" 
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] transition-all text-gray-800 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              name="password"
              type="password" 
              required
              placeholder="Minimal 6 karakter"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] transition-all text-gray-800 placeholder-gray-400"
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full mt-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--venturo-teal)] to-[var(--venturo-dark)] text-white shadow-lg shadow-[var(--venturo-teal)]/30 hover:scale-[1.02] transition-transform"
          >
            Daftar <UserPlus className="w-5 h-5" />
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-[var(--venturo-teal)] font-bold hover:underline">
            Login di sini
          </Link>
        </p>
      </div>
    </div>
  )
}

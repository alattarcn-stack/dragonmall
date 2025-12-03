'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'

export function Header() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const { itemCount } = useCart()

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  return (
    <header className="border-b bg-white backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-40 max-w-[650px] mx-auto w-full">
      <div className="px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Dragon Station
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/products">Products</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="relative">
              <Link href="/cart">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>
            </Button>
            {loading ? (
              <div className="w-20 h-8" /> // Placeholder for loading
            ) : user ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/account/orders">My Account</Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/login">Login</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

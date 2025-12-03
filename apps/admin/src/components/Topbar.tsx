'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function Topbar() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/admin/auth/logout`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest', // CSRF protection
        },
        credentials: 'include',
      })
      // Cookie is cleared by server, just redirect
      router.push('/admin/login')
    } catch (error) {
      console.error('Logout error:', error)
      // Even on error, redirect to login
      router.push('/admin/login')
    }
  }

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold">Admin Panel</h2>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}


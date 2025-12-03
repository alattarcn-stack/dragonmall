'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check if user is logged in by calling /api/admin/auth/me
    if (pathname !== '/admin/login') {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/admin/auth/me`, {
        credentials: 'include',
      })
        .then(res => {
          if (!res.ok) {
            // Not authenticated, redirect to login
            router.push('/admin/login')
          }
        })
        .catch(() => {
          // Error checking auth, redirect to login
          router.push('/admin/login')
        })
    }
  }, [pathname, router])

  // Don't show sidebar/topbar on login page
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (!mounted) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-800 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}


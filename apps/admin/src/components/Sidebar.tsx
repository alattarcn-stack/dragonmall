import Link from 'next/link'

export default function Sidebar() {
  const menuItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/products', label: 'Products', icon: '📦' },
    { href: '/admin/categories', label: 'Categories', icon: '🏷️' },
    { href: '/admin/coupons', label: 'Coupons', icon: '🎟️' },
    { href: '/admin/orders', label: 'Orders', icon: '🛒' },
    { href: '/admin/inventory', label: 'Inventory', icon: '📋' },
    { href: '/admin/support', label: 'Support', icon: '🎫' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <aside className="w-64 bg-gray-800 dark:bg-gray-900 text-white">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Dragon Station</h1>
        <p className="text-gray-400 text-sm">Admin Panel</p>
      </div>
      <nav className="mt-6">
        <ul>
          {menuItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition"
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}


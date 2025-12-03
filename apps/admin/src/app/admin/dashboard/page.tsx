'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiClient } from '@dragon/api'

interface DashboardData {
  totalRevenueLast30Days: number
  ordersLast30Days: number
  totalCustomers: number
  revenueByDay: Array<{ date: string; total: number }>
  topProducts: Array<{ productId: number; name: string; totalRevenue: number; quantitySold: number }>
  recentOrders: any[]
  totalProducts: number
  totalUsers: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const response = await apiClient.get<{ data: DashboardData }>('/api/admin/dashboard')
      setData(response.data.data)
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!data) {
    return <div className="text-center py-8">Failed to load dashboard</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Revenue (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(data.totalRevenueLast30Days / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Orders (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.ordersLast30Days}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalCustomers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-1">
            {data.revenueByDay.map((day, index) => {
              const maxRevenue = Math.max(...data.revenueByDay.map((d) => d.total), 1)
              const height = maxRevenue > 0 ? (day.total / maxRevenue) * 100 : 0
              const date = new Date(day.date)
              const dayLabel = date.getDate()
              const monthLabel = date.toLocaleDateString('en-US', { month: 'short' })

              return (
                <div key={index} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                    style={{ height: `${height}%` }}
                    title={`${monthLabel} ${dayLabel}: $${(day.total / 100).toFixed(2)}`}
                  />
                  {index % 5 === 0 && (
                    <span className="text-xs text-gray-500 mt-1">{dayLabel}</span>
                  )}
                  <div className="hidden group-hover:block absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                    {monthLabel} {dayLabel}: ${(day.total / 100).toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topProducts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProducts.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.quantitySold}</TableCell>
                    <TableCell className="text-right">
                      ${(product.totalRevenue / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-4">No products sold in the last 30 days</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentOrders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.id}</TableCell>
                    <TableCell>{order.customer_email}</TableCell>
                    <TableCell>${((order.amount || 0) / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          order.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date((order.created_at || 0) * 1000).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent orders</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

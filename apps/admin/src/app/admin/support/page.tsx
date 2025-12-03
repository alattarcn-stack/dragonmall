'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { getSupportTickets, replyToTicket } from '@dragon/api'
import type { SupportTicket } from '@dragon/core'

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [replyDialogOpen, setReplyDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    try {
      const data = await getSupportTickets()
      setTickets(data)
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return

    try {
      await replyToTicket(selectedTicket.id, replyText)
      setReplyDialogOpen(false)
      setReplyText('')
      setSelectedTicket(null)
      fetchTickets()
      alert('Reply sent successfully')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const openReplyDialog = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setReplyText('')
    setReplyDialogOpen(true)
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Support Tickets</h1>

      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Ticket #{selectedTicket?.id}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Original Message</label>
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-sm">
                  {selectedTicket.content}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Your Reply</label>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={6}
                  placeholder="Enter your reply..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReply}>Send Reply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>#{ticket.id}</TableCell>
                <TableCell>{ticket.userId}</TableCell>
                <TableCell>{ticket.orderId || '-'}</TableCell>
                <TableCell className="max-w-md truncate">{ticket.content}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${
                    ticket.status === 'completed' ? 'bg-green-100 text-green-800' :
                    ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ticket.status}
                  </span>
                </TableCell>
                <TableCell>
                  {new Date((ticket.createdAt || 0) * 1000).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => openReplyDialog(ticket)}>
                    Reply
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


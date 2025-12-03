'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    siteName: 'Dragon Station',
    siteDescription: 'Premium Digital Products & License Codes',
    stripePublishableKey: '',
    paypalClientId: '',
  })

  const handleSave = async () => {
    setSaving(true)
    // TODO: Implement settings save API
    setTimeout(() => {
      setSaving(false)
      alert('Settings saved (placeholder)')
    }, 1000)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Site Name</label>
              <Input
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Site Description</label>
              <Textarea
                value={settings.siteDescription}
                onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Stripe Publishable Key</label>
              <Input
                type="password"
                value={settings.stripePublishableKey}
                onChange={(e) => setSettings({ ...settings, stripePublishableKey: e.target.value })}
                placeholder="pk_live_..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Set via environment variables in production
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PayPal Client ID</label>
              <Input
                type="password"
                value={settings.paypalClientId}
                onChange={(e) => setSettings({ ...settings, paypalClientId: e.target.value })}
                placeholder="PayPal Client ID"
              />
              <p className="text-xs text-gray-500 mt-1">
                Set via environment variables in production
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}


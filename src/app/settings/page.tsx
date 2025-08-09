'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { 
  User, 
  Building, 
  Key, 
  Bell, 
  Globe, 
  Shield,
  Save,
  Copy,
  RefreshCw
} from "lucide-react"

export default function SettingsPage() {
  const [tenant, setTenant] = useState({
    name: 'Demo Organization',
    domain: 'demo.rp9.com',
    apiKey: 'rp9_demo_1234567890abcdef',
    webhookUrl: 'https://demo.rp9.com/webhooks',
    notifications: {
      email: true,
      slack: false,
      webhook: true
    },
    limits: {
      workflows: 50,
      executions: 10000,
      storage: '1GB'
    }
  })

  const [user, setUser] = useState({
    name: 'John Doe',
    email: 'john@company.com',
    role: 'owner',
    lastLogin: '2024-01-23T10:30:00Z'
  })

  const handleSave = () => {
    // In production, save to API
    console.log('Saving settings:', { tenant, user })
  }

  const generateNewApiKey = () => {
    const newKey = 'rp9_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
    setTenant(prev => ({ ...prev, apiKey: newKey }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Show toast notification in production
    console.log('Copied to clipboard:', text)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and workspace configuration
        </p>
      </div>

      <div className="grid gap-6">
        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Profile
            </CardTitle>
            <CardDescription>
              Your personal account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userName">Full Name</Label>
                <Input
                  id="userName"
                  value={user.name}
                  onChange={(e) => setUser(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userEmail">Email</Label>
                <Input
                  id="userEmail"
                  type="email"
                  value={user.email}
                  onChange={(e) => setUser(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <Label>Role</Label>
                <Badge variant="secondary" className="ml-2">{user.role}</Badge>
              </div>
              <div>
                <Label>Last Login</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(user.lastLogin).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organization
            </CardTitle>
            <CardDescription>
              Workspace and tenant configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={tenant.name}
                  onChange={(e) => setTenant(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgDomain">Domain</Label>
                <Input
                  id="orgDomain"
                  value={tenant.domain}
                  onChange={(e) => setTenant(prev => ({ ...prev, domain: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Usage Limits</Label>
              <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="text-center">
                  <div className="text-2xl font-bold">23/{tenant.limits.workflows}</div>
                  <div className="text-sm text-muted-foreground">Workflows</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">1.2k/{tenant.limits.executions}</div>
                  <div className="text-sm text-muted-foreground">Executions/month</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">245MB/{tenant.limits.storage}</div>
                  <div className="text-sm text-muted-foreground">Storage</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription>
              API keys and webhook configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={tenant.apiKey}
                  readOnly
                  className="font-mono"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(tenant.apiKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={generateNewApiKey}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Keep your API key secure. It provides full access to your workflows.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={tenant.webhookUrl}
                  onChange={(e) => setTenant(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  className="font-mono"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(tenant.webhookUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you receive alerts and updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts about workflow failures and updates
                </p>
              </div>
              <Switch
                checked={tenant.notifications.email}
                onCheckedChange={(checked) =>
                  setTenant(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, email: checked }
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Slack Integration</Label>
                <p className="text-sm text-muted-foreground">
                  Send notifications to your Slack workspace
                </p>
              </div>
              <Switch
                checked={tenant.notifications.slack}
                onCheckedChange={(checked) =>
                  setTenant(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, slack: checked }
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Webhook Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  HTTP callbacks for workflow events
                </p>
              </div>
              <Switch
                checked={tenant.notifications.webhook}
                onCheckedChange={(checked) =>
                  setTenant(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, webhook: checked }
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
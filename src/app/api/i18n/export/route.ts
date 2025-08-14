import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { locale } = await request.json()
    
    if (!locale) {
      return NextResponse.json(
        { error: 'Locale is required' },
        { status: 400 }
      )
    }

    const { data: messages, error } = await supabase
      .from('i18n_messages')
      .select('namespace, message_key, message_value')
      .eq('locale', locale)
      .eq('status', 'active')
      .order('namespace')
      .order('message_key')

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Group messages by namespace
    const groupedMessages: Record<string, Record<string, string>> = {}
    
    messages?.forEach(msg => {
      if (!groupedMessages[msg.namespace]) {
        groupedMessages[msg.namespace] = {}
      }
      groupedMessages[msg.namespace][msg.message_key] = msg.message_value
    })

    // Create the final JSON structure
    const exportData = {
      locale,
      messages: groupedMessages,
      exportedAt: new Date().toISOString(),
      count: messages?.length || 0
    }

    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="${locale}.json"`,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
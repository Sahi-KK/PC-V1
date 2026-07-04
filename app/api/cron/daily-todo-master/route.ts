import { NextRequest, NextResponse } from 'next/server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

function getService() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  // Verify Vercel Cron Secret
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const service = getService()
  const appScriptUrl = process.env.APPSCRIPT_WEBHOOK_URL
  
  if (!appScriptUrl) {
    return NextResponse.json({ error: 'APPSCRIPT_WEBHOOK_URL not configured' }, { status: 500 })
  }

  // Get today's date string YYYY-MM-DD in IST
  const today = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
  const todayDate = new Date(today)
  const dateStr = todayDate.getFullYear() + '-' + String(todayDate.getMonth() + 1).padStart(2, '0') + '-' + String(todayDate.getDate()).padStart(2, '0')
  const displayDate = todayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // 1. Fetch todos for today
  const { data: todos, error: tErr } = await service.from('todos').select('*').eq('event_date', dateStr).order('start_time', { ascending: true })
  if (tErr || !todos) {
    return NextResponse.json({ error: 'Could not fetch todos' }, { status: 500 })
  }

  if (todos.length === 0) {
    return NextResponse.json({ message: 'No todos for today' })
  }

  // 2. Group by user_id
  const userTodos: Record<string, any[]> = {}
  todos.forEach(t => {
    if (!userTodos[t.user_id]) userTodos[t.user_id] = []
    userTodos[t.user_id].push(t)
  })

  // 3. Fetch user profiles for those users
  const userIds = Object.keys(userTodos)
  const { data: users, error: uErr } = await service.from('user_profiles').select('id, name, email').in('id', userIds)
  if (uErr || !users) {
    return NextResponse.json({ error: 'Could not fetch users' }, { status: 500 })
  }

  let emailsSent = 0

  for (const user of users) {
    const userEvents = userTodos[user.id]
    if (!userEvents || userEvents.length === 0) continue

    let eventsHtml = userEvents.map(e => `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
        <h3 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px;">${e.title}</h3>
        ${e.description ? `<p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">${e.description}</p>` : ''}
        <div style="color: #2563eb; font-weight: 600; font-size: 14px;">⏰ ${e.start_time.slice(0, 5)}</div>
      </div>
    `).join('')

    const htmlBody = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #2563eb; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Your Daily To-Do List</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">${displayDate}</p>
        </div>
        
        <div style="padding: 24px;">
          <p style="font-size: 16px; color: #334155; margin-top: 0;">Hi ${user.name.split(' ')[0]},</p>
          <p style="font-size: 16px; color: #334155;">Here are your scheduled tasks and events for today:</p>
          
          <div style="margin-top: 24px;">
            ${eventsHtml}
          </div>
        </div>
      </div>
    `

    // Send master email via AppsScript
    await fetch(appScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.email,
        subject: `Your To-Do List for ${displayDate}`,
        body: htmlBody
      })
    }).catch(err => console.error("Error sending mail", err))
    
    // Schedule 1-hour and 30-min reminders
    for (const e of userEvents) {
      const [h, m] = e.start_time.split(':')
      const eventTime = new Date(todayDate)
      eventTime.setHours(parseInt(h), parseInt(m), 0, 0)
      
      const oneHourBefore = new Date(eventTime.getTime() - 60 * 60 * 1000)
      const thirtyMinsBefore = new Date(eventTime.getTime() - 30 * 60 * 1000)
      
      const reminderBody = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #f59e0b; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Upcoming Task Reminder</h1>
          </div>
          <div style="padding: 24px;">
            <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px;">${e.title}</h3>
            ${e.description ? `<p style="margin: 0 0 16px 0; color: #64748b; font-size: 15px;">${e.description}</p>` : ''}
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; color: #334155; font-weight: 600;">
              Starting at: ${e.start_time.slice(0, 5)}
            </div>
          </div>
        </div>
      `

      // 1 hour before
      if (oneHourBefore > new Date()) {
        await fetch(appScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            subject: `Reminder: ${e.title} starts in 1 hour`,
            body: reminderBody,
            sendAt: oneHourBefore.getTime()
          })
        }).catch(err => console.error("Error scheduling 1hr reminder", err))
      }

      // 30 mins before
      if (thirtyMinsBefore > new Date()) {
        await fetch(appScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            subject: `Reminder: ${e.title} starts in 30 minutes`,
            body: reminderBody,
            sendAt: thirtyMinsBefore.getTime()
          })
        }).catch(err => console.error("Error scheduling 30min reminder", err))
      }
    }

    emailsSent++
  }

  return NextResponse.json({ message: `Sent ${emailsSent} master todo emails and scheduled reminders.` })
}

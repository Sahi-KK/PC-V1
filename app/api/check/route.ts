import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServiceClient()
  
  // Grab 1 row to see the columns
  const { data } = await supabase.from('user_profiles').select('*').limit(1)
  
  return NextResponse.json({ 
    user_profiles: data && data.length > 0 ? Object.keys(data[0]) : "No data"
  })
}

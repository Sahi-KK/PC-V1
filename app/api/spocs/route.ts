import { NextRequest, NextResponse } from 'next/server'
import spocsData from '@/data/spocs.json'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.toLowerCase() || ''
  
  if (!query) {
    return NextResponse.json({ results: [] })
  }

  const results = spocsData.filter(s => 
    s.name.toLowerCase().includes(query) || 
    s.roll_no.toLowerCase().includes(query)
  )

  return NextResponse.json({ results: results.slice(0, 10) }) // Return top 10 results
}

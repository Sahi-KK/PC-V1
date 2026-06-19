export const dynamic = 'force-dynamic'

import MobileNav from '@/components/MobileNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MobileNav />
    </>
  )
}

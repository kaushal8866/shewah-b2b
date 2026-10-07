import React from 'react'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BlogAdminClient from './BlogAdminClient'

export const metadata: Metadata = {
  title: 'Editorial Blog Management | SHEWAH Admin',
  description: 'Manage journal articles, revisions, publishing policies, and scoped API credentials.',
  robots: { index: false, follow: false },
}

export default async function BlogAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=%2Fadmin%2Fblog')
  }

  const role = (session.user as any).role
  const permissions = (session.user as any).permissions || []
  const isMaster = role === 'master'

  if (!isMaster && !permissions.includes('blog')) {
    redirect('/dashboard')
  }

  return <BlogAdminClient currentUser={{ id: session.user.id, name: session.user.name, isMaster }} />
}

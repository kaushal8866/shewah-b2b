import type { Metadata } from 'next'
import EditorialSubmitClient from './EditorialSubmitClient'

export const metadata: Metadata = {
  title: 'Editorial Submission | SHEWAH Atelier',
  description: 'Restricted draft submission gateway for external editorial assistants.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export const dynamic = 'force-dynamic'

export default function EditorialSubmitPage() {
  return <EditorialSubmitClient />
}

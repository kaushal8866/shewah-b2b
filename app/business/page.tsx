import { Metadata } from 'next'
import LandingPage from '../LandingPage'

export const metadata: Metadata = {
  title: 'Shewah for Business | Jewellery Manufacturers & Retailer Network',
  description: 'Direct jewellery atelier manufacturing, wholesale diamond supply, CAD studio, and white-label collections for retail jewellers and luxury brands.',
}

export default function BusinessPage() {
  return <LandingPage />
}

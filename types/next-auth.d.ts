import NextAuth, { DefaultSession } from 'next-auth'
import { JWT } from 'next-auth/jwt'

export type AppRole = 'master' | 'sub' | 'manufacturer' | 'retailer' | 'reseller'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      displayName: string
      role: AppRole
      permissions: string[]
      manufacturingPartnerId?: string | null
      partnerId?: string | null
      resellerId?: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    username: string
    displayName: string
    role: AppRole
    permissions: string[]
    manufacturingPartnerId?: string | null
    partnerId?: string | null
    resellerId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    displayName: string
    role: AppRole
    permissions: string[]
    manufacturingPartnerId?: string | null
    partnerId?: string | null
    resellerId?: string | null
  }
}

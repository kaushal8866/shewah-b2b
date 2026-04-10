import NextAuth, { DefaultSession } from 'next-auth'
import { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      displayName: string
      role: 'master' | 'sub'
      permissions: string[]
    } & DefaultSession['user']
  }

  interface User {
    id: string
    username: string
    displayName: string
    role: 'master' | 'sub'
    permissions: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    displayName: string
    role: 'master' | 'sub'
    permissions: string[]
  }
}

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const supabaseAdmin = getAdminClient()
        const { data: user, error } = await supabaseAdmin
          .from('app_users')
          .select('*')
          .eq('username', credentials.username.toLowerCase().trim())
          .eq('is_active', true)
          .single()

        if (error || !user) return null

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.display_name || user.username,
          username: user.username,
          displayName: user.display_name || user.username,
          role: user.role,
          permissions: user.permissions || [],
          manufacturingPartnerId: user.manufacturing_partner_id ?? null,
          partnerId: user.partner_id ?? null,
          resellerId: user.reseller_id ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = (user as any).username
        token.displayName = (user as any).displayName || (user as any).username
        token.role = (user as any).role
        token.permissions = (user as any).permissions
        token.manufacturingPartnerId = (user as any).manufacturingPartnerId ?? null
        token.partnerId = (user as any).partnerId ?? null
        token.resellerId = (user as any).resellerId ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.username = token.username
        session.user.displayName = token.displayName
        session.user.role = token.role
        session.user.permissions = token.permissions
        session.user.manufacturingPartnerId = token.manufacturingPartnerId ?? null
        session.user.partnerId = token.partnerId ?? null
        session.user.resellerId = token.resellerId ?? null
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

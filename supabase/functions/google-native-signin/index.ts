import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'npm:jose@5.9.6'
import { z } from 'npm:zod@3.25.76'

const GOOGLE_WEB_CLIENT_ID =
  '333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com'
const GOOGLE_IOS_CLIENT_ID =
  '333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com'
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

const BodySchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
  nonce: z.string().min(1, 'nonce is required'),
})

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function getAudienceList(aud: unknown): string[] {
  if (Array.isArray(aud)) {
    return aud.filter((value): value is string => typeof value === 'string')
  }
  return typeof aud === 'string' ? [aud] : []
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  console.log('google-native-signin invoked')

  let parsedBody: z.infer<typeof BodySchema>
  try {
    parsedBody = BodySchema.parse(await req.json())
  } catch (error) {
    return json(400, {
      error: 'invalid_request',
      details: error instanceof z.ZodError ? error.flatten().fieldErrors : 'Invalid JSON body',
    })
  }

  const { idToken, nonce } = parsedBody

  try {
    const nonceDigest = await sha256Hex(nonce)
    const decoded = decodeJwt(idToken)
    const audiences = getAudienceList(decoded.aud)

    if (!audiences.some((aud) => aud === GOOGLE_WEB_CLIENT_ID || aud === GOOGLE_IOS_CLIENT_ID)) {
      return json(401, {
        error: 'invalid_audience',
        audiences,
      })
    }

    if (typeof decoded.iss !== 'string' || !GOOGLE_ISSUERS.includes(decoded.iss)) {
      return json(401, { error: 'invalid_issuer', issuer: decoded.iss ?? null })
    }

    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: [GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID],
    })

    if (typeof payload.nonce !== 'string' || payload.nonce !== nonceDigest) {
      return json(401, { error: 'invalid_nonce' })
    }

    if (payload.email_verified !== true || typeof payload.email !== 'string' || payload.email.length === 0) {
      return json(401, { error: 'email_not_verified' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(500, { error: 'server_misconfigured' })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const appClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: payload.email,
      options: {
        data: {
          name: typeof payload.name === 'string' ? payload.name : undefined,
          avatar_url: typeof payload.picture === 'string' ? payload.picture : undefined,
          provider: 'google',
          google_sub: typeof payload.sub === 'string' ? payload.sub : undefined,
          email_verified: true,
        },
      },
    })

    if (linkError || !linkData?.properties?.email_otp) {
      console.error('generateLink failed', linkError)
      return json(401, { error: linkError?.message ?? 'magiclink_generation_failed' })
    }

    const { data: verifyData, error: verifyError } = await appClient.auth.verifyOtp({
      email: payload.email,
      token: linkData.properties.email_otp,
      type: 'magiclink',
    })

    if (verifyError || !verifyData.session || !verifyData.user) {
      console.error('verifyOtp failed', verifyError)
      return json(401, { error: verifyError?.message ?? 'session_creation_failed' })
    }

    return json(200, {
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
      session: verifyData.session,
      user: verifyData.user,
    })
  } catch (error) {
    console.error('google-native-signin error', error)
    return json(401, {
      error: error instanceof Error ? error.message : 'Authentication failed',
    })
  }
})
import { createClient } from '@supabase/supabase-js'

// Client-side Supabase client (uses anon key — safe for browser)
// Use this for reading data from the Archive
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side Supabase client (uses service role key — bypasses RLS)
// Use this in API routes that need to insert/update sessions
export function getServiceSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Generate a URL-friendly slug from an issue
// "How should Europe handle energy dependence?" → "europe-energy-dependence-a7f3"
export function generateSlug(text) {
  if (!text) return ''
  
  // Strip stop words and limit to key terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall',
    'how', 'what', 'when', 'where', 'why', 'which', 'who', 'whom',
    'this', 'that', 'these', 'those', 'it', 'its', 'their',
  ])
  
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(w => w && !stopWords.has(w))
    .slice(0, 6)
    .join('-')
  
  // Add short random suffix for uniqueness
  const suffix = Math.random().toString(36).substring(2, 6)
  
  return slug ? `${slug}-${suffix}` : suffix
}

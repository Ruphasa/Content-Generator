import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jniuchaccisvtpgtasus.supabase.co',
  'sb_publishable_IzAAYD4pd_SJ6Pt3VEA2Bw_MH9lVe-3'
)

async function testSupabase() {
  console.log("Testing Supabase connection...")
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error("Supabase Error:", error.message)
  } else {
    console.log("Supabase connection successful!")
  }
}

testSupabase()

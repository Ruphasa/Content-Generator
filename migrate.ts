import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing in environment variables');
  process.exit(1);
}

const client = new Client({
  connectionString,
});

async function createTable() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres database.');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ai_responses_cache (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          prompt_hash TEXT UNIQUE NOT NULL,
          response_text TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;
    await client.query(createTableQuery);
    console.log('Table "ai_responses_cache" created or already exists.');

    const enableRlsQuery = `
      ALTER TABLE ai_responses_cache ENABLE ROW LEVEL SECURITY;
    `;
    await client.query(enableRlsQuery);
    console.log('Row Level Security enabled for "ai_responses_cache".');

    // Drop policy if exists to avoid error on rerun
    const dropPolicyQuery = `
      DROP POLICY IF EXISTS "Allow public read/write to cache" ON ai_responses_cache;
    `;
    await client.query(dropPolicyQuery);

    const createPolicyQuery = `
      CREATE POLICY "Allow public read/write to cache" 
      ON ai_responses_cache FOR ALL 
      USING (true) WITH CHECK (true);
    `;
    await client.query(createPolicyQuery);
    console.log('Policy "Allow public read/write to cache" created.');

    // Let's verify the table exists by inserting a test row and reading it
    const testHash = 'test_hash_123';
    const testResponse = 'This is a test response';
    
    // Insert test
    await client.query(`
      INSERT INTO ai_responses_cache (prompt_hash, response_text) 
      VALUES ($1, $2)
      ON CONFLICT (prompt_hash) DO UPDATE SET response_text = $2
    `, [testHash, testResponse]);
    console.log('Test row inserted.');

    // Select test
    const res = await client.query('SELECT * FROM ai_responses_cache WHERE prompt_hash = $1', [testHash]);
    if (res.rows.length > 0 && res.rows[0].response_text === testResponse) {
      console.log('✅ VERIFICATION SUCCESS: Table is fully functional and accessible!');
    } else {
      console.log('❌ VERIFICATION FAILED: Could not read the test row.');
    }

  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await client.end();
  }
}

createTable();

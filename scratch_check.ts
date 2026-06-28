import { createClient } from '@supabase/supabase-js';

async function run() {
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('Querying as anon user:');
  const { data: sh, error: shErr } = await anonClient.from('diamond_shapes').select('id, name');
  console.log('Shapes (anon):', sh, shErr);

  const { data: sz, error: szErr } = await anonClient.from('diamond_sizes').select('id, label');
  console.log('Sizes (anon):', sz, szErr);
}

run();

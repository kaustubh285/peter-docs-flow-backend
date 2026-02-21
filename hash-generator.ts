// Hash generator for test users
// Run with: npx tsx hash-generator.ts

import bcrypt from 'bcryptjs'

async function generateHashes() {
  console.log('🔒 Generating password hashes for test users...')
  
  const advisorHash = await bcrypt.hash('advisor123', 10)
  const customerHash = await bcrypt.hash('customer123', 10)
  
  console.log('
📋 Use these hashes in your database_setup.sql:')
  console.log('
Advisor hash (advisor123):')
  console.log(advisorHash)
  console.log('
Customer hash (customer123):')
  console.log(customerHash)
  
  console.log('
📝 Updated SQL:')
  console.log(`
INSERT INTO users (id, name, email, password_hash, role) VALUES
  (gen_random_uuid(), 'John Smith', 'advisor@test.com', '${advisorHash}', 'advisor'),
  (gen_random_uuid(), 'Sarah Jones', 'customer@test.com', '${customerHash}', 'customer');
  `)
}

generateHashes().catch(console.error)

// Test script to verify setup
// Run with: npx tsx test-connection.ts

import dotenv from 'dotenv'
import { SupabaseService } from './src/services/supabase.service'

dotenv.config()

async function testConnection() {
  console.log('🧪 Testing Financial Advisor Helper API setup...')
  
  // Check environment variables
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '))
    console.log('Please update your .env file with the correct values')
    return
  }
  
  console.log('✅ Environment variables found')
  
  try {
    // Test Supabase connection
    const supabase = new SupabaseService()
    console.log('✅ Supabase service initialized')
    
    // Test database connection
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error) {
      console.error('❌ Database connection failed:', error.message)
    } else {
      console.log('✅ Database connection successful')
    }
    
    console.log('
🎉 Setup verification complete!')
    console.log('
📋 Next steps:')
    console.log('1. Run: npm install')
    console.log('2. Generate password hashes: npx tsx hash-generator.ts')
    console.log('3. Run the SQL from database_setup.sql in Supabase')
    console.log('4. Start the API: npm run dev')
    
  } catch (error) {
    console.error('❌ Setup verification failed:', error)
  }
}

testConnection()

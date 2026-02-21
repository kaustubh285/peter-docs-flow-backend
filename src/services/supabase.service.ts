import { createClient, SupabaseClient } from '@supabase/supabase-js'

export class SupabaseService {
  private client: SupabaseClient
  public auth: SupabaseClient['auth']
  public storage: SupabaseClient['storage']

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_ANON_KEY!
    
    this.client = createClient(supabaseUrl, supabaseKey)
    this.auth = this.client.auth
    this.storage = this.client.storage
  }

  from(table: string) {
    return this.client.from(table)
  }

  // Helper method for service key operations
  getServiceClient() {
    const supabaseUrl = process.env.SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_KEY!
    return createClient(supabaseUrl, serviceKey)
  }
}

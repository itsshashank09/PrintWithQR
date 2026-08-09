-- Update Shops Table with Free Trial and Bot Protection columns
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS printer_model TEXT,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS free_prints_allowed INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS free_prints_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS device_hash TEXT,
ADD COLUMN IF NOT EXISTS ip_hash TEXT,
ADD COLUMN IF NOT EXISTS registration_device_risk TEXT,
ADD COLUMN IF NOT EXISTS registration_ip_risk TEXT,
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;

-- Create Registration Attempts table for rate limiting and bot tracking
CREATE TABLE IF NOT EXISTS public.registration_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT,
  phone_hash TEXT,
  device_hash TEXT,
  ip_hash TEXT,
  is_success BOOLEAN,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for registration_attempts (only service role can access)
ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;

source .env
supabase login --token $SUPABASE_TOKEN
supabase init --force
supabase link --project-ref $SUPABASE_PROJECT_REF
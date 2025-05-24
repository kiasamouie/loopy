source .env
supabase login --token $SUPABASE_TOKEN
supabase link --project-ref $SUPABASE_PROJECT_REF
supabase db push
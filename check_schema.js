import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Read from environment variables (set in .env.local or shell)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.');
    console.error('Set them in your shell or create a .env.local file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    try {
        console.log("Checking connection...");
        const { data, error } = await supabase.from('projects').select('id').limit(1);
        console.log("Projects check:", { data, error });

        if (error || !data || data.length === 0) {
            console.warn("Could not fetch a project. RLS might be blocking anon access, or no projects exist.");
            // We can't proceed with insert if we don't have a valid project_id FK usually.
            // But let's try to see if table exists by selecting from it.
        }

        console.log("Checking project_photos existence...");
        const { error: photoError } = await supabase.from('project_photos').select('id').limit(1);
        if (photoError) {
            console.error("Table check failed:", photoError);
            if (photoError.code === 'PGRST205') {
                console.error("CONFIRMED: Table project_photos does not exist or is hidden.");
            }
        } else {
            console.log("Table project_photos accessible.");
        }

    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

checkSchema()

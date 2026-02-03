import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const supabaseUrl = 'https://zozohlwhjqxittkpgikv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpvem9obHdoanF4aXR0a3BnaWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzM3MzAsImV4cCI6MjA3OTMwOTczMH0.4yUK3w6R-fCDBOzFFf55naEkZoA6_clcmT96PLqleEY';
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    const { data, error } = await supabase.from('tasks').select('*').limit(1)
    if (error) {
        console.error('Error fetching tasks:', error)
        return
    }
    if (data && data.length > 0) {
        fs.writeFileSync('schema_output.txt', JSON.stringify(Object.keys(data[0]), null, 2))
        console.log('Schema written to schema_output.txt')
    } else {
        console.log('No tasks found to inspect columns.')
    }
}

checkSchema()

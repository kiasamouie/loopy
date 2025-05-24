// get-jwt.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const {
  URL,
  ANON_KEY,
  USER_EMAIL,
  USER_PASSWORD,
} = process.env;

const supabase = createClient(URL, ANON_KEY);

(async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  if (error) {
    console.error("❌ Login failed:", error.message);
    process.exit(1);
  }

  const token = data.session?.access_token;

  if (!token) {
    console.error("❌ No token returned.");
    process.exit(1);
  }

  // Save to file
  fs.writeFileSync('jwt.txt', token);
  console.log("✅ JWT saved to jwt.txt");
  console.log(token);
})();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gddcvyvlpfqvbeoxeuxv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZGN2eXZscGZxdmJlb3hldXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NjE5MDUsImV4cCI6MjEwMzIzNzkwNX0.u-c_QR5RyMQW_3Zc-Xw89eAhPs-z5H_oH44LzbypyYI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testLogin() {
  const email = 'admin@montaser.com';
  const password = 'password123';
  
  console.log('Testing login with Anon Key (Browser simulation)...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.error('Login Error:', error.message, error.status, error.name);
  } else {
    console.log('Login Success! Session retrieved.');
  }
}

testLogin();

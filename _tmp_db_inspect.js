const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('C:\\Users\\Administrator\\.local\\share\\mimocode\\mimocode.db', {open:true, readonly:true});

// List tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('=== TABLES ===');
console.log(JSON.stringify(tables, null, 2));

// Schema of session table
try {
  const cols = db.prepare("PRAGMA table_info(session)").all();
  console.log('\n=== SESSION COLUMNS ===');
  console.log(JSON.stringify(cols, null, 2));
} catch(e) { console.log('No session table:', e.message); }

// Schema of message table
try {
  const cols = db.prepare("PRAGMA table_info(message)").all();
  console.log('\n=== MESSAGE COLUMNS ===');
  console.log(JSON.stringify(cols, null, 2));
} catch(e) { console.log('No message table:', e.message); }

// Schema of part table
try {
  const cols = db.prepare("PRAGMA table_info(part)").all();
  console.log('\n=== PART COLUMNS ===');
  console.log(JSON.stringify(cols, null, 2));
} catch(e) { console.log('No part table:', e.message); }

// List sessions with directory containing GitTrace
try {
  const sessions = db.prepare("SELECT * FROM session LIMIT 3").all();
  console.log('\n=== SAMPLE SESSIONS ===');
  console.log(JSON.stringify(sessions, null, 2));
} catch(e) { console.log('Error:', e.message); }

db.close();

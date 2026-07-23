const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('C:\\Users\\Administrator\\.local\\share\\mimocode\\mimocode.db', {open:true, readonly:true});

// Get the most recent non-checkpoint-writer GitTrace sessions
const sessions = db.prepare(`
  SELECT id, title, time_created FROM session 
  WHERE directory LIKE '%GitTrace%' 
    AND title NOT LIKE 'checkpoint-writer%'
    AND title NOT LIKE 'Auto Dream%'
  ORDER BY time_created DESC 
  LIMIT 10
`).all();

console.log('=== RECENT GITTRACE USER SESSIONS ===');
for (const s of sessions) {
  console.log(`\n${s.id} | ${s.title} | ${new Date(s.time_created).toISOString()}`);
  
  // Get user messages with keywords
  const messages = db.prepare(`
    SELECT m.id, json_extract(m.data, '$.role') as role, substr(m.data, 1, 500) as preview
    FROM message m
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
    LIMIT 5
  `).all(s.id);
  
  for (const m of messages) {
    console.log(`  [user] ${m.preview.substring(0, 300)}`);
  }
}

db.close();

const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('C:\\Users\\Administrator\\.local\\share\\mimocode\\mimocode.db', {open:true, readonly:true});

// Get the actual structure of a user message
const msgs = db.prepare(`
  SELECT m.id, m.session_id, m.data as raw_data
  FROM message m
  WHERE m.session_id = 'ses_076edb312ffe4e6rgz2N4hCQcO' AND json_extract(m.data, '$.role') = 'user'
  ORDER BY m.time_created
  LIMIT 2
`).all();

for (const m of msgs) {
  console.log(`\n=== MSG: ${m.id} ===`);
  // Print first 2000 chars of the data to see structure
  console.log(m.raw_data.substring(0, 2000));
}

// Also check part table for text content
console.log('\n=== PARTS FOR THIS SESSION ===');
const parts = db.prepare(`
  SELECT p.id, p.message_id, json_extract(p.data, '$.type') as part_type, substr(p.data, 1, 500) as preview
  FROM part p
  WHERE p.session_id = 'ses_076edb312ffe4e6rgz2N4hCQcO'
  ORDER BY p.time_created
  LIMIT 5
`).all();

for (const p of parts) {
  console.log(`  [${p.part_type}] ${p.preview.substring(0, 300)}`);
}

// Check what agent types exist
console.log('\n=== AGENT TYPES IN MESSAGE ===');
const agents = db.prepare(`
  SELECT DISTINCT json_extract(m.data, '$.agent') as agent, count(*) as cnt
  FROM message m
  WHERE m.session_id = 'ses_076edb312ffe4e6rgz2N4hCQcO'
  GROUP BY agent
`).all();
console.log(JSON.stringify(agents, null, 2));

// Check part types
console.log('\n=== PART TYPES ===');
const partTypes = db.prepare(`
  SELECT json_extract(p.data, '$.type') as type, count(*) as cnt
  FROM part p
  WHERE p.session_id = 'ses_076edb312ffe4e6rgz2N4hCQcO'
  GROUP BY type
`).all();
console.log(JSON.stringify(partTypes, null, 2));

db.close();

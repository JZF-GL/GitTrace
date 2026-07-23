const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('C:\\Users\\Administrator\\.local\\share\\mimocode\\mimocode.db', {open:true, readonly:true});

// Search for user text parts containing rules/decisions
console.log('=== USER TEXT PARTS WITH RULES/DECISIONS ===');
const userTexts = db.prepare(`
  SELECT p.session_id, json_extract(p.data, '$.text') as text, p.time_created
  FROM part p
  JOIN message m ON p.message_id = m.id
  WHERE json_extract(m.data, '$.role') = 'user'
    AND json_extract(p.data, '$.type') = 'text'
    AND p.session_id IN (
      'ses_076edb312ffe4e6rgz2N4hCQcO',
      'ses_078991643ffe8av0rWTJSWPrKI',
      'ses_07d729c16ffelCEwf7DUB4sN73',
      'ses_08285cc70ffe110QZMVwzGOK1F'
    )
  ORDER BY p.time_created
`).all();

for (const p of userTexts) {
  console.log(`\n  [${p.session_id}] ${p.text.substring(0, 500)}`);
}

// Search for all user text parts across all sessions for rules
console.log('\n\n=== ALL USER TEXT PARTS WITH KEYWORDS ===');
const allUserTexts = db.prepare(`
  SELECT p.session_id, json_extract(p.data, '$.text') as text, p.time_created
  FROM part p
  JOIN message m ON p.message_id = m.id
  WHERE json_extract(m.data, '$.role') = 'user'
    AND json_extract(p.data, '$.type') = 'text'
    AND (json_extract(p.data, '$.text') LIKE '%不要%'
      OR json_extract(p.data, '$.text') LIKE '%记住%'
      OR json_extract(p.data, '$.text') LIKE '%永远%'
      OR json_extract(p.data, '$.text') LIKE '%never%'
      OR json_extract(p.data, '$.text') LIKE '%always%'
      OR json_extract(p.data, '$.text') LIKE '%报错%'
      OR json_extract(p.data, '$.text') LIKE '%error%'
      OR json_extract(p.data, '$.text') LIKE '%stash%'
      OR json_extract(p.data, '$.text') LIKE '%debug%'
      OR json_extract(p.data, '$.text') LIKE '%截图%'
      OR json_extract(p.data, '$.text') LIKE '%RockWise%'
      OR json_extract(p.data, '$.text') LIKE '%看报错%')
  ORDER BY p.time_created DESC
  LIMIT 30
`).all();

for (const p of allUserTexts) {
  console.log(`\n  [${p.session_id}] ${p.text.substring(0, 500)}`);
}

db.close();

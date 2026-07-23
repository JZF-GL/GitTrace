const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('C:\\Users\\Administrator\\.local\\share\\mimocode\\mimocode.db', {open:true, readonly:true});

// Get user text from recent GitTrace sessions - parse JSON properly
const sessionIds = [
  'ses_076edb312ffe4e6rgz2N4hCQcO',
  'ses_078991643ffe8av0rWTJSWPrKI',
  'ses_07d729c16ffelCEwf7DUB4sN73',
  'ses_08285cc70ffe110QZMVwzGOK1F',
];

for (const sid of sessionIds) {
  console.log(`\n=== SESSION: ${sid} ===`);
  
  const userMsgs = db.prepare(`
    SELECT m.id, m.data as raw_data
    FROM message m
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
  `).all(sid);
  
  for (const m of userMsgs) {
    try {
      const parsed = JSON.parse(m.raw_data);
      if (parsed.summary && parsed.summary.text) {
        console.log(`  [user] ${parsed.summary.text.substring(0, 400)}`);
      }
      if (parsed.parts) {
        for (const part of parsed.parts) {
          if (part.type === 'text' && part.text) {
            console.log(`  [user] ${part.text.substring(0, 400)}`);
          }
        }
      }
    } catch(e) {}
  }
}

// Also search for "不要" or "记住" in raw text of all messages
console.log('\n=== KEYWORD SEARCH IN ALL MESSAGES ===');
const allMsgs = db.prepare(`
  SELECT m.id, m.session_id, m.data as raw_data
  FROM message m
  WHERE json_extract(m.data, '$.role') = 'user'
  ORDER BY m.time_created DESC
  LIMIT 200
`).all();

for (const m of allMsgs) {
  try {
    const parsed = JSON.parse(m.raw_data);
    let text = '';
    if (parsed.summary && parsed.summary.text) text = parsed.summary.text;
    if (parsed.parts) {
      for (const part of parsed.parts) {
        if (part.type === 'text') text += part.text;
      }
    }
    if (text.match(/不要|记住|never|always|remember|报错|error|stash|debug.screenshot/i)) {
      console.log(`\n  [${m.session_id}] ${text.substring(0, 400)}`);
    }
  } catch(e) {}
}

db.close();

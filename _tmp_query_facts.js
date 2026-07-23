const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('C:\\Users\\Administrator\\.local\\share\\mimocode\\mimocode.db', {open:true, readonly:true});

// Search user messages for rules/decisions/keywords in recent GitTrace sessions
const keywords = ['永远', '不要', '记住', 'never', 'always', 'remember', '规则', '决定', 'decision', '错误', 'error', '报错', 'stash', 'debug-screenshot'];

// Get user messages from the most recent GitTrace sessions
const sessionIds = [
  'ses_076edb312ffe4e6rgz2N4hCQcO', // 工作区冲突解决导入值优先于当前值
  'ses_078991643ffe8av0rWTJSWPrKI', // GitTrace stash UI exploration
  'ses_07d729c16ffelCEwf7DUB4sN73', // 切换到dev分支刷新按钮缺失
];

for (const sid of sessionIds) {
  console.log(`\n=== SESSION: ${sid} ===`);
  
  // Get user messages
  const userMsgs = db.prepare(`
    SELECT m.id, json_extract(m.data, '$.role') as role, m.data as raw_data
    FROM message m
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
  `).all(sid);
  
  for (const m of userMsgs) {
    try {
      const parsed = JSON.parse(m.raw_data);
      // Extract text content from parts
      if (parsed.parts) {
        for (const part of parsed.parts) {
          if (part.type === 'text' && part.text) {
            const text = part.text.substring(0, 500);
            console.log(`  [user] ${text}`);
          }
        }
      }
    } catch(e) {}
  }
}

// Also search for tool outputs containing important patterns
console.log('\n=== SEARCHING FOR USER RULES IN TRAJECTORY ===');
const ruleMsgs = db.prepare(`
  SELECT m.id, m.session_id, substr(m.data, 1, 800) as preview
  FROM message m
  WHERE json_extract(m.data, '$.role') = 'user'
    AND (m.data LIKE '%永远%' OR m.data LIKE '%不要%' OR m.data LIKE '%记住%' 
         OR m.data LIKE '%never%' OR m.data LIKE '%always%' OR m.data LIKE '%remember%'
         OR m.data LIKE '%规则%' OR m.data LIKE '%错误%范%' OR m.data LIKE '%不要再%')
  ORDER BY m.time_created DESC
  LIMIT 10
`).all();

for (const m of ruleMsgs) {
  console.log(`\n  [${m.session_id}] ${m.preview.substring(0, 500)}`);
}

// Also check for assistant messages with architecture decisions
console.log('\n=== SEARCHING FOR ARCHITECTURE DECISIONS ===');
const archMsgs = db.prepare(`
  SELECT m.id, m.session_id, substr(m.data, 1, 800) as preview
  FROM message m
  WHERE json_extract(m.data, '$.role') = 'assistant'
    AND (m.data LIKE '%Architecture decisions%' OR m.data LIKE '%决策%' OR m.data LIKE '%design decision%')
  ORDER BY m.time_created DESC
  LIMIT 5
`).all();

for (const m of archMsgs) {
  console.log(`\n  [${m.session_id}] ${m.preview.substring(0, 500)}`);
}

db.close();

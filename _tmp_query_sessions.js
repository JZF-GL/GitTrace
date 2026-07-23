const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('C:\\Users\\Administrator\\.local\\share\\mimocode\\mimocode.db', {open:true, readonly:true});

// Find GitTrace sessions
const sessions = db.prepare("SELECT id, directory, title, time_created FROM session WHERE directory LIKE '%GitTrace%' ORDER BY time_created DESC").all();
console.log('=== GITTRACE SESSIONS ===');
console.log(JSON.stringify(sessions, null, 2));

// Also find the project ID for GitTrace
const projects = db.prepare("SELECT * FROM project").all();
console.log('\n=== ALL PROJECTS ===');
console.log(JSON.stringify(projects, null, 2));

db.close();

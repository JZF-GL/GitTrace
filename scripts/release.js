const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getNextVersion(currentVersion, bumpType = 'patch') {
  if (/^\d+\.\d+\.\d+/.test(bumpType)) {
    return bumpType;
  }
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`无法解析当前版本号: ${currentVersion}`);
  }
  let major = parseInt(match[1], 10);
  let minor = parseInt(match[2], 10);
  let patch = parseInt(match[3], 10);

  if (bumpType === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpType === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    // default: patch
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function main() {
  const args = process.argv.slice(2);
  let bumpType = 'patch';
  let customMessage = process.env.COMMIT_MSG || null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      console.log(`
使用方式:
  pnpm release [patch | minor | major | <version>] [-m "commit message"]
  pnpm package [patch | minor | major | <version>] [-m "commit message"]

说明:
  自动修改 package.json 中的 version 递增，并提交 git，然后执行 pnpm build 打包。
      `);
      process.exit(0);
    }
    if (arg === '-m' || arg === '--message') {
      customMessage = args[i + 1];
      i++;
    } else if (arg.startsWith('--message=')) {
      customMessage = arg.slice('--message='.length);
    } else if (arg === 'patch' || arg === 'minor' || arg === 'major' || /^\d+\.\d+\.\d+/.test(arg)) {
      bumpType = arg;
    }
  }

  const pkgPath = path.resolve(__dirname, '../package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('未找到 package.json 文件！');
    process.exit(1);
  }

  const rawContent = fs.readFileSync(pkgPath, 'utf8');
  const isCrlf = rawContent.includes('\r\n');
  const pkg = JSON.parse(rawContent);

  const oldVersion = pkg.version;
  const newVersion = getNextVersion(oldVersion, bumpType);

  console.log(`\n========================================`);
  console.log(`📌 当前版本: ${oldVersion}`);
  console.log(`🆙 新版本号: ${newVersion}`);
  console.log(`========================================\n`);

  pkg.version = newVersion;
  let updatedContent = JSON.stringify(pkg, null, 2) + '\n';
  if (isCrlf) {
    updatedContent = updatedContent.replace(/\r?\n/g, '\r\n');
  }

  fs.writeFileSync(pkgPath, updatedContent, 'utf8');
  console.log(`✔ 已更新 package.json 版本号为 ${newVersion}`);

  // Git add
  console.log(`\n📦 暂存 package.json...`);
  const gitAdd = spawnSync('git', ['add', 'package.json'], { stdio: 'inherit' });
  if (gitAdd.status !== 0) {
    console.error('✖ git add 失败，正在恢复 package.json...');
    fs.writeFileSync(pkgPath, rawContent, 'utf8');
    process.exit(gitAdd.status || 1);
  }

  // Git commit
  const commitMsg = customMessage || `release: v${newVersion}`;
  console.log(`📝 提交 Git: "${commitMsg}"...`);
  const gitCommit = spawnSync('git', ['commit', '-m', commitMsg], { stdio: 'inherit' });
  if (gitCommit.status !== 0) {
    console.error('✖ git commit 失败，正在回滚 package.json...');
    fs.writeFileSync(pkgPath, rawContent, 'utf8');
    spawnSync('git', ['checkout', 'package.json'], { stdio: 'inherit' });
    process.exit(gitCommit.status || 1);
  }
  console.log(`✔ Git 提交成功: ${commitMsg}`);

  // Build
  console.log(`\n🚀 开始执行打包 (pnpm build)...\n`);
  const build = spawnSync('pnpm', ['build'], { stdio: 'inherit', shell: true });
  if (build.status !== 0) {
    console.error(`\n✖ 打包失败，退出码: ${build.status}`);
    process.exit(build.status || 1);
  }

  console.log(`\n🎉 打包完成！版本号: v${newVersion}`);
}

main();

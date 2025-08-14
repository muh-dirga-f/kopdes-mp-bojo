#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const OUTPUT = path.join(PROJECT_ROOT, 'snapshot.md');

const SUPPORTED_EXT = ['.js', '.ejs'];
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'coverage', 'public'];

const EXTRA_FILES = [
    { path: '.env', label: '.env' },
    { path: 'prisma/schema.prisma', label: 'schema.prisma' },
    { path: 'package.json', label: 'package.json' },
];

function scanDir(dir, baseDir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (IGNORED_DIRS.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        const rel = path.relative(baseDir, fullPath);
        if (entry.isDirectory()) {
            results.push(...scanDir(fullPath, baseDir));
        } else if (SUPPORTED_EXT.includes(path.extname(entry.name))) {
            results.push(rel);
        }
    }
    return results;
}

function generateTree(dir, prefix = '') {
    const entries = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter(e => !IGNORED_DIRS.includes(e.name))
        .sort((a, b) => a.name.localeCompare(b.name));
    const lines = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isLast = i === entries.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        lines.push(`${prefix}${pointer}${entry.name}`);
        if (entry.isDirectory()) {
            lines.push(...generateTree(path.join(dir, entry.name), nextPrefix));
        }
    }
    return lines;
}

function generateMarkdown(codeFiles, extraFiles) {
    const now = new Date().toISOString();
    let md = `# 🧾 Project Snapshot\n\n> Generated at \`${now}\`\n\n`;
    md += `## 📁 Directory Structure (excluding node_modules, .git, dist)\n\n\`\`\`\n.\n`;
    md += generateTree(PROJECT_ROOT).join('\n');
    md += `\n\`\`\`\n\n`;

    for (const rel of codeFiles) {
        const full = path.join(SRC_DIR, rel);
        const ext = path.extname(rel).slice(1);
        const content = fs.readFileSync(full, 'utf-8');
        md += `## \`src/${rel}\`\n\n\`\`\`${ext}\n`;
        md += content.trim() + '\n';
        md += `\`\`\`\n\n`;
    }

    for (const file of extraFiles) {
        const full = path.join(PROJECT_ROOT, file.path);
        if (!fs.existsSync(full)) continue;
        const lang = path.extname(file.path).slice(1);
        const content = fs.readFileSync(full, 'utf-8');
        md += `## \`${file.label}\`\n\n\`\`\`${lang}\n`;
        md += content.trim() + '\n';
        md += `\`\`\`\n\n`;
    }

    return md;
}

async function run() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error(`❌ src/ not found at ${SRC_DIR}`);
        process.exit(1);
    }
    const codeFiles = scanDir(SRC_DIR, SRC_DIR);
    const markdown = generateMarkdown(codeFiles, EXTRA_FILES);
    fs.writeFileSync(OUTPUT, markdown, 'utf-8');
    console.log(`✅ Snapshot saved to ${OUTPUT}`);
}

run();

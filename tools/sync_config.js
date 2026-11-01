// Copy the canonical designer config into Cocos resources before opening/building.
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, '配置表', 'fish_simulator_config.json');
const target = path.join(root, 'NewProject', 'assets', 'resources', 'config', 'fish_simulator_config.json');

const data = JSON.parse(fs.readFileSync(source, 'utf8'));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
console.log(`Synced ${path.relative(root, source)} -> ${path.relative(root, target)}`);

// One-time structural patch: add the zg.png entry overlay as the last Canvas child.
'use strict';

const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'NewProject', 'assets', 'Main.scene');
const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const canvasIndex = scene.findIndex((item) => item && item.__type__ === 'cc.Node' && item._name === 'Canvas');
if (canvasIndex < 0) throw new Error('Canvas not found in Main.scene');
const canvas = scene[canvasIndex];
if (canvas._children.some((ref) => scene[ref.__id__]?._name === 'zg')) {
    throw new Error('zg overlay already exists; refusing to overwrite editor changes.');
}

const vec2 = (x, y) => ({ __type__: 'cc.Vec2', x, y });
const vec3 = (x, y, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const quat = () => ({ __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 });
const color = (r, g, b, a = 255) => ({ __type__: 'cc.Color', r, g, b, a });

const nodeIndex = scene.length;
scene.push({
    __type__: 'cc.Node', _name: 'zg', _objFlags: 0, _parent: { __id__: canvasIndex }, _children: [],
    _active: true, _components: [], _prefab: null, _lpos: vec3(0, 0, 999), _lrot: quat(),
    _lscale: vec3(1, 1, 1), _layer: 33554432, _euler: vec3(0, 0, 0), _id: 'Main-zg'
});
const transformIndex = scene.length;
scene.push({
    __type__: 'cc.UITransform', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true,
    __prefab: null, _contentSize: { __type__: 'cc.Size', width: 558, height: 992 },
    _anchorPoint: vec2(0.5, 0.5), _id: 'Main-zg-transform'
});
const spriteIndex = scene.length;
scene.push({
    __type__: 'cc.Sprite', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true,
    __prefab: null, _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
    _color: color(255, 255, 255), _spriteFrame: {
        __uuid__: 'a403efff-8893-4db3-ba71-faa0c59bfe7e@f9941',
        __expectedType__: 'cc.SpriteFrame'
    }, _type: 0, _fillType: 0, _sizeMode: 0,
    _fillCenter: vec2(0, 0), _fillStart: 0, _fillRange: 0, _isTrimmedMode: true,
    _useGrayscale: false, _atlas: null, _id: 'Main-zg-sprite'
});
scene[nodeIndex]._components.push({ __id__: transformIndex }, { __id__: spriteIndex });
canvas._children.push({ __id__: nodeIndex });
fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2) + '\n');
console.log('Added zg overlay as the highest Canvas child.');

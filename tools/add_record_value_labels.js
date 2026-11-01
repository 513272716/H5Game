// One-time structural patch: add editable value Labels under RecordArt.
// It only appends objects and preserves every existing node, position and frame.
'use strict';

const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'NewProject', 'assets', 'Main.scene');
const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const recordIndex = scene.findIndex((item) => item && item.__type__ === 'cc.Node' && item._name === 'RecordArt');
if (recordIndex < 0) throw new Error('RecordArt not found in Main.scene');

const vec2 = (x, y) => ({ __type__: 'cc.Vec2', x, y });
const vec3 = (x, y, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const quat = () => ({ __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 });
const color = (r, g, b, a = 255) => ({ __type__: 'cc.Color', r, g, b, a });

function addValueLabel(name, text, x) {
    if (scene[recordIndex]._children.some((ref) => scene[ref.__id__]?._name === name)) return;
    const nodeIndex = scene.length;
    scene.push({
        __type__: 'cc.Node', _name: name, _objFlags: 0, _parent: { __id__: recordIndex }, _children: [],
        _active: true, _components: [], _prefab: null, _lpos: vec3(x, 0), _lrot: quat(),
        _lscale: vec3(1, 1, 1), _layer: 33554432, _euler: vec3(0, 0, 0), _id: `Main-${name}`
    });
    const transformIndex = scene.length;
    scene.push({
        __type__: 'cc.UITransform', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true,
        __prefab: null, _contentSize: { __type__: 'cc.Size', width: 130, height: 70 },
        _anchorPoint: vec2(0.5, 0.5), _id: `Main-${name}-transform`
    });
    const labelIndex = scene.length;
    scene.push({
        __type__: 'cc.Label', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true,
        __prefab: null, _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
        _color: color(35, 72, 82), _string: text, _horizontalAlign: 1, _verticalAlign: 1,
        _actualFontSize: 30, _fontSize: 30, _fontFamily: 'Arial', _lineHeight: 38, _overflow: 1,
        _enableWrapText: false, _font: null, _isSystemFontUsed: true, _spacingX: 0,
        _isItalic: false, _isBold: true, _isUnderline: false, _underlineHeight: 2, _cacheMode: 0,
        _enableOutline: true, _outlineColor: color(255, 255, 255), _outlineWidth: 1,
        _enableShadow: false, _shadowColor: color(0, 0, 0), _shadowOffset: vec2(2, 2), _shadowBlur: 2,
        _id: `Main-${name}-label`
    });
    scene[nodeIndex]._components.push({ __id__: transformIndex }, { __id__: labelIndex });
    scene[recordIndex]._children.push({ __id__: nodeIndex });
}

addValueLabel('BestDaysValue', '0天', -72);
addValueLabel('FeedValue', '100', 170);
fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2) + '\n');
console.log('Added RecordArt value labels without changing existing nodes.');

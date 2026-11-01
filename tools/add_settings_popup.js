// One-time structural patch: add the editor-created settings popup to Main.scene.
'use strict';

const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'NewProject', 'assets', 'Main.scene');
const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const canvasIndex = scene.findIndex((item) => item && item.__type__ === 'cc.Node' && item._name === 'Canvas');
if (canvasIndex < 0) throw new Error('Canvas not found in Main.scene');
if (scene.some((item) => item && item.__type__ === 'cc.Node' && item._name === 'SettingsPanel')) {
    throw new Error('SettingsPanel already exists; refusing to overwrite editor changes.');
}

const vec2 = (x, y) => ({ __type__: 'cc.Vec2', x, y });
const vec3 = (x, y, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const quat = () => ({ __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 });
const color = (r, g, b, a = 255) => ({ __type__: 'cc.Color', r, g, b, a });

const frames = {
    panel: 'b1111111-1111-4111-8111-111111111111@f9941',
    title: 'b2222222-2222-4222-8222-222222222222@f9941',
    handle: 'b3333333-3333-4333-8333-333333333333@f9941',
    musicLabel: 'b4444444-4444-4444-8444-444444444444@f9941',
    musicBar: 'b5555555-5555-4555-8555-555555555555@f9941',
    sfxLabel: 'b6666666-6666-4666-8666-666666666666@f9941',
    emptyBar: 'b7777777-7777-4777-8777-777777777777@f9941',
    close: 'b8888888-8888-4888-8888-888888888888@f9941',
};

function addNode(name, parent, x, y, z = 0, active = true) {
    const index = scene.length;
    scene.push({
        __type__: 'cc.Node', _name: name, _objFlags: 0, _parent: { __id__: parent }, _children: [],
        _active: active, _components: [], _prefab: null, _lpos: vec3(x, y, z), _lrot: quat(),
        _lscale: vec3(1, 1, 1), _layer: 33554432, _euler: vec3(0, 0, 0), _id: `Main-${name}`
    });
    scene[parent]._children.push({ __id__: index });
    return index;
}

function addTransform(node, width, height) {
    const index = scene.length;
    scene.push({
        __type__: 'cc.UITransform', _name: '', _objFlags: 0, node: { __id__: node }, _enabled: true,
        __prefab: null, _contentSize: { __type__: 'cc.Size', width, height }, _anchorPoint: vec2(0.5, 0.5),
        _id: `Main-${scene[node]._name}-transform`
    });
    scene[node]._components.push({ __id__: index });
    return index;
}

function addSprite(node, frame, id, width, height) {
    const index = scene.length;
    scene.push({
        __type__: 'cc.Sprite', _name: '', _objFlags: 0, node: { __id__: node }, _enabled: true,
        __prefab: null, _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
        _color: color(255, 255, 255), _spriteFrame: { __uuid__: frame, __expectedType__: 'cc.SpriteFrame' },
        _type: 0, _fillType: 0, _fillCenter: vec2(0, 0), _fillStart: 0, _fillRange: 1,
        _sizeMode: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null, _id: id
    });
    scene[node]._components.push({ __id__: index });
    return index;
}

function addImageNode(name, parent, frame, x, y, z, width, height) {
    const node = addNode(name, parent, x, y, z);
    addTransform(node, width, height);
    addSprite(node, frame, `Main-${name}-sprite`, width, height);
    return node;
}

function addButton(node) {
    const index = scene.length;
    scene.push({
        __type__: 'cc.Button', _name: '', _objFlags: 0, node: { __id__: node }, _enabled: true,
        __prefab: null, clickEvents: [], _interactable: true, _transition: 3,
        _normalColor: color(255, 255, 255), _hoverColor: color(220, 220, 220), _pressedColor: color(255, 255, 255),
        _disabledColor: color(124, 124, 124), _normalSprite: null, _hoverSprite: null, _pressedSprite: null,
        _disabledSprite: null, _duration: 0.1, _zoomScale: 0.92, _target: { __id__: node },
        _id: `Main-${scene[node]._name}-button`
    });
    scene[node]._components.push({ __id__: index });
}

const mask = addNode('SettingsMask', canvasIndex, 0, 0, 1500, false);
addTransform(mask, 750, 1334);

const panel = addNode('SettingsPanel', canvasIndex, 0, 0, 1600, false);
addTransform(panel, 631, 395);
addSprite(panel, frames.panel, 'Main-SettingsPanel-sprite', 631, 395);

addImageNode('SettingsTitle', panel, frames.title, 0, 130, 1, 373, 109);
addImageNode('MusicLabel', panel, frames.musicLabel, -175, 55, 1, 187, 71);
addImageNode('SfxLabel', panel, frames.sfxLabel, -175, -35, 1, 188, 72);

const musicSlider = addNode('MusicSlider', panel, 70, 55, 2);
addTransform(musicSlider, 340, 70);
addImageNode('MusicTrack', musicSlider, frames.emptyBar, 0, 0, 0, 340, 54);
addImageNode('MusicBar', musicSlider, frames.musicBar, 0, 0, 1, 340, 64);
addImageNode('MusicHandle', musicSlider, frames.handle, 55, 0, 2, 96, 68);

const sfxSlider = addNode('SfxSlider', panel, 70, -35, 2);
addTransform(sfxSlider, 340, 70);
addImageNode('SfxTrack', sfxSlider, frames.emptyBar, 0, 0, 0, 340, 54);
addImageNode('SfxBar', sfxSlider, frames.musicBar, 0, 0, 1, 340, 64);
addImageNode('SfxHandle', sfxSlider, frames.handle, 55, 0, 2, 96, 68);

const close = addImageNode('CloseButton', panel, frames.close, 0, -135, 2, 280, 86);
addButton(close);

fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2) + '\n');
console.log('Added SettingsMask and SettingsPanel with editor art.');

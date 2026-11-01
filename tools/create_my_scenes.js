// Build the first MY scenes from a clean Cocos Creator 3.8.7 scene graph.
// Main uses the supplied art slices; Game keeps lightweight text placeholders
// until its workstation art is supplied.
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'NewProject', 'assets');
const SIZE = { width: 750, height: 1334 };

const color = (r, g, b, a = 255) => ({ __type__: 'cc.Color', r, g, b, a });
const vec2 = (x, y) => ({ __type__: 'cc.Vec2', x, y });
const vec3 = (x, y, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const quat = () => ({ __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 });

function base(sceneName) {
    return [
        { __type__: 'cc.SceneAsset', _name: sceneName, _objFlags: 0, _native: '', scene: { __id__: 1 } },
        {
            __type__: 'cc.Scene', _name: 'scene-2d', _objFlags: 0, _parent: null,
            _children: [{ __id__: 2 }], _active: true, _components: [], _prefab: null,
            autoReleaseAssets: false, _globals: { __id__: 8 }, _id: `${sceneName}-scene`
        },
        {
            __type__: 'cc.Node', _name: 'Canvas', _objFlags: 0, _parent: { __id__: 1 },
            _children: [{ __id__: 3 }], _active: true,
            _components: [{ __id__: 5 }, { __id__: 6 }, { __id__: 7 }], _prefab: null,
            _lpos: vec3(375, 667), _lrot: quat(), _lscale: vec3(1, 1, 1),
            _layer: 33554432, _euler: vec3(0, 0, 0), _id: `${sceneName}-canvas`
        },
        {
            __type__: 'cc.Node', _name: 'Camera', _objFlags: 0, _parent: { __id__: 1 },
            _children: [], _active: true, _components: [{ __id__: 4 }], _prefab: null,
            _lpos: vec3(0, 0), _lrot: quat(), _lscale: vec3(1, 1, 1),
            _layer: 1073741824, _euler: vec3(0, 0, 0), _id: `${sceneName}-camera`
        },
        {
            __type__: 'cc.Camera', _name: '', _objFlags: 0, node: { __id__: 3 }, _enabled: true,
            __prefab: null, _projection: 0, _priority: 0, _fov: 45, _fovAxis: 0,
            _orthoHeight: 10, _near: 0, _far: 2000, _color: color(0, 0, 0), _depth: 1,
            _stencil: 0, _clearFlags: 7, _rect: { __type__: 'cc.Rect', x: 0, y: 0, width: 1, height: 1 },
            _aperture: 19, _shutter: 7, _iso: 0, _screenScale: 1, _visibility: 1108344832,
            _targetTexture: null, _id: `${sceneName}-camera-component`
        },
        {
            __type__: 'cc.UITransform', _name: '', _objFlags: 0, node: { __id__: 2 }, _enabled: true,
            __prefab: null, _contentSize: { __type__: 'cc.Size', width: SIZE.width, height: SIZE.height },
            _anchorPoint: vec2(0.5, 0.5), _id: `${sceneName}-canvas-transform`
        },
        {
            __type__: 'cc.Canvas', _name: '', _objFlags: 0, node: { __id__: 2 }, _enabled: true,
            __prefab: null, _cameraComponent: { __id__: 4 }, _alignCanvasWithScreen: true,
            _id: `${sceneName}-canvas-component`
        },
        {
            __type__: 'cc.Widget', _name: '', _objFlags: 0, node: { __id__: 2 }, _enabled: true,
            __prefab: null, _alignFlags: 45, _target: null, _left: 0, _right: 0, _top: 0, _bottom: 0,
            _horizontalCenter: 0, _verticalCenter: 0, _isAbsLeft: true, _isAbsRight: true,
            _isAbsTop: true, _isAbsBottom: true, _isAbsHorizontalCenter: true,
            _isAbsVerticalCenter: true, _originalWidth: 0, _originalHeight: 0, _alignMode: 2,
            _lockFlags: 0, _id: `${sceneName}-canvas-widget`
        },
        {
            __type__: 'cc.SceneGlobals', ambient: { __id__: 9 }, shadows: { __id__: 10 },
            _skybox: { __id__: 11 }, fog: { __id__: 12 }, octree: { __id__: 13 }, skin: { __id__: 14 }
        },
        {
            __type__: 'cc.AmbientInfo', _skyColorHDR: { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0.52 },
            _skyColor: { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0.52 }, _skyIllumHDR: 20000,
            _skyIllum: 20000, _groundAlbedoHDR: { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0 },
            _groundAlbedo: { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0 },
            _skyColorLDR: { __type__: 'cc.Vec4', x: 0.2, y: 0.5, z: 0.8, w: 1 },
            _skyIllumLDR: 20000, _groundAlbedoLDR: { __type__: 'cc.Vec4', x: 0.2, y: 0.2, z: 0.2, w: 1 }
        },
        {
            __type__: 'cc.ShadowsInfo', _enabled: false, _type: 0, _normal: vec3(0, 1, 0),
            _distance: 0, _shadowColor: color(76, 76, 76), _maxReceived: 4,
            _size: vec2(512, 512)
        },
        { __type__: 'cc.SkyboxInfo', _envLightingType: 0, _envmapHDR: null, _envmap: null, _envmapLDR: null, _diffuseMapHDR: null, _diffuseMapLDR: null, _enabled: false, _useHDR: true },
        { __type__: 'cc.FogInfo', _type: 0, _fogColor: color(200, 200, 200), _enabled: false, _fogDensity: 0.3, _fogStart: 0.5, _fogEnd: 300, _fogAtten: 5, _fogTop: 1.5, _fogRange: 1.2, _accurate: false },
        { __type__: 'cc.OctreeInfo', _enabled: false, _minPos: vec3(-1024, -1024, -1024), _maxPos: vec3(1024, 1024, 1024), _depth: 8 },
        { __type__: 'cc.SkinInfo', _enabled: false, _scale: 5 }
    ];
}

function addLabel(arr, text, name, x, y, width, height, fontSize, textColor, outlineColor, opts = {}) {
    const canvas = arr[2];
    const nodeIndex = arr.length;
    const node = {
        __type__: 'cc.Node', _name: name, _objFlags: 0, _parent: { __id__: 2 }, _children: [],
        _active: opts.active !== false, _components: [], _prefab: null, _lpos: vec3(x, y), _lrot: quat(),
        _lscale: vec3(1, 1, 1), _layer: 33554432, _euler: vec3(0, 0, 0), _id: `${arr[0]._name}-${name}`
    };
    arr.push(node);
    const transformIndex = arr.length;
    arr.push({ __type__: 'cc.UITransform', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true, __prefab: null, _contentSize: { __type__: 'cc.Size', width, height }, _anchorPoint: vec2(0.5, 0.5), _id: `${arr[0]._name}-${name}-transform` });
    node._components.push({ __id__: transformIndex });
    const labelIndex = arr.length;
    arr.push({ __type__: 'cc.Label', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true, __prefab: null, _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(...textColor), _string: text, _horizontalAlign: 1, _verticalAlign: 1, _actualFontSize: fontSize, _fontSize: fontSize, _fontFamily: 'Arial', _lineHeight: fontSize + 8, _overflow: 1, _enableWrapText: true, _font: null, _isSystemFontUsed: true, _spacingX: 0, _isItalic: false, _isBold: opts.bold !== false, _isUnderline: false, _underlineHeight: 2, _cacheMode: 0, _enableOutline: true, _outlineColor: color(...outlineColor), _outlineWidth: opts.outlineWidth || 2, _enableShadow: false, _shadowColor: color(0, 0, 0), _shadowOffset: vec2(2, 2), _shadowBlur: 2, _id: `${arr[0]._name}-${name}-label` });
    node._components.push({ __id__: labelIndex });
    if (opts.button) {
        const buttonIndex = arr.length;
        arr.push({ __type__: 'cc.Button', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true, __prefab: null, clickEvents: [], _interactable: true, _transition: 3, _normalColor: color(255, 255, 255), _hoverColor: color(220, 220, 220), _pressedColor: color(255, 255, 255), _disabledColor: color(124, 124, 124), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.92, _target: { __id__: nodeIndex }, _id: `${arr[0]._name}-${name}-button` });
        node._components.push({ __id__: buttonIndex });
    }
    canvas._children.push({ __id__: nodeIndex });
    return nodeIndex;
}

function addSprite(arr, assetName, name, x, y, width, height, opts = {}) {
    const canvas = arr[2];
    const nodeIndex = arr.length;
    const node = {
        __type__: 'cc.Node', _name: name, _objFlags: 0, _parent: { __id__: 2 }, _children: [],
        _active: opts.active !== false, _components: [], _prefab: null, _lpos: vec3(x, y), _lrot: quat(),
        _lscale: vec3(1, 1, 1), _layer: 33554432, _euler: vec3(0, 0, 0), _id: `${arr[0]._name}-${name}`
    };
    arr.push(node);
    const transformIndex = arr.length;
    arr.push({ __type__: 'cc.UITransform', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true, __prefab: null, _contentSize: { __type__: 'cc.Size', width, height }, _anchorPoint: vec2(0.5, 0.5), _id: `${arr[0]._name}-${name}-transform` });
    node._components.push({ __id__: transformIndex });
    const spriteIndex = arr.length;
    arr.push({ __type__: 'cc.Sprite', _name: '', _objFlags: 0, __editorExtras__: {}, node: { __id__: nodeIndex }, _enabled: true, __prefab: null, _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(255, 255, 255), _spriteFrame: null, _type: 0, _fillType: 0, _sizeMode: 0, _fillCenter: vec2(0, 0), _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null, _id: `${arr[0]._name}-${name}-sprite` });
    node._components.push({ __id__: spriteIndex });
    if (opts.button) {
        const buttonIndex = arr.length;
        arr.push({ __type__: 'cc.Button', _name: '', _objFlags: 0, node: { __id__: nodeIndex }, _enabled: true, __prefab: null, clickEvents: [], _interactable: true, _transition: 3, _normalColor: color(255, 255, 255), _hoverColor: color(220, 220, 220), _pressedColor: color(255, 255, 255), _disabledColor: color(124, 124, 124), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.92, _target: { __id__: nodeIndex }, _id: `${arr[0]._name}-${name}-button` });
        node._components.push({ __id__: buttonIndex });
    }
    canvas._children.push({ __id__: nodeIndex });
    return nodeIndex;
}

function buildMain() {
    const arr = base('Main');
    const sx = 750 / 941;
    const sy = 1334 / 1672;
    const p = (x, y, w, h) => ({ x: (x + w / 2 - 941 / 2) * sx, y: (1672 / 2 - (y + h / 2)) * sy, w: w * sx, h: h * sy });
    const bg = p(0, 0, 941, 1672);
    const settings = p(20, 83, 204, 96);
    const title = p(11, 271, 916, 259);
    const highRecord = p(222, 792, 496, 126);
    const record = p(85, 941, 772, 137);
    const start = p(154, 1264, 637, 185);
    addSprite(arr, 'bg', 'Background', bg.x, bg.y, bg.w, bg.h);
    addSprite(arr, 'ui_1', 'SettingsButton', settings.x, settings.y, settings.w, settings.h, { button: true });
    addSprite(arr, 'ui_2', 'TitleArt', title.x, title.y, title.w, title.h);
    addSprite(arr, 'ui_3', 'HighRecordArt', highRecord.x, highRecord.y, highRecord.w, highRecord.h);
    addSprite(arr, 'ui_4', 'RecordArt', record.x, record.y, record.w, record.h);
    addSprite(arr, 'ui_5', 'StartButton', start.x, start.y, start.w, start.h, { button: true });
    return arr;
}

function buildWork() {
    const arr = base('Game');
    addLabel(arr, '暂停', 'PauseButton', -300, 600, 130, 60, 24, [244, 235, 216, 255], [77, 91, 107, 255], { button: true });
    addLabel(arr, '第 1 天  09:00', 'ClockLabel', 0, 600, 300, 60, 30, [244, 235, 216, 255], [77, 91, 107, 255]);
    addLabel(arr, '下班时间 18:30', 'WorkEndLabel', 215, 600, 260, 60, 24, [244, 235, 216, 255], [77, 91, 107, 255]);
    addLabel(arr, '草料 100', 'FeedLabel', 275, 530, 190, 52, 24, [244, 235, 216, 255], [77, 91, 107, 255]);
    addLabel(arr, '当前地点：工位', 'LocationLabel', 0, 440, 440, 60, 30, [244, 235, 216, 255], [77, 91, 107, 255]);
    addLabel(arr, '┌──────────────────────────┐\n│       办公室地图         │\n│  工位       老板办公室   │\n│                          │\n│  茶水间     洗手间       │\n│                          │\n│       消防楼梯   大门    │\n└──────────────────────────┘', 'MapFrame', 0, 20, 680, 640, 24, [244, 235, 216, 255], [77, 91, 107, 255], { bold: false, outlineWidth: 1 });
    addLabel(arr, '[茶水间]    [洗手间]    [消防楼梯]', 'SpotButtons', 0, -220, 680, 70, 24, [244, 235, 216, 255], [77, 91, 107, 255], { button: true });
    addLabel(arr, '[大门]', 'GateButton', 0, -315, 220, 70, 26, [244, 235, 216, 255], [77, 91, 107, 255], { button: true });
    addLabel(arr, '老板巡逻状态：待命', 'BossStatus', 0, -420, 500, 58, 23, [255, 220, 210, 255], [110, 60, 60, 255]);
    addLabel(arr, '点击地点进入摸鱼点；完成小游戏后返回工位地图', 'InteractionHint', 0, -535, 700, 52, 18, [220, 235, 230, 255], [50, 70, 70, 255], { bold: false });
    return arr;
}

fs.mkdirSync(OUT, { recursive: true });
const mainScenePath = path.join(OUT, 'Main.scene');
const gameScenePath = path.join(OUT, 'Game.scene');
if (fs.existsSync(mainScenePath) || fs.existsSync(gameScenePath)) {
    throw new Error('Main.scene or Game.scene already exists; refusing to overwrite editor changes.');
}
fs.writeFileSync(mainScenePath, JSON.stringify(buildMain(), null, 2) + '\n');
fs.writeFileSync(gameScenePath, JSON.stringify(buildWork(), null, 2) + '\n');
console.log('Created Main.scene and Game.scene');

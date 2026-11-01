// Create Cocos image metadata for the settings popup cutouts.
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'NewProject', 'assets', 'resources', 'textures', 'settings');
const assets = {
    'ui_1.png': ['b1111111-1111-4111-8111-111111111111', 631, 395],
    'ui_2.png': ['b2222222-2222-4222-8222-222222222222', 498, 145],
    'ui_3.png': ['b3333333-3333-4333-8333-333333333333', 139, 98],
    'ui_4.png': ['b4444444-4444-4444-8444-444444444444', 312, 119],
    'ui_5.png': ['b5555555-5555-4555-8555-555555555555', 367, 69],
    'ui_6.png': ['b6666666-6666-4666-8666-666666666666', 313, 120],
    'ui_7.png': ['b7777777-7777-4777-8777-777777777777', 467, 74],
    'ui_8.png': ['b8888888-8888-4888-8888-888888888888', 546, 168],
};

for (const [fileName, [uuid, width, height]] of Object.entries(assets)) {
    const displayName = path.basename(fileName, '.png');
    const meta = {
        ver: '1.0.27',
        importer: 'image',
        imported: true,
        uuid,
        files: ['.json', '.png'],
        subMetas: {
            '6c48a': {
                importer: 'texture', uuid: `${uuid}@6c48a`, displayName, id: '6c48a', name: 'texture',
                userData: { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', imageUuidOrDatabaseUri: uuid, isUuid: true, visible: false, minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0 },
                ver: '1.0.22', imported: true, files: ['.json'], subMetas: {},
            },
            f9941: {
                importer: 'sprite-frame', uuid: `${uuid}@f9941`, displayName, id: 'f9941', name: 'spriteFrame',
                userData: { trimThreshold: 1, rotated: false, offsetX: 0, offsetY: 0, trimX: 0, trimY: 0, width, height, rawWidth: width, rawHeight: height, borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0, packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0 },
                ver: '1.0.22', imported: true, files: ['.json'], subMetas: {},
            },
        },
        userData: {},
    };
    fs.writeFileSync(path.join(root, `${fileName}.meta`), `${JSON.stringify(meta, null, 2)}\n`);
}

console.log(`Created ${Object.keys(assets).length} settings image metadata files.`);

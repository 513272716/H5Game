// Add a serialized fallback click event for SettingsButton.
'use strict';

const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'NewProject', 'assets', 'Main.scene');
const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const canvasIndex = scene.findIndex((item) => item && item.__type__ === 'cc.Node' && item._name === 'Canvas');
const buttonIndex = scene.findIndex((item) => item && item.__type__ === 'cc.Node' && item._name === 'SettingsButton');
if (canvasIndex < 0 || buttonIndex < 0) throw new Error('Canvas or SettingsButton not found.');
const button = scene[buttonIndex];
const buttonComponentIndex = button._components.map((ref) => ref.__id__).find((index) => scene[index]?.__type__ === 'cc.Button');
if (buttonComponentIndex === undefined) throw new Error('SettingsButton has no cc.Button component.');
const buttonComponent = scene[buttonComponentIndex];
if (buttonComponent.clickEvents.some((ref) => scene[ref.__id__]?.handler === 'openSettings')) {
    throw new Error('SettingsButton already has an openSettings click event.');
}
const eventIndex = scene.length;
scene.push({
    __type__: 'cc.ClickEvent',
    target: { __id__: canvasIndex },
    component: 'MainController',
    handler: 'openSettings',
    customEventData: ''
});
buttonComponent.clickEvents.push({ __id__: eventIndex });
fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2) + '\n');
console.log('Added serialized MainController.openSettings click event.');

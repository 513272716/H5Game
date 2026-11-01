import {
    _decorator,
    Button,
    BlockInputEvents,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    Slider,
    Sprite,
    UITransform,
} from 'cc';
import AudioService from './AudioService';

const { ccclass, property } = _decorator;
const SLIDER_EVENT = 'slide';

console.warn('[SettingsController] module loaded');

/** Connects the editor-created settings panel to music and sfx volumes. */
@ccclass('SettingsController')
export default class SettingsController extends Component {
    @property({ type: Node }) settingsPanel: Node | null = null;
    @property({ type: Node }) settingsMask: Node | null = null;
    @property({ type: Slider }) musicSlider: Slider | null = null;
    @property({ type: Slider }) sfxSlider: Slider | null = null;
    @property({ type: Label }) musicValueLabel: Label | null = null;
    @property({ type: Label }) sfxValueLabel: Label | null = null;
    @property({ type: Button }) closeButton: Button | null = null;

    private audio!: AudioService;
    private musicBar: Sprite | null = null;
    private sfxBar: Sprite | null = null;
    private musicHandle: Sprite | null = null;
    private sfxHandle: Sprite | null = null;
    private readonly onCloseClick = (): void => this.close();
    private readonly onMusicSlide = (): void => this.updateMusic();
    private readonly onSfxSlide = (): void => this.updateSfx();
    private initialized = false;

    onLoad(): void {
        if (this.initialized) return;
        this.initialized = true;
        console.log('[SettingsController] onLoad:', this.node.name);
        this.audio = AudioService.ensure();
        this.settingsPanel = this.settingsPanel || this.node.getChildByName('SettingsPanel');
        this.settingsMask = this.settingsMask || this.node.getChildByName('SettingsMask');
        this.closeButton = this.closeButton || this.settingsPanel?.getChildByName('CloseButton')?.getComponent(Button) || null;
        this.musicSlider = this.musicSlider || this._findOrAddSlider('MusicSlider');
        this.sfxSlider = this.sfxSlider || this._findOrAddSlider('SfxSlider');
        this.musicValueLabel = this.musicValueLabel || this.settingsPanel?.getChildByName('MusicValue')?.getComponent(Label) || null;
        this.sfxValueLabel = this.sfxValueLabel || this.settingsPanel?.getChildByName('SfxValue')?.getComponent(Label) || null;
        const musicParts = this._prepareSlider(this.musicSlider, 'MusicBar', 'MusicHandle');
        const sfxParts = this._prepareSlider(this.sfxSlider, 'SfxBar', 'SfxHandle');
        this.musicBar = musicParts.bar;
        this.musicHandle = musicParts.handle;
        this.sfxBar = sfxParts.bar;
        this.sfxHandle = sfxParts.handle;
        this._prepareMask();
        this.syncControls();
        this.settingsPanel && (this.settingsPanel.active = false);
        this.settingsMask && (this.settingsMask.active = false);
        this.closeButton?.node.on(Button.EventType.CLICK, this.onCloseClick, this);
        this.musicSlider?.node.on(SLIDER_EVENT, this.onMusicSlide, this);
        this.sfxSlider?.node.on(SLIDER_EVENT, this.onSfxSlide, this);
        console.log('[SettingsController] bindings:', {
            closeButtonFound: !!this.closeButton,
            musicSliderFound: !!this.musicSlider,
            sfxSliderFound: !!this.sfxSlider,
            panelFound: !!this.settingsPanel,
            maskFound: !!this.settingsMask,
        });
    }

    open(): void {
        this.onLoad();
        console.log('[SettingsController] open called');
        this.syncControls();
        if (this.settingsMask) this.settingsMask.active = true;
        if (this.settingsPanel) this.settingsPanel.active = true;
        console.log('[SettingsController] open state:', {
            mask: this.settingsMask?.active,
            panel: this.settingsPanel?.active,
        });
    }

    close(): void {
        if (this.settingsMask) this.settingsMask.active = false;
        if (this.settingsPanel) this.settingsPanel.active = false;
    }

    private _findOrAddSlider(name: string): Slider | null {
        const node = this.settingsPanel?.getChildByName(name);
        if (!node) return null;
        return node.getComponent(Slider) || node.addComponent(Slider);
    }

    private _prepareSlider(
        slider: Slider | null,
        barName: string,
        handleName: string,
    ): { bar: Sprite | null; handle: Sprite | null } {
        if (!slider) return { bar: null, handle: null };
        slider.direction = Slider.Direction.Horizontal;
        const barNode = slider.node.getChildByName(barName);
        const handleNode = slider.node.getChildByName(handleName);
        const bar = barNode?.getComponent(Sprite) || null;
        if (bar) {
            bar.node.active = true;
            bar.type = Sprite.Type.FILLED;
            bar.fillType = Sprite.FillType.HORIZONTAL;
            bar.fillStart = 0;
            bar.fillRange = slider.progress;
        }
        // Slider.handle is a Sprite component, not the handle node itself.
        const handle = handleNode?.getComponent(Sprite);
        if (handle) slider.handle = handle;
        return { bar, handle: handle || null };
    }

    private _prepareMask(): void {
        if (!this.settingsMask) return;
        const transform = this.settingsMask.getComponent(UITransform);
        const graphics = this.settingsMask.getComponent(Graphics) || this.settingsMask.addComponent(Graphics);
        const width = transform?.contentSize.width || 750;
        const height = transform?.contentSize.height || 1334;
        graphics.clear();
        graphics.fillColor = new Color(0, 0, 0, 166);
        graphics.rect(-width * 0.5, -height * 0.5, width, height);
        graphics.fill();
        if (!this.settingsMask.getComponent(BlockInputEvents)) this.settingsMask.addComponent(BlockInputEvents);
    }

    private syncControls(): void {
        const music = this.audio.getMusicVolume();
        const sfx = this.audio.getSfxVolume();
        if (this.musicSlider) this.musicSlider.progress = music;
        if (this.sfxSlider) this.sfxSlider.progress = sfx;
        this.clampHandle(this.musicSlider, this.musicHandle);
        this.clampHandle(this.sfxSlider, this.sfxHandle);
        this.updateBar(this.musicBar, music);
        this.updateBar(this.sfxBar, sfx);
        this.updateLabel(this.musicValueLabel, music);
        this.updateLabel(this.sfxValueLabel, sfx);
    }

    private updateMusic(): void {
        const value = this.musicSlider?.progress ?? 0;
        this.audio.setMusicVolume(value);
        this.clampHandle(this.musicSlider, this.musicHandle);
        this.updateBar(this.musicBar, value);
        this.updateLabel(this.musicValueLabel, value);
    }

    private updateSfx(): void {
        const value = this.sfxSlider?.progress ?? 0;
        this.audio.setSfxVolume(value);
        this.audio.playSfx();
        this.clampHandle(this.sfxSlider, this.sfxHandle);
        this.updateBar(this.sfxBar, value);
        this.updateLabel(this.sfxValueLabel, value);
    }

    private updateBar(bar: Sprite | null, value: number): void {
        if (!bar) return;
        bar.fillRange = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    }

    private clampHandle(slider: Slider | null, handle: Sprite | null): void {
        if (!slider || !handle) return;
        const sliderTransform = slider.node.getComponent(UITransform);
        const handleTransform = handle.node.getComponent(UITransform);
        if (!sliderTransform || !handleTransform) return;
        // Keep the existing minimum position, but place the maximum at the track's right edge.
        const innerHalfRange = Math.max(0, sliderTransform.contentSize.width * 0.5 - handleTransform.contentSize.width * 0.5);
        const maxPosition = sliderTransform.contentSize.width * 0.5;
        const progress = Math.max(0, Math.min(1, slider.progress));
        const position = handle.node.position;
        handle.node.setPosition(-innerHalfRange + progress * (maxPosition + innerHalfRange), position.y, position.z);
    }

    private updateLabel(label: Label | null, value: number): void {
        if (label) label.string = `${Math.round(value * 100)}%`;
    }

    onDestroy(): void {
        const closeNode = this.closeButton?.node;
        const musicNode = this.musicSlider?.node;
        const sfxNode = this.sfxSlider?.node;
        if (closeNode?.isValid) closeNode.off(Button.EventType.CLICK, this.onCloseClick, this);
        if (musicNode?.isValid) musicNode.off(SLIDER_EVENT, this.onMusicSlide, this);
        if (sfxNode?.isValid) sfxNode.off(SLIDER_EVENT, this.onSfxSlide, this);
    }
}

import {
    _decorator,
    Button,
    Component,
    director,
    Label,
    Node,
    sys,
} from 'cc';
import AudioService from './AudioService';
import SettingsController from './SettingsController';
import { startGameLoading } from './LoadingRuntime';

const { ccclass } = _decorator;

console.warn('[MainController] module loaded');

/** Owns main-menu actions and refreshes the two editable record values. */
@ccclass('MainController')
export default class MainController extends Component {
    private static entryOverlayShown = false;
    private _settingsController: SettingsController | null = null;
    private _settingsButtonNode: Node | null = null;
    private readonly onSettingsTouchStart = (): void => {
        console.log('[MainController] SettingsButton TOUCH_START received');
    };

    onLoad(): void {
        console.log('[MainController] onLoad:', this.node.name);
        AudioService.ensure().playBgm();
        this._settingsController = this.node.getComponent(SettingsController) || this.node.addComponent(SettingsController);
        this._bindButton('StartButton', () => this._startGame());
        this._bindSettingsTouchLogger();
        this.refreshRecordValues();
        this._showEntryOverlay();
    }

    private _startGame(): void {
        // Keep audio playback in the original user-gesture call stack.
        AudioService.ensure().playBgm();
        director.loadScene('Loading', (error) => {
            if (error) {
                console.error('[MainController] failed to open Loading scene:', error);
                return;
            }
            startGameLoading();
        });
    }

    /** Opens the editor-created panel before applying the audio control state. */
    openSettings(): void {
        const mask = this.node.getChildByName('SettingsMask');
        const panel = this.node.getChildByName('SettingsPanel');
        console.log('[MainController] openSettings called:', {
            maskFound: !!mask,
            panelFound: !!panel,
            maskBefore: mask?.active,
            panelBefore: panel?.active,
        });
        try {
            // Initialize and sync controls before enabling the full-screen blocker.
            this._settingsController?.open();
        } catch (error) {
            console.error('[MainController] openSettings failed:', error);
            if (mask) mask.active = false;
            if (panel) panel.active = false;
            return;
        }
        if (mask) mask.active = true;
        if (panel) panel.active = true;
        console.log('[MainController] settings state after open:', {
            maskAfter: mask?.active,
            panelAfter: panel?.active,
        });
    }

    private _showEntryOverlay(): void {
        const overlay = this.node.getChildByName('zg');
        if (!overlay || MainController.entryOverlayShown) return;
        MainController.entryOverlayShown = true;
        overlay.active = true;
        this.scheduleOnce(() => {
            if (overlay.isValid) overlay.active = false;
        }, 3);
    }

    private _bindButton(name: string, action: () => void): void {
        const node = this.node.getChildByName(name);
        const button = node && node.getComponent(Button);
        console.log(`[MainController] bind ${name}:`, {
            nodeFound: !!node,
            nodeActive: node?.active,
            buttonFound: !!button,
            buttonEnabled: button?.enabled,
        });
        if (!button) return;
        button.node.on(Button.EventType.CLICK, () => {
            console.log(`[MainController] ${name} CLICK received`);
            action();
        }, this);
    }

    private _bindSettingsTouchLogger(): void {
        const node = this.node.getChildByName('SettingsButton');
        const button = node && node.getComponent(Button);
        console.log('[MainController] bind SettingsButton touch logger:', {
            nodeFound: !!node,
            nodeActive: node?.active,
            buttonFound: !!button,
            buttonEnabled: button?.enabled,
        });
        if (!button) return;
        this._settingsButtonNode = button.node;
        this._settingsButtonNode.on(Node.EventType.TOUCH_START, this.onSettingsTouchStart, this);
    }

    /** Refresh values after a save/profile change without touching editor art or layout. */
    refreshRecordValues(bestDays?: number, feed?: number): void {
        const savedDays = bestDays ?? this._readStoredNumber('fish_best_survived_days');
        const savedFeed = feed ?? this._readStoredNumber('fish_feed');
        if (savedDays !== null) {
            this._setLabel('BestDaysValue', `${Math.max(0, Math.floor(savedDays))}天`);
        }
        if (savedFeed !== null) {
            this._setLabel('FeedValue', this._formatFeed(savedFeed));
        }
    }

    private _readStoredNumber(key: string): number | null {
        const raw = sys.localStorage.getItem(key);
        if (raw === null || raw.trim() === '') return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }

    private _setLabel(name: string, value: string): void {
        const record = this.node.getChildByName('RecordArt');
        const label = record?.getChildByName(name)?.getComponent(Label);
        if (label) label.string = value;
    }

    private _formatFeed(feed: number): string {
        const value = Math.max(0, Math.floor(Number.isFinite(feed) ? feed : 0));
        return value > 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
    }

    onDestroy(): void {
        this.unscheduleAllCallbacks();
        this._unbindButton('StartButton');
        if (this._settingsButtonNode?.isValid) {
            this._settingsButtonNode.off(Node.EventType.TOUCH_START, this.onSettingsTouchStart, this);
        }
    }

    private _unbindButton(name: string): void {
        const node = this.node.getChildByName(name);
        const button = node && node.getComponent(Button);
        const buttonNode = button?.node;
        if (buttonNode?.isValid) buttonNode.off(Button.EventType.CLICK, undefined, this);
    }
}

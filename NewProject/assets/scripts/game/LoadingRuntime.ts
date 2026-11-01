import {
    _decorator,
    Asset,
    AudioClip,
    Component,
    director,
    JsonAsset,
    Label,
    Node,
    resources,
    SpriteFrame,
    Sprite,
} from 'cc';
import GameController from './GameController';

const { ccclass } = _decorator;

type ResourceSection = {
    '美术资源'?: string[];
    '音乐资源'?: string[];
    '配置资源'?: string[];
};

type ResourceManifest = Record<string, ResourceSection>;

interface LoadingView {
    title: Label;
    value: Label;
    fill: Sprite;
    fish: Node;
}

let animationTimer: ReturnType<typeof setInterval> | null = null;
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
let fishTimer: ReturnType<typeof setInterval> | null = null;
let loadingStartedAt = 0;
let fishView: LoadingView | null = null;
let fishTargetProgress = 0;
let fishVisualProgress = 0;
let transitionRequested = false;

/** Handles the temporary Loading scene without adding a script component to the scene file. */
@ccclass('LoadingRuntime')
export default class LoadingRuntime extends Component {}

export function startGameLoading(): void {
    stopAnimation();
    stopTransitionTimer();
    stopFishAnimation();
    loadingStartedAt = Date.now();
    transitionRequested = false;
    const view = getLoadingView();
    if (!view) {
        console.error('[LoadingRuntime] Canvas is missing in Loading scene');
        return;
    }

    startFishAnimation(view);

    let dotCount = 0;
    animationTimer = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        view.title.string = `正在加载游戏资源${'.'.repeat(dotCount)}`;
    }, 350);

    setProgress(view, 1);
    resources.load('config/resource_load_manifest', JsonAsset, (manifestError, manifestAsset) => {
        if (manifestError || !manifestAsset) {
            fail(view, '资源清单加载失败');
            return;
        }
        const paths = collectGameResources(manifestAsset.json as ResourceManifest);
        loadGameResources(paths, view);
    });
}

function getLoadingView(): LoadingView | null {
    const scene = director.getScene();
    const canvas = scene?.getChildByName('Canvas');
    if (!canvas) return null;

    const root = canvas.getChildByName('LoadingView');
    const title = root?.getChildByName('LoadingTitle')?.getComponent(Label);
    const value = root?.getChildByName('LoadingValue')?.getComponent(Label);
    const fill = root?.getChildByName('LoadingFill')?.getComponent(Sprite);
    const fish = root?.getChildByName('LoadingFish');
    if (!root || !title || !value || !fill || !fish) {
        console.error('[LoadingRuntime] Loading.scene art nodes are incomplete');
        return null;
    }
    return { title, value, fill, fish };
}

function setProgress(view: LoadingView, progress: number): void {
    const clamped = Math.max(0, Math.min(100, Math.floor(progress)));
    fishTargetProgress = clamped / 100;
}

function collectGameResources(manifest: ResourceManifest): string[] {
    const section = manifest['游戏场景'] || {};
    const paths = [
        ...(section['美术资源'] || []),
        ...(section['音乐资源'] || []),
        ...(section['配置资源'] || []),
    ];
    return Array.from(new Set(paths));
}

function loadGameResources(paths: string[], view: LoadingView): void {
    if (paths.length === 0) {
        finishLoading(view);
        return;
    }

    let completed = 0;
    let failed = false;
    setProgress(view, 5);
    paths.forEach((rawPath) => {
        loadOneResource(rawPath, (error) => {
            completed += 1;
            if (error) failed = true;
            if (!failed) setProgress(view, Math.min(99, 5 + completed / paths.length * 94));
            if (completed === paths.length) {
                if (failed) fail(view, '游戏资源加载失败');
                else finishLoading(view);
            }
        });
    });
}

function loadOneResource(rawPath: string, done: (error: Error | null) => void): void {
    const normalized = rawPath.replace(/\\/g, '/');
    const resourceRoot = 'assets/resources/';
    const relative = normalized.startsWith(resourceRoot) ? normalized.slice(resourceRoot.length) : normalized;
    const extensionMatch = relative.match(/\.([^.\/]+)$/);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : '';
    const withoutExtension = extensionMatch ? relative.slice(0, -extensionMatch[0].length) : relative;

    if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') {
        resources.load(`${withoutExtension}/spriteFrame`, SpriteFrame, (error) => done(error || null));
        return;
    }
    if (extension === 'mp3' || extension === 'ogg' || extension === 'wav') {
        resources.load(withoutExtension, AudioClip, (error) => done(error || null));
        return;
    }
    if (extension === 'json') {
        resources.load(withoutExtension, JsonAsset, (error) => done(error || null));
        return;
    }
    resources.load(withoutExtension, Asset, (error) => done(error || null));
}

function finishLoading(view: LoadingView): void {
    setProgress(view, 100);
    view.title.string = '加载完成';
    stopAnimation();
    transitionRequested = true;
    waitForFishAndMinimumDuration();
}

function fail(view: LoadingView, message: string): void {
    setProgress(view, 99);
    view.title.string = `${message}，请重试`;
    stopAnimation();
    stopFishAnimation();
}

function stopAnimation(): void {
    if (animationTimer !== null) {
        clearInterval(animationTimer);
        animationTimer = null;
    }
}

function startFishAnimation(view: LoadingView): void {
    fishView = view;
    fishTargetProgress = 0;
    fishVisualProgress = 0;
    setFishPosition();
    fishTimer = setInterval(() => {
        if (!fishView) return;
        const distance = fishTargetProgress - fishVisualProgress;
        // One full left-to-right swim takes about one second instead of jumping.
        const step = 0.016 / 1;
        if (Math.abs(distance) <= step) fishVisualProgress = fishTargetProgress;
        else fishVisualProgress += Math.sign(distance) * step;
        fishView.fill.fillRange = fishVisualProgress;
        fishView.value.string = `${Math.floor(fishVisualProgress * 100)}%`;
        setFishPosition();
        if (transitionRequested) waitForFishAndMinimumDuration();
    }, 16);
}

function setFishPosition(): void {
    if (!fishView) return;
    const fishRange = 480;
    const position = fishView.fish.position;
    fishView.fish.setPosition(-fishRange / 2 + fishRange * fishVisualProgress, position.y, position.z);
}

function waitForFishAndMinimumDuration(): void {
    if (!transitionRequested || transitionTimer !== null) return;
    const elapsed = Date.now() - loadingStartedAt;
    if (elapsed < 1000 || fishVisualProgress < 0.999) {
        transitionTimer = setTimeout(() => {
            transitionTimer = null;
            waitForFishAndMinimumDuration();
        }, 16);
        return;
    }
    stopFishAnimation();
    director.loadScene('Game', (error) => {
        if (error) {
            console.error('[LoadingRuntime] failed to open Game scene:', error);
            return;
        }
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (canvas && !canvas.getComponent(GameController)) canvas.addComponent(GameController);
    });
}

function stopFishAnimation(): void {
    if (fishTimer !== null) {
        clearInterval(fishTimer);
        fishTimer = null;
    }
    fishView = null;
}

function stopTransitionTimer(): void {
    if (transitionTimer !== null) {
        clearTimeout(transitionTimer);
        transitionTimer = null;
    }
}

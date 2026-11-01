import { JsonAsset, resources } from 'cc';

type AdUnitConfig = {
    adUnitId?: string;
    reward_feed?: number;
    timeout_ms?: number;
};

type PlatformAdConfig = {
    channel?: string;
    ad_units?: Record<string, AdUnitConfig>;
};

type AdConfigFile = {
    ad_units?: Record<string, AdUnitConfig>;
    fallback_reward_on_error?: boolean;
    /** 1 = Douyin mini game, 2 = WeChat mini game. */
    platform_mode?: number;
    platforms?: Record<string, PlatformAdConfig>;
};

type RewardedAdLike = {
    load?: () => Promise<unknown> | unknown;
    show?: () => Promise<unknown> | unknown;
    onError?: (callback: (error?: unknown) => void) => void;
    offError?: (callback: (error?: unknown) => void) => void;
    onClose?: (callback: (result?: { isEnded?: boolean }) => void) => void;
    offClose?: (callback: (result?: { isEnded?: boolean }) => void) => void;
};

export type RewardedAdResult = {
    rewardFeed: number;
    fallback: boolean;
};

/** Reads ad IDs from config and always settles a reward request exactly once. */
export default class AdManager {
    private static config: AdConfigFile | null = null;
    private static configLoading = false;
    private static configCallbacks: Array<(config: AdConfigFile | null) => void> = [];
    private static showing = false;

    static showRewarded(adKey: string, callback: (result: RewardedAdResult) => void): boolean {
        if (this.showing) {
            callback({ rewardFeed: 50, fallback: true });
            return false;
        }
        this.showing = true;
        this.loadConfig((config) => {
            const platform = this.getPlatformConfig(config);
            const unit = platform?.ad_units?.[adKey] || config?.ad_units?.[adKey];
            const rewardFeed = Math.max(0, Math.floor(Number(unit?.reward_feed) || 50));
            const adUnitId = (unit?.adUnitId || '').trim();
            if (!adUnitId) {
                this.finish(callback, { rewardFeed, fallback: true });
                return;
            }

            const host = globalThis as unknown as Record<string, any>;
            const api = this.getPlatformApi(host, config);
            const factory = api?.createRewardedVideoAd;
            if (typeof factory !== 'function') {
                this.finish(callback, { rewardFeed, fallback: true });
                return;
            }

            let ad: RewardedAdLike;
            try {
                ad = factory.call(api, { adUnitId }) as RewardedAdLike;
            } catch (error) {
                console.warn('[AdManager] create rewarded ad failed:', error);
                this.finish(callback, { rewardFeed, fallback: true });
                return;
            }

            let settled = false;
            let timeoutHandle: any = null;
            const timeoutMs = Math.max(1000, Math.floor(Number(unit?.timeout_ms) || 8000));
            const settle = (result: RewardedAdResult): void => {
                if (settled) return;
                settled = true;
                if (timeoutHandle !== null) clearTimeout(timeoutHandle);
                ad.offError?.(onError);
                ad.offClose?.(onClose);
                this.finish(callback, result);
            };
            const onError = (): void => settle({ rewardFeed, fallback: true });
            const onClose = (result?: { isEnded?: boolean }): void => {
                const completed = !result || result.isEnded !== false;
                settle({ rewardFeed: completed ? rewardFeed : 0, fallback: false });
            };

            ad.onError?.(onError);
            ad.onClose?.(onClose);
            timeoutHandle = setTimeout(() => settle({ rewardFeed, fallback: true }), timeoutMs);
            try {
                Promise.resolve(ad.load ? ad.load() : undefined)
                    .then(() => Promise.resolve(ad.show ? ad.show() : undefined))
                    .catch(() => settle({ rewardFeed, fallback: true }));
            } catch (error) {
                console.warn('[AdManager] show rewarded ad failed:', error);
                settle({ rewardFeed, fallback: true });
            }
        });
        return true;
    }

    private static getPlatformConfig(config: AdConfigFile | null): PlatformAdConfig | null {
        if (!config) return null;
        const mode = Number(config.platform_mode) === 2 ? 2 : 1;
        return config.platforms?.[String(mode)] || null;
    }

    private static getPlatformApi(host: Record<string, any>, config: AdConfigFile | null): any {
        const mode = Number(config?.platform_mode) === 2 ? 2 : 1;
        return mode === 2 ? host.wx : host.tt;
    }

    private static loadConfig(callback: (config: AdConfigFile | null) => void): void {
        if (this.config) {
            callback(this.config);
            return;
        }
        this.configCallbacks.push(callback);
        if (this.configLoading) return;
        this.configLoading = true;
        resources.load('config/ad_config', JsonAsset, (error, asset) => {
            this.configLoading = false;
            this.config = error || !asset ? null : asset.json as AdConfigFile;
            if (error || !asset) console.warn('[AdManager] ad config failed to load; using fallback reward');
            const callbacks = this.configCallbacks.splice(0);
            callbacks.forEach((pending) => pending(this.config));
        });
    }

    private static finish(callback: (result: RewardedAdResult) => void, result: RewardedAdResult): void {
        this.showing = false;
        callback(result);
    }
}

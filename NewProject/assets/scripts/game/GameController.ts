import {
    _decorator,
    Button,
    Color,
    Component,
    director,
    Graphics,
    Label,
    Node,
    JsonAsset,
    resources,
    screen,
    sys,
    Tween,
    UITransform,
    Vec3,
    view,
    tween,
} from 'cc';
import AdManager from './AdManager';
import { startGameLoading } from './LoadingRuntime';

const { ccclass } = _decorator;

type LocationId = 'workstation' | 'fireStairs' | 'restroom' | 'pantry' | 'gate';
const LOCATION_IDS: LocationId[] = ['workstation', 'fireStairs', 'restroom', 'pantry', 'gate'];
const PLAYER_MOVE_SPEED = 180;
const BOSS_MOVE_SPEED = 95;

type WalkableArea = {
    location: LocationId;
    node: Node;
    left: number;
    right: number;
    bottom: number;
    top: number;
};

type PatrolTargetConfig = {
    location?: LocationId;
    map_id?: string;
    weight: number;
};

type PatrolSegmentConfig = {
    min_day: number;
    max_day: number;
    first_delay_seconds?: [number, number];
    repeat_delay_seconds?: [number, number];
    start_delay_seconds?: [number, number];
    delay_seconds?: [number, number];
    caught_feed_penalty?: number;
    overtime_minutes?: number;
    destination_weights: PatrolTargetConfig[];
};

type PatrolBossConfig = {
    boss_id?: string;
    patrol_segments?: PatrolSegmentConfig[];
};

type MinigameConfig = {
    minigame_id?: string;
    enabled?: boolean;
    location?: LocationId;
    map_id?: string;
    scene?: string;
    scene_name?: string;
    entry_scene?: string;
    overlay_node?: string;
};

type SpotPointConfig = {
    spot_id?: string;
    map_id?: string;
    location?: LocationId;
    minigame_id?: string;
};

type PatrolConfigFile = {
    bosses?: PatrolBossConfig[];
    minigames?: MinigameConfig[];
    spot_points?: SpotPointConfig[];
    global_configs?: {
        boss_patrol_segments?: PatrolSegmentConfig[];
        daily_completion_feed_reward?: number;
        base_work_end_game_minutes?: number;
    };
};

/** Controls map clicks, player route movement, the work clock and boss patrol. */
@ccclass('GameController')
export default class GameController extends Component {
    private player: Node | null = null;
    private boss: Node | null = null;
    private bossRoomWorldPosition: Vec3 | null = null;
    private clockLabel: Label | null = null;
    private workEndLabel: Label | null = null;
    private feedLabel: Label | null = null;
    private bossStatusLabel: Label | null = null;
    private bossAlertLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private routeNodes: Partial<Record<LocationId, Node>> = {};
    private playerTween: Tween<Node> | null = null;
    private bossTween: Tween<Node> | null = null;
    private currentLocation: LocationId = 'workstation';
    private feed = 100;
    private clockSeconds = 9 * 60 * 60;
    private workEndClockSeconds = 18 * 60 * 60 + 30 * 60;
    private clockAccumulator = 0;
    private bossCountdown = 10;
    private bossCountdownAccumulator = 0;
    private bossPatrolPhase: 'countdown' | 'patrol' | 'stopped' = 'countdown';
    private patrolsStartedToday = 0;
    private patrolSegments: PatrolSegmentConfig[] = [];
    private minigameConfigs: MinigameConfig[] = [];
    private patrolTarget: LocationId | null = null;
    private caught = false;
    private dailyFeedReward = 100;
    private dailyCaughtPenalty = 0;
    private dailyOvertimeSeconds = 0;
    private currentDayIndex = 1;
    private workdayEnded = false;
    private autoWalkingToGate = false;
    private bossAlertTween: Tween<Node> | null = null;
    private bossAlertPosition: Vec3 | null = null;
    private pauseOverlay: Node | null = null;
    private pausePanel: Node | null = null;
    private gamePaused = false;
    private returningToMain = false;
    private offWorkOverlay: Node | null = null;
    private offWorkHoursLabel: Label | null = null;
    private offWorkMischiefHoursLabel: Label | null = null;
    private offWorkCurrentFeedLabel: Label | null = null;
    private gameOverOverlay: Node | null = null;
    private gameOverDaysLabel: Label | null = null;
    private gameOverFeedLabel: Label | null = null;
    private restartingGame = false;
    private todayAdReward = 0;
    private daySettled = false;
    private activeMinigameOverlay: Node | null = null;
    private safeAreaBasePositions = new Map<Node, Vec3>();

    onLoad(): void {
        const art = this.node.getChildByName('GameArt');
        this.player = art?.getChildByName('GameEmployee') || null;
        this.boss = art?.getChildByName('GameBoss') || null;
        this.bossRoomWorldPosition = this.boss ? this.getActorFeetWorldPosition(this.boss) : null;
        this.clockLabel = this.getLabel('ClockLabel');
        this.workEndLabel = this.getLabel('WorkEndLabel');
        this.feedLabel = this.getLabel('FeedLabel');
        this.bossStatusLabel = this.getLabel('BossStatus');
        this.bossAlertLabel = this.getLabel('BossAlertLabel');
        if (this.bossAlertLabel) {
            this.bossAlertPosition = this.bossAlertLabel.node.position.clone();
            this.bossAlertLabel.node.active = false;
        }
        this.hintLabel = this.getLabel('InteractionHint');
        this.setupPauseOverlay();
        this.setupOffWorkOverlay();
        this.setupGameOverOverlay();
        const minigameOverlay = this.node.getChildByName('MinigameOverlay');
        if (minigameOverlay) minigameOverlay.active = false;

        this.routeNodes.workstation = this.node.getChildByName('RouteToWorkstation') || undefined;
        this.routeNodes.fireStairs = this.node.getChildByName('RouteToFireStairs') || undefined;
        this.routeNodes.restroom = this.node.getChildByName('RouteToRestroom') || undefined;
        this.routeNodes.pantry = this.node.getChildByName('RouteToPantry') || undefined;
        this.routeNodes.gate = this.node.getChildByName('RouteToGate') || undefined;

        this.bindLocationZone('ZoneWorkstation', 'workstation');
        this.bindLocationZone('ZoneFireStairs', 'fireStairs');
        this.bindLocationZone('ZoneRestroom', 'restroom');
        this.bindLocationZone('ZonePantry', 'pantry');
        this.bindLocationZone('ZoneGate', 'gate');

        this.updateClockLabels();
        this.updateFeedLabel();
        this.applyHudSafeArea();
        screen.on('window-resize', this.applyHudSafeArea, this);
        view.on('design-resolution-changed', this.applyHudSafeArea, this);
        this.scheduleNextPatrol();
        this.loadPatrolConfig();
    }

    update(deltaTime: number): void {
        if (this.gamePaused) return;
        this.clockAccumulator += deltaTime;
        if (this.clockAccumulator >= 1) {
            const elapsedSeconds = Math.floor(this.clockAccumulator);
            this.clockAccumulator -= elapsedSeconds;
            this.clockSeconds += elapsedSeconds;
            const effectiveEnd = this.getEffectiveWorkEndClockSeconds();
            const dayStart = (this.currentDayIndex - 1) * 86400;
            if (this.clockSeconds >= dayStart + effectiveEnd) {
                this.clockSeconds = dayStart + effectiveEnd;
                this.workdayEnded = true;
            }
            this.updateClockLabels();
        }

        if (this.isAfterWork()) {
            this.stopBossPatrolAfterWork();
            this.autoWalkToGate();
            return;
        }

        if (this.bossPatrolPhase === 'countdown') {
            this.bossCountdownAccumulator += deltaTime;
            if (this.bossCountdownAccumulator >= 1) {
                const elapsedSeconds = Math.floor(this.bossCountdownAccumulator);
                this.bossCountdownAccumulator -= elapsedSeconds;
                this.bossCountdown = Math.max(0, this.bossCountdown - elapsedSeconds);
                if (this.bossCountdown === 0 && this.patrolTarget) this.startBossPatrol(this.patrolTarget);
                else this.showBossCountdown();
            }
        }
    }

    private bindLocationZone(nodeName: string, location: LocationId): void {
        const zone = this.node.getChildByName(nodeName);
        if (!zone) {
            console.warn(`[GameController] missing click zone: ${nodeName}`);
            return;
        }
        const eventType = zone.getComponent(Button) ? Button.EventType.CLICK : Node.EventType.TOUCH_END;
        zone.on(eventType, () => this.movePlayerTo(location), this);
    }

    private isAfterWork(): boolean {
        return this.workdayEnded || (this.clockSeconds % 86400) >= this.getEffectiveWorkEndClockSeconds();
    }

    private getEffectiveWorkEndClockSeconds(): number {
        return Math.min(24 * 60 * 60, Math.max(0, this.workEndClockSeconds + this.dailyOvertimeSeconds));
    }

    private isLeisureLocation(location: LocationId): boolean {
        return location === 'pantry' || location === 'restroom' || location === 'fireStairs';
    }

    private handleLeisureArrival(location: LocationId): void {
        if (this.isAfterWork()) {
            this.showBossAlert('已经下班，别摸鱼了');
            return;
        }

        const mapIds: Partial<Record<LocationId, string>> = {
            pantry: 'MAP003',
            restroom: 'MAP004',
            fireStairs: 'MAP005',
        };
        const mapId = mapIds[location];
        const config = this.minigameConfigs.find((entry) =>
            entry.enabled !== false && (entry.location === location || entry.map_id === mapId),
        );
        const entryName = config?.overlay_node || config?.scene || config?.scene_name || config?.entry_scene || 'MinigameOverlay';
        if (!config || !entryName) {
            this.showBossAlert('摸鱼游戏异常');
            return;
        }

        // The minigame is an editor-created child overlay in Game.scene. It must
        // stay in this scene so the clock and boss patrol keep running.
        const minigameOverlay = this.node.getChildByName(config.overlay_node || entryName);
        if (!minigameOverlay) {
            this.showBossAlert('摸鱼游戏异常');
            return;
        }
        this.activeMinigameOverlay?.setSiblingIndex(this.node.children.length - 1);
        this.activeMinigameOverlay = minigameOverlay;
        minigameOverlay.active = true;
        minigameOverlay.setSiblingIndex(this.node.children.length - 1);
    }

    private setupPauseOverlay(): void {
        this.pauseOverlay = this.node.getChildByName('PauseOverlay');
        this.pausePanel = this.pauseOverlay?.getChildByName('PausePanel') || null;
        if (!this.pauseOverlay) return;
        this.pauseOverlay.active = false;
        const pauseButton = this.node.getChildByName('PauseButton');
        const resumeButton = this.pausePanel?.getChildByName('ResumeButton');
        const exitButton = this.pausePanel?.getChildByName('ExitButton');
        pauseButton?.on(Button.EventType.CLICK, this.pauseGame, this);
        resumeButton?.on(Button.EventType.CLICK, this.resumeGame, this);
        exitButton?.on(Button.EventType.CLICK, this.returnToMain, this);

        const mask = this.pauseOverlay.getChildByName('PauseMask');
        const maskTransform = mask?.getComponent(UITransform);
        if (mask && maskTransform && !mask.getComponent(Graphics)) {
            const graphics = mask.addComponent(Graphics);
            graphics.fillColor = new Color(0, 0, 0, 150);
            graphics.rect(
                -maskTransform.width * maskTransform.anchorPoint.x,
                -maskTransform.height * maskTransform.anchorPoint.y,
                maskTransform.width,
                maskTransform.height,
            );
            graphics.fill();
        }
    }

    private setupOffWorkOverlay(): void {
        this.offWorkOverlay = this.node.getChildByName('OffWorkOverlay');
        if (!this.offWorkOverlay) return;
        this.offWorkOverlay.active = false;
        const panel = this.offWorkOverlay.getChildByName('OffWorkPanel');
        this.offWorkHoursLabel = panel?.getChildByName('WorkHoursRow')?.getChildByName('WorkHoursText')?.getComponent(Label) || null;
        this.offWorkMischiefHoursLabel = panel?.getChildByName('MischiefHoursRow')?.getChildByName('MischiefHoursText')?.getComponent(Label) || null;
        this.offWorkCurrentFeedLabel = panel?.getChildByName('TodayFeedRow')?.getChildByName('TodayFeedText')?.getComponent(Label) || null;
        const endGameButton = panel?.getChildByName('EndGameButton');
        const nextDayButton = panel?.getChildByName('NextDayButton');
        const workButton = panel?.getChildByName('WorkButton');
        const mask = this.offWorkOverlay.getChildByName('OffWorkMask');
        const maskTransform = mask?.getComponent(UITransform);
        if (mask && maskTransform && !mask.getComponent(Graphics)) {
            const graphics = mask.addComponent(Graphics);
            graphics.fillColor = new Color(0, 0, 0, 150);
            graphics.rect(
                -maskTransform.width * maskTransform.anchorPoint.x,
                -maskTransform.height * maskTransform.anchorPoint.y,
                maskTransform.width,
                maskTransform.height,
            );
            graphics.fill();
        }
        endGameButton?.on(Button.EventType.CLICK, this.showGameOverOverlay, this);
        nextDayButton?.on(Button.EventType.CLICK, this.finishDayAndStartNextDay, this);
        workButton?.on(Button.EventType.CLICK, this.chooseWorkAfterWork, this);
        // Keep a node-level fallback for editor-created buttons whose Button.CLICK
        // is not dispatched by the preview input path.
        endGameButton?.on(Node.EventType.TOUCH_END, this.showGameOverOverlay, this);
        nextDayButton?.on(Node.EventType.TOUCH_END, this.finishDayAndStartNextDay, this);
        workButton?.on(Node.EventType.TOUCH_END, this.chooseWorkAfterWork, this);
    }

    private setupGameOverOverlay(): void {
        this.gameOverOverlay = this.node.getChildByName('GameOverOverlay');
        if (!this.gameOverOverlay) return;
        this.gameOverOverlay.active = false;
        const panel = this.gameOverOverlay.getChildByName('GameOverPanel');
        this.gameOverDaysLabel = panel?.getChildByName('GameOverDaysRow')
            ?.getChildByName('GameOverDaysText')?.getComponent(Label) || null;
        this.gameOverFeedLabel = panel?.getChildByName('GameOverFeedRow')
            ?.getChildByName('GameOverFeedText')?.getComponent(Label) || null;
        const homeButton = panel?.getChildByName('GameOverHomeButton');
        const retryButton = panel?.getChildByName('GameOverRetryButton');
        homeButton?.on(Button.EventType.CLICK, this.returnToMain, this);
        retryButton?.on(Button.EventType.CLICK, this.restartGame, this);
        homeButton?.on(Node.EventType.TOUCH_END, this.returnToMain, this);
        retryButton?.on(Node.EventType.TOUCH_END, this.restartGame, this);

        const mask = this.gameOverOverlay.getChildByName('GameOverMask');
        const maskTransform = mask?.getComponent(UITransform);
        if (mask && maskTransform && !mask.getComponent(Graphics)) {
            const graphics = mask.addComponent(Graphics);
            graphics.fillColor = new Color(0, 0, 0, 150);
            graphics.rect(
                -maskTransform.width * maskTransform.anchorPoint.x,
                -maskTransform.height * maskTransform.anchorPoint.y,
                maskTransform.width,
                maskTransform.height,
            );
            graphics.fill();
        }
        this.updateGameOverOverlay();
        if (this.feed < 0) this.showGameOverOverlay();
    }

    private updateGameOverOverlay(): void {
        if (this.gameOverDaysLabel) this.gameOverDaysLabel.string = String(this.currentDayIndex);
        if (this.gameOverFeedLabel) this.gameOverFeedLabel.string = String(this.feed);
    }

    private showGameOverOverlay(): void {
        if (!this.gameOverOverlay || this.gameOverOverlay.active) return;
        this.updateGameOverOverlay();
        if (this.activeMinigameOverlay) {
            this.activeMinigameOverlay.active = false;
            this.activeMinigameOverlay = null;
        }
        if (this.offWorkOverlay) this.offWorkOverlay.active = false;
        if (this.pauseOverlay) this.pauseOverlay.active = false;
        this.gamePaused = true;
        this.playerTween?.stop();
        this.bossTween?.stop();
        this.bossAlertTween?.stop();
        this.gameOverOverlay.active = true;
    }

    private restartGame(): void {
        if (!this.gameOverOverlay?.active || this.restartingGame) return;
        this.restartingGame = true;
        this.gameOverOverlay.active = false;
        this.gamePaused = false;
        this.playerTween?.stop();
        this.bossTween?.stop();
        this.bossAlertTween?.stop();
        director.resume();
        director.loadScene('Loading', (error) => {
            if (error) {
                this.restartingGame = false;
                this.gamePaused = true;
                if (this.gameOverOverlay) this.gameOverOverlay.active = true;
                console.error('[GameController] failed to open Loading scene for restart:', error);
                return;
            }
            this.restartingGame = false;
            startGameLoading();
        });
    }

    private showOffWorkOverlay(): void {
        this.updateOffWorkOverlay();
        if (this.offWorkOverlay) this.offWorkOverlay.active = true;
    }

    private closeOffWorkOverlay(): void {
        if (this.offWorkOverlay) this.offWorkOverlay.active = false;
    }

    private chooseWorkAfterWork(): void {
        if (!this.offWorkOverlay?.active) return;
        this.closeOffWorkOverlay();
        AdManager.showRewarded('gate_work_reward', (result) => {
            // A completed ad (or the configured fallback path) grants the work reward
            // and immediately rolls the player into the next day.
            if (result.rewardFeed <= 0) {
                this.updateOffWorkOverlay();
                if (this.offWorkOverlay) this.offWorkOverlay.active = true;
                return;
            }
            this.todayAdReward += result.rewardFeed;
            this.settleTodayFeed();
            if (this.feed >= 0) this.startNextDay();
        });
    }

    private finishDayAndStartNextDay(): void {
        if (!this.offWorkOverlay?.active) return;
        this.closeOffWorkOverlay();
        this.settleTodayFeed();
        if (this.feed >= 0) this.startNextDay();
    }

    private settleTodayFeed(): void {
        if (this.daySettled) return;
        // Catch penalties are applied immediately in catchPlayer; only add the
        // day's fixed reward and any completed ad reward during settlement.
        const todayFeed = this.dailyFeedReward + this.todayAdReward;
        this.feed += todayFeed;
        this.daySettled = true;
        this.updateFeedLabel();
        this.updateOffWorkOverlay();
        sys.localStorage.setItem('fish_feed', String(this.feed));
        sys.localStorage.setItem('fish_best_survived_days', String(this.currentDayIndex));
    }

    private updateOffWorkOverlay(): void {
        const secondOfDay = this.clockSeconds % 86400;
        const workSeconds = Math.max(0, secondOfDay - 9 * 60 * 60);
        if (this.offWorkHoursLabel) this.offWorkHoursLabel.string = this.formatDuration(workSeconds);
        if (this.offWorkMischiefHoursLabel) this.offWorkMischiefHoursLabel.string = '00:00:00';
        if (this.offWorkCurrentFeedLabel) this.offWorkCurrentFeedLabel.string = String(this.feed);
    }

    private startNextDay(): void {
        if (this.offWorkOverlay) this.offWorkOverlay.active = false;
        this.playerTween?.stop();
        this.bossTween?.stop();
        this.currentDayIndex += 1;
        this.clockSeconds = (this.currentDayIndex - 1) * 86400 + 9 * 60 * 60;
        this.workdayEnded = false;
        this.autoWalkingToGate = false;
        this.dailyCaughtPenalty = 0;
        this.dailyOvertimeSeconds = 0;
        this.todayAdReward = 0;
        this.daySettled = false;
        this.patrolsStartedToday = 0;
        this.currentLocation = 'workstation';
        if (this.player) {
            const workstationPosition = this.getZoneWorldPosition('workstation');
            if (workstationPosition) this.player.setPosition(this.toActorPosition(this.player, workstationPosition));
        }
        if (this.boss && this.bossRoomWorldPosition) {
            this.boss.setPosition(this.toActorPosition(this.boss, this.bossRoomWorldPosition));
        }
        this.updateClockLabels();
        this.updateFeedLabel();
        this.scheduleNextPatrol();
    }

    private pauseGame(): void {
        if (this.gamePaused || !this.pauseOverlay) return;
        this.gamePaused = true;
        this.playerTween?.pause();
        this.bossTween?.pause();
        this.bossAlertTween?.pause();
        this.pauseOverlay.active = true;
    }

    private resumeGame(): void {
        if (!this.gamePaused) return;
        this.gamePaused = false;
        if (this.pauseOverlay) this.pauseOverlay.active = false;
        this.playerTween?.resume();
        this.bossTween?.resume();
        this.bossAlertTween?.resume();
    }

    private returnToMain(): void {
        if (this.returningToMain) return;
        this.returningToMain = true;
        if (this.pauseOverlay) this.pauseOverlay.active = false;
        this.playerTween?.stop();
        this.bossTween?.stop();
        this.bossAlertTween?.stop();
        this.gamePaused = false;
        if (this.offWorkOverlay) this.offWorkOverlay.active = false;
        if (this.gameOverOverlay) this.gameOverOverlay.active = false;
        if (this.activeMinigameOverlay) {
            this.activeMinigameOverlay.active = false;
            this.activeMinigameOverlay = null;
        }
        director.resume();
        director.preloadScene('Main', (preloadError) => {
            if (preloadError) {
                this.returningToMain = false;
                console.error('[GameController] failed to preload Main scene:', preloadError);
                return;
            }
            director.loadScene('Main', (loadError) => {
                if (loadError) {
                    this.returningToMain = false;
                    console.error('[GameController] failed to return to Main scene:', loadError);
                }
            });
        });
    }

    private movePlayerTo(location: LocationId): void {
        if (!this.player || this.caught || this.playerTween) return;
        if (this.isAfterWork() && location !== 'gate') return;
        if (location === this.currentLocation) {
            if (location === 'gate') this.showOffWorkOverlay();
            return;
        }
        if (this.activeMinigameOverlay && location !== this.currentLocation) {
            this.activeMinigameOverlay.active = false;
            this.activeMinigameOverlay = null;
        }
        const route = this.buildRoute(this.currentLocation, location);
        this.playerTween = tween(this.player);
        let previousPoint = this.player.position.clone();
        route.forEach((worldPoint) => {
            const point = this.toActorPosition(this.player!, worldPoint);
            const distance = Vec3.distance(previousPoint, point);
            if (distance > 0.01) {
                this.playerTween!.to(distance / PLAYER_MOVE_SPEED, { position: point }, { easing: 'linear' });
            }
            previousPoint = point;
        });
        this.playerTween.call(() => {
            this.currentLocation = location;
            this.playerTween = null;
            this.autoWalkingToGate = false;
            if (location === 'gate') this.showOffWorkOverlay();
            else if (this.isLeisureLocation(location)) this.handleLeisureArrival(location);
        }).start();
    }

    private autoWalkToGate(): void {
        if (this.autoWalkingToGate || !this.player || this.currentLocation === 'gate') {
            if (this.currentLocation === 'gate') this.showOffWorkOverlay();
            return;
        }
        this.activeMinigameOverlay && (this.activeMinigameOverlay.active = false);
        this.activeMinigameOverlay = null;
        this.playerTween?.stop();
        this.playerTween = null;
        this.autoWalkingToGate = true;
        this.movePlayerTo('gate');
    }

    private buildRoute(from: LocationId, to: LocationId): Vec3[] {
        const target = this.getZoneWorldPosition(to);
        return this.buildTravelRoute(from, to, this.player ? this.getActorFeetWorldPosition(this.player) : null, target);
    }

    private buildTravelRoute(
        from: LocationId,
        to: LocationId,
        startWorldPosition: Vec3 | null,
        targetWorldPosition: Vec3 | null,
    ): Vec3[] {
        const points: Vec3[] = [];
        const startArea = startWorldPosition
            ? this.findNearestArea(startWorldPosition)
            : this.getWalkableArea(from);
        const targetArea = targetWorldPosition
            ? this.findNearestArea(targetWorldPosition)
            : this.getWalkableArea(to);
        const path = startArea && targetArea
            ? this.findAreaPath(startArea.location, targetArea.location)
            : [startArea?.location || from, targetArea?.location || to];
        if (startWorldPosition && startArea) {
            this.appendRoutePoints(points, this.getDownEntryPoints(startWorldPosition, startArea));
        }
        for (let index = 0; index < path.length - 1; index += 1) {
            const current = this.getWalkableArea(path[index]);
            const next = this.getWalkableArea(path[index + 1]);
            if (current && next) points.push(this.getAreaTransition(current, next));
        }
        if (targetWorldPosition && targetArea) {
            this.appendRoutePoints(points, [this.getBelowEndpoint(targetWorldPosition)]);
            points.push(targetWorldPosition.clone());
        }
        return points;
    }

    private getDownEntryPoints(startWorldPosition: Vec3, area: WalkableArea): Vec3[] {
        const downY = Math.min(startWorldPosition.y, area.bottom);
        const downPoint = new Vec3(startWorldPosition.x, downY, startWorldPosition.z);
        const entryPoint = new Vec3(
            this.clamp(startWorldPosition.x, area.left, area.right),
            area.bottom,
            startWorldPosition.z,
        );
        return [downPoint, entryPoint];
    }

    private getBelowEndpoint(targetWorldPosition: Vec3): Vec3 {
        return new Vec3(targetWorldPosition.x, targetWorldPosition.y - 80, targetWorldPosition.z);
    }

    private findAreaPath(from: LocationId, to: LocationId): LocationId[] {
        if (from === to) return [from];
        const queue: LocationId[] = [from];
        const previous: Partial<Record<LocationId, LocationId | null>> = { [from]: null };
        while (queue.length > 0) {
            const current = queue.shift()!;
            for (const candidate of LOCATION_IDS) {
                if (previous[candidate] !== undefined) continue;
                const currentArea = this.getWalkableArea(current);
                const candidateArea = this.getWalkableArea(candidate);
                if (!currentArea || !candidateArea || !this.areasTouch(currentArea, candidateArea)) continue;
                previous[candidate] = current;
                if (candidate === to) return this.rebuildAreaPath(previous, from, to);
                queue.push(candidate);
            }
        }
        return [from, to];
    }

    private rebuildAreaPath(
        previous: Partial<Record<LocationId, LocationId | null>>,
        from: LocationId,
        to: LocationId,
    ): LocationId[] {
        const path: LocationId[] = [];
        let current: LocationId | null = to;
        while (current) {
            path.unshift(current);
            if (current === from) break;
            current = previous[current] || null;
        }
        return path.length > 0 && path[0] === from ? path : [from, to];
    }

    private getWalkableArea(location: LocationId): WalkableArea | null {
        const node = this.routeNodes[location];
        const transform = node?.getComponent(UITransform);
        if (!node || !transform || transform.width <= 0 || transform.height <= 0) return null;
        const center = node.worldPosition;
        const anchor = transform.anchorPoint;
        return {
            location,
            node,
            left: center.x - transform.width * anchor.x,
            right: center.x + transform.width * (1 - anchor.x),
            bottom: center.y - transform.height * anchor.y,
            top: center.y + transform.height * (1 - anchor.y),
        };
    }

    private areasTouch(first: WalkableArea, second: WalkableArea): boolean {
        const padding = 8;
        return first.left <= second.right + padding
            && first.right + padding >= second.left
            && first.bottom <= second.top + padding
            && first.top + padding >= second.bottom;
    }

    private getAreaTransition(first: WalkableArea, second: WalkableArea): Vec3 {
        const left = Math.max(first.left, second.left);
        const right = Math.min(first.right, second.right);
        const bottom = Math.max(first.bottom, second.bottom);
        const top = Math.min(first.top, second.top);
        if (left <= right && bottom <= top) {
            return new Vec3((left + right) / 2, (bottom + top) / 2, 0);
        }
        return new Vec3(
            this.clamp((first.left + first.right) / 2, second.left, second.right),
            this.clamp((first.bottom + first.top) / 2, second.bottom, second.top),
            0,
        );
    }

    private getZoneWorldPosition(location: LocationId): Vec3 | null {
        const zone = this.node.getChildByName(this.getZoneName(location));
        return zone ? this.getNodeBottomCenterWorldPosition(zone) : null;
    }

    private getActorFeetWorldPosition(actor: Node): Vec3 {
        return this.getNodeBottomCenterWorldPosition(actor);
    }

    private getNodeBottomCenterWorldPosition(node: Node): Vec3 {
        const position = node.worldPosition.clone();
        const transform = node.getComponent(UITransform);
        if (transform) position.y -= transform.height * transform.anchorPoint.y;
        return position;
    }

    private toActorPosition(actor: Node, worldFeetPoint: Vec3): Vec3 {
        const worldPivotPoint = worldFeetPoint.clone();
        const transform = actor.getComponent(UITransform);
        if (transform) worldPivotPoint.y += transform.height * transform.anchorPoint.y;
        const local = new Vec3();
        if (actor.parent) actor.parent.inverseTransformPoint(local, worldPivotPoint);
        else local.set(worldPivotPoint);
        local.z = actor.position.z;
        return local;
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private startBossPatrol(target: LocationId): void {
        if (this.isAfterWork() || !this.boss || this.bossTween) return;
        const points = this.buildBossPatrolRoute(target);
        if (points.length === 0) {
            this.scheduleNextPatrol();
            return;
        }
        this.bossPatrolPhase = 'patrol';
        this.patrolsStartedToday += 1;
        this.setBossStatus(`本次巡逻${this.getLocationDisplayName(target)}`);
        this.bossTween = tween(this.boss);
        let previousPoint = this.boss.position.clone();
        points.forEach((worldPoint) => {
            const point = this.toActorPosition(this.boss!, worldPoint);
            const distance = Vec3.distance(previousPoint, point);
            if (distance > 0.01) {
                this.bossTween!.to(distance / BOSS_MOVE_SPEED, { position: point }, { easing: 'linear' });
            }
            previousPoint = point;
        });
        this.bossTween.call(() => {
            this.bossTween = null;
            this.checkPatrolArrival(target);
            this.returnBossToRoom(points);
        }).start();
    }

    private checkPatrolArrival(target: LocationId): void {
        if (!this.player || this.caught) return;
        const playerAtTarget = !this.playerTween && this.currentLocation === target;
        const conditionSatisfied = target === 'workstation' ? playerAtTarget : !playerAtTarget;
        if (conditionSatisfied) return;
        const penalty = this.getCaughtFeedPenalty();
        const message = target === 'workstation'
            ? `未在工位扣草料：${penalty}`
            : `工作时间在摸鱼扣草料：${penalty}`;
        this.catchPlayer(message, penalty);
    }

    private catchPlayer(message: string, penalty: number): void {
        if (!this.player || this.caught) return;
        this.caught = true;
        this.feed -= penalty;
        this.dailyCaughtPenalty += penalty;
        const overtimeMinutes = this.getPatrolOvertimeMinutes();
        this.dailyOvertimeSeconds = Math.max(this.dailyOvertimeSeconds, overtimeMinutes * 60);
        this.updateClockLabels();
        this.updateFeedLabel();
        this.showBossAlert(message);
        this.caught = false;
    }

    private showBossAlert(message: string): void {
        if (!this.bossAlertLabel) return;
        const alertNode = this.bossAlertLabel.node;
        this.bossAlertTween?.stop();
        this.bossAlertLabel.string = message;
        const targetPosition = this.bossAlertPosition?.clone() || alertNode.position.clone();
        const startPosition = targetPosition.clone();
        startPosition.y -= 140;
        alertNode.setPosition(startPosition);
        alertNode.active = true;
        this.bossAlertTween = tween(alertNode)
            .to(0.6, { position: targetPosition }, { easing: 'linear' })
            .delay(2)
            .call(() => {
                alertNode.active = false;
                this.bossAlertTween = null;
            })
            .start();
    }

    private buildBossPatrolRoute(target: LocationId): Vec3[] {
        if (!this.boss) return [];
        const startArea = this.findNearestArea(this.getActorFeetWorldPosition(this.boss));
        const targetPosition = this.getZoneWorldPosition(target);
        if (!startArea) return targetPosition ? [targetPosition] : [];
        return this.buildTravelRoute(
            startArea.location,
            target,
            this.getActorFeetWorldPosition(this.boss),
            targetPosition,
        );
    }

    private findNearestArea(worldPosition: Vec3): WalkableArea | null {
        let nearest: WalkableArea | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        LOCATION_IDS.forEach((location) => {
            const area = this.getWalkableArea(location);
            if (!area) return;
            const closestX = this.clamp(worldPosition.x, area.left, area.right);
            const closestY = this.clamp(worldPosition.y, area.bottom, area.top);
            const distance = Vec3.distance(worldPosition, new Vec3(closestX, closestY, worldPosition.z));
            if (distance < nearestDistance) {
                nearest = area;
                nearestDistance = distance;
            }
        });
        return nearest;
    }

    private appendRoutePoints(route: Vec3[], points: Vec3[]): void {
        points.forEach((point) => {
            const last = route[route.length - 1];
            if (!last || Vec3.distance(last, point) > 1) route.push(point.clone());
        });
    }

    private returnBossToRoom(outboundRoute: Vec3[]): void {
        if (!this.boss || outboundRoute.length === 0) {
            this.scheduleNextPatrol();
            return;
        }
        this.bossTween = tween(this.boss);
        const returnRoute = outboundRoute.slice().reverse();
        if (this.bossRoomWorldPosition) this.appendRoutePoints(returnRoute, [this.bossRoomWorldPosition]);
        let previousPoint = this.boss.position.clone();
        returnRoute.forEach((point) => {
            const localPoint = this.toActorPosition(this.boss!, point);
            const distance = Vec3.distance(previousPoint, localPoint);
            if (distance > 0.01) {
                this.bossTween!.to(distance / BOSS_MOVE_SPEED, { position: localPoint }, { easing: 'linear' });
            }
            previousPoint = localPoint;
        });
        this.bossTween.call(() => {
            this.bossTween = null;
            this.scheduleNextPatrol();
        }).start();
    }

    private showBossCountdown(): void {
        this.setBossStatus(`老板：${this.bossCountdown}秒后开始巡逻`);
    }

    private scheduleNextPatrol(): void {
        if (this.isAfterWork()) {
            this.stopBossPatrolAfterWork();
            return;
        }
        this.bossPatrolPhase = 'countdown';
        const segment = this.getPatrolSegment();
        if (!segment) {
            this.bossCountdown = 0;
            this.patrolTarget = null;
            this.setBossStatus('老板：等待巡逻配置');
            return;
        }
        const range = this.getDelayRange(segment);
        this.bossCountdown = this.randomInt(range[0], range[1]);
        this.patrolTarget = this.pickPatrolTarget(segment);
        this.bossCountdownAccumulator = 0;
        this.showBossCountdown();
    }

    private stopBossPatrolAfterWork(): void {
        if (this.bossPatrolPhase === 'stopped' && !this.bossTween) return;
        this.bossTween?.stop();
        this.bossTween = null;
        this.bossPatrolPhase = 'stopped';
        this.bossCountdown = 0;
        this.bossCountdownAccumulator = 0;
        this.patrolTarget = null;
    }

    private loadPatrolConfig(): void {
        resources.load('config/fish_simulator_config', JsonAsset, (error, asset) => {
            if (error || !asset) {
                console.warn('[GameController] patrol config failed to load, using defaults');
                return;
            }
            const config = asset.json as PatrolConfigFile;
            const spots = Array.isArray(config.spot_points) ? config.spot_points : [];
            const mapToLocation: Partial<Record<string, LocationId>> = {
                MAP003: 'pantry',
                MAP004: 'restroom',
                MAP005: 'fireStairs',
            };
            this.minigameConfigs = (Array.isArray(config.minigames) ? config.minigames : []).map((entry) => {
                const spot = spots.find((candidate) => candidate.minigame_id === entry.minigame_id);
                return {
                    ...entry,
                    location: entry.location || spot?.location || (spot?.map_id ? mapToLocation[spot.map_id] : undefined),
                    map_id: entry.map_id || spot?.map_id,
                };
            });
            const configuredWorkEndMinutes = Number(config.global_configs?.base_work_end_game_minutes);
            if (Number.isFinite(configuredWorkEndMinutes)) {
                this.workEndClockSeconds = Math.max(0, configuredWorkEndMinutes * 60);
            }
            const configuredDailyReward = Number(config.global_configs?.daily_completion_feed_reward);
            if (Number.isFinite(configuredDailyReward)) {
                this.dailyFeedReward = Math.max(0, Math.floor(configuredDailyReward));
                this.updateFeedLabel();
            }
            const bossConfig = config.bosses?.find((boss) => !boss.boss_id || boss.boss_id === 'M001');
            const segments = bossConfig?.patrol_segments || config.global_configs?.boss_patrol_segments;
            if (segments && segments.length > 0) {
                this.patrolSegments = segments;
                this.scheduleNextPatrol();
            }
        });
    }

    private getPatrolSegment(): PatrolSegmentConfig | null {
        const day = Math.floor(this.clockSeconds / 86400) + 1;
        return this.patrolSegments.find((segment) => day >= segment.min_day && day <= segment.max_day)
            || this.patrolSegments[this.patrolSegments.length - 1]
            || null;
    }

    private getDelayRange(segment: PatrolSegmentConfig): [number, number] {
        const range = this.patrolsStartedToday === 0
            ? segment.first_delay_seconds || segment.start_delay_seconds || segment.delay_seconds || [0, 0]
            : segment.repeat_delay_seconds || segment.delay_seconds || segment.first_delay_seconds || [0, 0];
        const min = Math.max(0, Math.floor(Math.min(range[0], range[1])));
        const max = Math.max(min, Math.floor(Math.max(range[0], range[1])));
        return [min, max];
    }

    private getCaughtFeedPenalty(): number {
        const configured = Number(this.getPatrolSegment()?.caught_feed_penalty);
        return Number.isFinite(configured) ? Math.max(0, Math.floor(configured)) : 50;
    }

    private getPatrolOvertimeMinutes(): number {
        const configured = Number(this.getPatrolSegment()?.overtime_minutes);
        return Number.isFinite(configured) ? Math.max(0, Math.floor(configured)) : 0;
    }

    private pickPatrolTarget(segment: PatrolSegmentConfig): LocationId | null {
        const entries = segment.destination_weights
            .map((entry) => ({ location: this.toLocationId(entry), weight: Math.max(0, Number(entry.weight) || 0) }))
            .filter((entry) => entry.location && entry.weight > 0) as Array<{ location: LocationId; weight: number }>;
        if (entries.length === 0) return null;
        const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
        let cursor = Math.random() * total;
        for (const entry of entries) {
            cursor -= entry.weight;
            if (cursor < 0) return entry.location;
        }
        return entries[entries.length - 1].location;
    }

    private toLocationId(entry: PatrolTargetConfig): LocationId | null {
        if (entry.location) return entry.location;
        const mapToLocation: Record<string, LocationId> = {
            MAP001: 'workstation',
            MAP003: 'pantry',
            MAP004: 'restroom',
            MAP005: 'fireStairs',
        };
        return entry.map_id ? mapToLocation[entry.map_id] || null : null;
    }

    private getLocationDisplayName(location: LocationId): string {
        const names: Record<LocationId, string> = {
            workstation: '工位',
            fireStairs: '消防楼梯',
            restroom: '洗手间',
            pantry: '茶水间',
            gate: '大门',
        };
        return names[location];
    }

    private randomInt(min: number, max: number): number {
        return min === max ? min : Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private updateClockLabels(): void {
        const day = this.workdayEnded ? this.currentDayIndex : Math.floor(this.clockSeconds / 86400) + 1;
        if (day !== this.currentDayIndex) {
            this.currentDayIndex = day;
            this.dailyCaughtPenalty = 0;
            this.todayAdReward = 0;
            this.daySettled = false;
            this.updateFeedLabel();
        }
        const effectiveWorkEnd = this.getEffectiveWorkEndClockSeconds();
        const secondOfDay = this.workdayEnded && effectiveWorkEnd >= 86400
            ? 86400
            : this.clockSeconds % 86400;
        const hour = Math.floor(secondOfDay / 3600);
        const minute = Math.floor((secondOfDay % 3600) / 60);
        const seconds = secondOfDay % 60;
        if (this.clockLabel) this.clockLabel.string = `第 ${day} 天  ${this.pad(hour)}:${this.pad(minute)}:${this.pad(seconds)}`;
        if (this.workEndLabel) {
            const endHour = Math.floor(effectiveWorkEnd / 3600) % 24;
            const endMinute = Math.floor((effectiveWorkEnd % 3600) / 60);
            const endSecond = effectiveWorkEnd % 60;
            this.workEndLabel.string = `下班时间：${this.pad(endHour)}:${this.pad(endMinute)}:${this.pad(endSecond)}`;
        }
    }

    private updateFeedLabel(): void {
        if (this.feedLabel) this.feedLabel.string = `草料\n${this.feed}`;
        this.updateOffWorkOverlay();
        if (this.feed < 0) this.showGameOverOverlay();
    }

    private setBossStatus(text: string): void {
        if (this.bossStatusLabel) {
            this.bossStatusLabel.string = text;
            this.bossStatusLabel.color = new Color(196, 57, 52, 255);
        }
    }

    private applyHudSafeArea(): void {
        const hudNodes = [
            this.node.getChildByName('PauseButton'),
            this.clockLabel?.node,
            this.workEndLabel?.node,
            this.feedLabel?.node,
            this.bossStatusLabel?.node,
        ].filter((node): node is Node => Boolean(node));
        if (hudNodes.length === 0) return;

        let safeRect;
        try {
            safeRect = sys.getSafeAreaRect(false);
        } catch (error) {
            console.warn('[GameController] safe area is unavailable; using design layout:', error);
            return;
        }

        const visibleSize = view.getVisibleSize();
        // Preview/editor builds can expose the safe rect with a bottom-left
        // origin, while runtime UI positions use a centered origin.
        const zeroBasedRect = safeRect.x >= 0
            && safeRect.y >= 0
            && safeRect.x + safeRect.width <= visibleSize.width + 1
            && safeRect.y + safeRect.height <= visibleSize.height + 1;
        const safeLeft = zeroBasedRect ? safeRect.x - visibleSize.width / 2 : safeRect.x;
        const safeBottom = zeroBasedRect ? safeRect.y - visibleSize.height / 2 : safeRect.y;
        const safeRight = safeLeft + safeRect.width;
        const safeTop = safeBottom + safeRect.height;
        hudNodes.forEach((node) => {
            if (!this.safeAreaBasePositions.has(node)) {
                this.safeAreaBasePositions.set(node, node.position.clone());
            }
            const basePosition = this.safeAreaBasePositions.get(node)!;
            const transform = node.getComponent(UITransform);
            if (!transform) return;

            const right = basePosition.x + transform.width * (1 - transform.anchorPoint.x);
            const top = basePosition.y + transform.height * (1 - transform.anchorPoint.y);
            const bottom = basePosition.y - transform.height * transform.anchorPoint.y;
            const horizontalOverflow = Math.max(0, right - (safeRight - 12));
            const verticalOverflow = Math.max(0, top - (safeTop - 12));
            const bottomOverflow = Math.max(0, safeBottom + 12 - bottom);
            node.setPosition(
                basePosition.x - horizontalOverflow,
                basePosition.y - verticalOverflow + bottomOverflow,
                basePosition.z,
            );
        });
    }

    private getZoneName(location: LocationId): string {
        const names: Record<LocationId, string> = {
            workstation: 'ZoneWorkstation',
            fireStairs: 'ZoneFireStairs',
            restroom: 'ZoneRestroom',
            pantry: 'ZonePantry',
            gate: 'ZoneGate',
        };
        return names[location];
    }

    private getLabel(nodeName: string): Label | null {
        return this.node.getChildByName(nodeName)?.getComponent(Label) || null;
    }

    private pad(value: number): string {
        const text = value.toString();
        return text.length < 2 ? `0${text}` : text;
    }

    private formatDuration(totalSeconds: number): string {
        const seconds = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds % 60)}`;
    }

    onDestroy(): void {
        this.returningToMain = true;
        screen.off('window-resize', this.applyHudSafeArea, this);
        view.off('design-resolution-changed', this.applyHudSafeArea, this);
        this.playerTween?.stop();
        this.bossTween?.stop();
        this.bossAlertTween?.stop();
        const pauseButton = this.node.getChildByName('PauseButton');
        if (pauseButton?.isValid) pauseButton.off(Button.EventType.CLICK, this.pauseGame, this);
        if (this.pausePanel?.isValid) {
            this.pausePanel.getChildByName('ResumeButton')?.off(Button.EventType.CLICK, this.resumeGame, this);
            this.pausePanel.getChildByName('ExitButton')?.off(Button.EventType.CLICK, this.returnToMain, this);
        }
        if (this.offWorkOverlay?.isValid) {
            const panel = this.offWorkOverlay.getChildByName('OffWorkPanel');
            panel?.getChildByName('EndGameButton')?.off(Button.EventType.CLICK, this.showGameOverOverlay, this);
            panel?.getChildByName('NextDayButton')?.off(Button.EventType.CLICK, this.finishDayAndStartNextDay, this);
            panel?.getChildByName('WorkButton')?.off(Button.EventType.CLICK, this.chooseWorkAfterWork, this);
            panel?.getChildByName('EndGameButton')?.off(Node.EventType.TOUCH_END, this.showGameOverOverlay, this);
            panel?.getChildByName('NextDayButton')?.off(Node.EventType.TOUCH_END, this.finishDayAndStartNextDay, this);
            panel?.getChildByName('WorkButton')?.off(Node.EventType.TOUCH_END, this.chooseWorkAfterWork, this);
        }
        if (this.gameOverOverlay?.isValid) {
            const panel = this.gameOverOverlay.getChildByName('GameOverPanel');
            panel?.getChildByName('GameOverHomeButton')?.off(Button.EventType.CLICK, this.returnToMain, this);
            panel?.getChildByName('GameOverRetryButton')?.off(Button.EventType.CLICK, this.restartGame, this);
            panel?.getChildByName('GameOverHomeButton')?.off(Node.EventType.TOUCH_END, this.returnToMain, this);
            panel?.getChildByName('GameOverRetryButton')?.off(Node.EventType.TOUCH_END, this.restartGame, this);
        }
        ['ZoneWorkstation', 'ZoneFireStairs', 'ZoneRestroom', 'ZonePantry', 'ZoneGate'].forEach((name) => {
            const zone = this.node.getChildByName(name);
            if (zone?.isValid) {
                zone.off(Node.EventType.TOUCH_END);
                zone.off(Button.EventType.CLICK);
            }
        });
    }
}

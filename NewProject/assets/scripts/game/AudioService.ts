import {
    _decorator,
    AudioClip,
    AudioSource,
    Component,
    director,
    Node,
    resources,
    sys,
} from 'cc';

const { ccclass } = _decorator;

const MUSIC_VOLUME_KEY = 'fish_music_volume';
const SFX_VOLUME_KEY = 'fish_sfx_volume';

/** Loads the user's audio files and keeps music settings across scenes. */
@ccclass('AudioService')
export default class AudioService extends Component {
    private static current: AudioService | null = null;

    private musicSource!: AudioSource;
    private sfxSource!: AudioSource;
    private musicClip: AudioClip | null = null;
    private sfxClip: AudioClip | null = null;
    private musicVolume = 1;
    private sfxVolume = 1;
    private musicRequested = true;

    static ensure(): AudioService {
        if (AudioService.current?.isValid) return AudioService.current;
        const node = new Node('AudioService');
        const scene = director.getScene();
        if (scene) scene.addChild(node);
        const service = node.addComponent(AudioService);
        return service;
    }

    static get instance(): AudioService | null {
        return AudioService.current;
    }

    onLoad(): void {
        if (AudioService.current && AudioService.current !== this) {
            this.node.destroy();
            return;
        }
        AudioService.current = this;
        director.addPersistRootNode(this.node);
        this.musicVolume = this.readVolume(MUSIC_VOLUME_KEY, 1);
        this.sfxVolume = this.readVolume(SFX_VOLUME_KEY, 1);
        this.musicSource = this.node.addComponent(AudioSource);
        this.sfxSource = this.node.addComponent(AudioSource);
        this.musicSource.loop = true;
        this.loadClips();
    }

    setMusicVolume(value: number): void {
        this.musicVolume = this.clampVolume(value);
        this.musicSource.volume = this.musicVolume;
        sys.localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
        if (this.musicVolume <= 0) this.musicSource.stop();
        else if (this.musicRequested && this.musicClip && !this.musicSource.playing) this.musicSource.play();
    }

    setSfxVolume(value: number): void {
        this.sfxVolume = this.clampVolume(value);
        this.sfxSource.volume = this.sfxVolume;
        sys.localStorage.setItem(SFX_VOLUME_KEY, String(this.sfxVolume));
    }

    getMusicVolume(): number {
        return this.musicVolume;
    }

    getSfxVolume(): number {
        return this.sfxVolume;
    }

    playBgm(): void {
        this.musicRequested = true;
        if (!this.musicClip || this.musicVolume <= 0 || this.musicSource.playing) return;
        this.musicSource.clip = this.musicClip;
        this.musicSource.volume = this.musicVolume;
        this.musicSource.play();
    }

    stopBgm(): void {
        this.musicRequested = false;
        this.musicSource.stop();
    }

    playSfx(): void {
        if (this.sfxClip && this.sfxVolume > 0) this.sfxSource.playOneShot(this.sfxClip, this.sfxVolume);
    }

    private loadClips(): void {
        resources.load('audio/BGM', AudioClip, (error, clip) => {
            if (error || !clip) return;
            this.musicClip = clip;
            this.playBgm();
        });
        resources.load('audio/YX', AudioClip, (error, clip) => {
            if (!error && clip) this.sfxClip = clip;
        });
    }

    private readVolume(key: string, fallback: number): number {
        const raw = sys.localStorage.getItem(key);
        if (raw === null || raw.trim() === '') return fallback;
        const value = Number(raw);
        return Number.isFinite(value) ? this.clampVolume(value) : fallback;
    }

    private clampVolume(value: number): number {
        return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    }
}

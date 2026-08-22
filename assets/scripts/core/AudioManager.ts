import { AudioClip, AudioSource, Node } from 'cc';
import { GameConfig } from '../app/GameConfig';
import { ResourceManager } from './ResourceManager';

export class AudioManager {
    private static readonly singleton = new AudioManager();
    private musicSource: AudioSource | null = null;
    private effectSource: AudioSource | null = null;

    public static get instance(): AudioManager {
        return this.singleton;
    }

    public initialize(parent: Node): void {
        if (this.musicSource && this.effectSource) return;

        const audioNode = new Node('AudioManager');
        const musicNode = new Node('Music');
        const effectNode = new Node('Effects');
        parent.addChild(audioNode);
        audioNode.addChild(musicNode);
        audioNode.addChild(effectNode);
        this.musicSource = musicNode.addComponent(AudioSource);
        this.effectSource = effectNode.addComponent(AudioSource);
        this.musicSource.loop = true;
        this.musicSource.volume = GameConfig.defaultMusicVolume;
        this.effectSource.volume = GameConfig.defaultEffectVolume;
    }

    public async playMusic(path: string): Promise<void> {
        if (!this.musicSource) throw new Error('AudioManager is not initialized');
        const clip = await ResourceManager.instance.load(path, AudioClip);
        this.musicSource.clip = clip;
        this.musicSource.play();
    }

    public async playEffect(path: string): Promise<void> {
        if (!this.effectSource) throw new Error('AudioManager is not initialized');
        const clip = await ResourceManager.instance.load(path, AudioClip);
        this.effectSource.playOneShot(clip);
    }

    public stopMusic(): void {
        this.musicSource?.stop();
    }

    public setMusicVolume(volume: number): void {
        if (this.musicSource) this.musicSource.volume = Math.min(1, Math.max(0, volume));
    }

    public setEffectVolume(volume: number): void {
        if (this.effectSource) this.effectSource.volume = Math.min(1, Math.max(0, volume));
    }
}

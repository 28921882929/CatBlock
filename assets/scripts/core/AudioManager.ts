import { AudioClip, AudioSource, Node } from 'cc';
import { GameConfig } from '../app/GameConfig';
import { ResourceManager } from './ResourceManager';

/**
 * 全局音频管理器。
 *
 * 音乐与音效使用独立的 `AudioSource`，避免播放音效时打断背景音乐。
 * 音频路径均相对于 `assets/resources`。
 */
export class AudioManager {
    private static readonly singleton = new AudioManager();
    private musicSource: AudioSource | null = null;
    private effectSource: AudioSource | null = null;

    public static get instance(): AudioManager {
        return this.singleton;
    }

    /**
     * 在持久化根节点下创建音频节点。
     * 重复调用不会重复创建组件。
     */
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

    /** 加载并循环播放背景音乐。 */
    public async playMusic(path: string): Promise<void> {
        if (!this.musicSource) throw new Error('AudioManager is not initialized');
        const clip = await ResourceManager.instance.load(path, AudioClip);
        this.musicSource.clip = clip;
        this.musicSource.play();
    }

    /** 加载并单次播放音效，不会中断当前背景音乐。 */
    public async playEffect(path: string): Promise<void> {
        if (!this.effectSource) throw new Error('AudioManager is not initialized');
        const clip = await ResourceManager.instance.load(path, AudioClip);
        this.effectSource.playOneShot(clip);
    }

    /** 停止当前背景音乐。 */
    public stopMusic(): void {
        this.musicSource?.stop();
    }

    /** 设置音乐音量，传入值会被限制在 0～1。 */
    public setMusicVolume(volume: number): void {
        if (this.musicSource) this.musicSource.volume = Math.min(1, Math.max(0, volume));
    }

    /** 设置音效音量，传入值会被限制在 0～1。 */
    public setEffectVolume(volume: number): void {
        if (this.effectSource) this.effectSource.volume = Math.min(1, Math.max(0, volume));
    }
}

import { MUSIC_TRACKS, SFX_FILES, type MusicTrackId, type SfxId } from "../../data/audio";
import { useSettingsStore, type Settings } from "../../store/settingsStore";
import { playSynthSfx } from "./sfx";

/**
 * Framework-agnostic audio: one WebAudio graph with master / music / sfx
 * buses. Music tracks crossfade; missing files fail silently (the game ships
 * without music for now — drop files into public/audio/music to enable).
 *
 * Gameplay never touches files: it calls `playTheme("tavern_theme")` or
 * `sfx("chop")`, and the data tables decide what that sounds like.
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  /** One looping element per theme, kept alive so a theme resumes where it
   * left off when you come back (town -> tavern -> town doesn't restart). */
  private tracks = new Map<MusicTrackId, { el: HTMLAudioElement; gain: GainNode; stopTimer: number | null }>();
  private currentId: MusicTrackId | null = null;
  private wantedTheme: MusicTrackId | null = null;
  private missing = new Set<string>();
  private sfxBuffers = new Map<string, AudioBuffer | null>();
  private lastPlayed = new Map<SfxId, number>();

  constructor() {
    useSettingsStore.subscribe((s) => this.applyVolumes(s));
    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      this.ensureContext();
      // resume() is async: only retry the wanted theme once it's running.
      void this.ctx?.resume().then(() => {
        if (this.wantedTheme && !this.currentId) this.playTheme(this.wantedTheme);
      });
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    // Whenever the browser lets audio run (first real gesture), start the
    // theme that was asked for while we were still blocked.
    this.ctx.addEventListener("statechange", () => {
      if (this.ctx?.state === "running" && this.wantedTheme && !this.currentId) this.playTheme(this.wantedTheme);
    });
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes(useSettingsStore.getState());
    return this.ctx;
  }

  private applyVolumes(s: Settings) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.masterVolume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume, t, 0.05);
  }

  /** Switches the background theme with a crossfade. Asking for the theme
   * that's already playing does nothing, so walking between areas that share
   * a theme never interrupts it. */
  playTheme(id: MusicTrackId, fadeSec = 2): void {
    this.wantedTheme = id;
    if (this.currentId === id) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== "running") return; // retried on first gesture

    if (this.currentId) this.fadeOut(this.currentId, fadeSec);
    this.currentId = id;
    const track = this.track(id);
    if (!track) return;
    if (track.stopTimer !== null) {
      clearTimeout(track.stopTimer);
      track.stopTimer = null;
    }
    const t = ctx.currentTime;
    track.gain.gain.cancelScheduledValues(t);
    track.gain.gain.setValueAtTime(track.gain.gain.value, t);
    track.gain.gain.linearRampToValueAtTime(MUSIC_TRACKS[id].volume, t + fadeSec);
    track.el.play().catch(() => {
      /* autoplay blocked or file unreadable: stays silent */
    });
  }

  get currentTheme(): MusicTrackId | null {
    return this.currentId;
  }

  stopMusic(fadeSec = 1): void {
    this.wantedTheme = null;
    if (this.currentId) this.fadeOut(this.currentId, fadeSec);
    this.currentId = null;
  }

  private track(id: MusicTrackId) {
    const existing = this.tracks.get(id);
    if (existing) return existing;
    const url = MUSIC_TRACKS[id].url;
    if (!url || !this.ctx || this.missing.has(url)) return null;
    const el = new Audio(url);
    el.loop = true;
    el.preload = "auto";
    const source = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.musicBus);
    el.addEventListener("error", () => {
      this.missing.add(url);
      this.tracks.delete(id);
    });
    const t = { el, gain, stopTimer: null as number | null };
    this.tracks.set(id, t);
    return t;
  }

  private fadeOut(id: MusicTrackId, fadeSec: number) {
    const track = this.tracks.get(id);
    if (!track || !this.ctx) return;
    const t = this.ctx.currentTime;
    track.gain.gain.cancelScheduledValues(t);
    track.gain.gain.setValueAtTime(track.gain.gain.value, t);
    track.gain.gain.linearRampToValueAtTime(0, t + fadeSec);
    if (track.stopTimer !== null) clearTimeout(track.stopTimer);
    track.stopTimer = window.setTimeout(() => {
      track.el.pause();
      track.stopTimer = null;
    }, fadeSec * 1000 + 80);
  }

  /** Plays a sound effect; rate-limited per id so a flurry of hits doesn't
   * turn into noise. */
  sfx(id: SfxId, opts: { volume?: number; pitch?: number } = {}): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== "running") return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(id) ?? 0) < 45) return;
    this.lastPlayed.set(id, now);

    const file = SFX_FILES[id];
    if (file) {
      const buf = this.sfxBuffers.get(file);
      if (buf) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = opts.pitch ?? 1;
        const g = ctx.createGain();
        g.gain.value = opts.volume ?? 1;
        src.connect(g).connect(this.sfxBus);
        src.start();
        return;
      }
      if (!this.sfxBuffers.has(file)) {
        this.sfxBuffers.set(file, null);
        fetch(`/audio/sfx/${file}`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
          .then((ab) => ctx.decodeAudioData(ab))
          .then((b) => this.sfxBuffers.set(file, b))
          .catch(() => {});
      }
    }
    playSynthSfx(ctx, this.sfxBus, id, opts);
  }
}

export const audio = new AudioManager();

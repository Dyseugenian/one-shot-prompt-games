(() => {
  "use strict";

  const W = 1280;
  const H = 720;
  const LANES = 5;
  const FAR_Z = 78;
  const CAMERA = 7.4;
  const HORIZON = 158;
  const GROUND_Y = 648;
  const LANE_SPACE = 1.16;
  const X_SCALE = 171;
  const GRAVITY = 14.8;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const dom = {
    hud: document.getElementById("hud"),
    menu: document.getElementById("menuScreen"),
    pause: document.getElementById("pauseScreen"),
    gameOver: document.getElementById("gameOverScreen"),
    toast: document.getElementById("toast"),
    chargeFill: document.getElementById("chargeFill"),
    integrity: document.getElementById("integrityPips"),
    statusBanner: document.getElementById("statusBanner"),
    score: document.getElementById("scoreText"),
    combo: document.getElementById("comboText"),
    shards: document.getElementById("shardsText"),
    speed: document.getElementById("speedText"),
    threat: document.getElementById("threatText"),
    finalScore: document.getElementById("finalScore"),
    bestScore: document.getElementById("bestScore"),
    finalDistance: document.getElementById("finalDistance"),
    finalCombo: document.getElementById("finalCombo"),
    startBtn: document.getElementById("startBtn"),
    muteBtn: document.getElementById("muteBtn"),
    resumeBtn: document.getElementById("resumeBtn"),
    restartBtn: document.getElementById("restartBtn"),
    restartPauseBtn: document.getElementById("restartPauseBtn"),
    menuBtn: document.getElementById("menuBtn"),
    menuPauseBtn: document.getElementById("menuPauseBtn")
  };
  const integrityPipNodes = [];

  const palette = {
    teal: "#4df0d8",
    tealDim: "rgba(77, 240, 216, 0.28)",
    coral: "#ff6d7a",
    amber: "#f7c969",
    lime: "#b9ff76",
    violet: "#9b7cff",
    ink: "#05070b",
    slate: "#10202a"
  };

  const game = {
    state: "menu",
    time: 0,
    globalTime: 0,
    distance: 0,
    score: 0,
    best: readBest(),
    shards: 0,
    combo: 0,
    maxCombo: 0,
    speed: 0,
    difficulty: 1,
    integrity: 3,
    countdown: 0,
    spawnTimer: 0,
    hudTimer: 0,
    shake: 0,
    flash: 0,
    toastTimer: 0,
    menuRoad: 0,
    objects: [],
    particles: [],
    rings: []
  };

  const player = {
    lane: 2,
    targetLane: 2,
    x: laneWorld(2),
    y: 0,
    vy: 0,
    grounded: true,
    dash: 0,
    invuln: 0,
    charge: 72,
    lean: 0,
    streak: 0
  };

  const background = makeBackground();
  let dpr = 1;
  let lastFrame = performance.now();
  let toastHandle = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
  }

  function formatNumber(value) {
    return Math.floor(value).toLocaleString("en-US");
  }

  function readBest() {
    try {
      return Number(localStorage.getItem("echoVaultBest") || 0);
    } catch (error) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem("echoVaultBest", String(Math.floor(value)));
    } catch (error) {
      // Storage may be blocked in private browser modes. The run still works.
    }
  }

  function laneWorld(lane) {
    return (lane - (LANES - 1) / 2) * LANE_SPACE;
  }

  function project(worldX, worldY, z) {
    const scale = CAMERA / (CAMERA + Math.max(0.08, z));
    return {
      x: W * 0.5 + worldX * X_SCALE * scale,
      y: HORIZON + (GROUND_Y - HORIZON) * scale - worldY * 292 * scale,
      s: scale
    };
  }

  function resizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function makeBackground() {
    const stars = [];
    const towers = [];
    const glyphs = [];

    for (let i = 0; i < 95; i += 1) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * 300,
        size: rand(0.7, 2.4),
        speed: rand(3, 18),
        hue: pick(["77, 240, 216", "247, 201, 105", "255, 109, 122", "185, 255, 118"])
      });
    }

    for (let i = 0; i < 38; i += 1) {
      towers.push({
        x: rand(-80, W + 80),
        width: rand(12, 48),
        height: rand(50, 190),
        tone: Math.random()
      });
    }

    for (let i = 0; i < 34; i += 1) {
      glyphs.push({
        lane: rand(-3.7, 3.7),
        z: rand(8, FAR_Z),
        y: rand(2.2, 5.2),
        rot: rand(0, Math.PI),
        speed: rand(0.08, 0.35),
        color: pick([palette.teal, palette.amber, palette.coral, palette.lime])
      });
    }

    return { stars, towers, glyphs };
  }

  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    delay: null,
    noiseBuffer: null,
    enabled: true,
    unlocked: false,
    nextStepTime: 0,
    step: 0,
    lastBpm: 92,

    init() {
      if (this.ctx) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        this.enabled = false;
        updateMuteLabel();
        return;
      }

      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.86 : 0;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.68;
      this.sfxGain.connect(this.master);

      this.delay = this.ctx.createDelay(0.45);
      const feedback = this.ctx.createGain();
      const delayFilter = this.ctx.createBiquadFilter();
      this.delay.delayTime.value = 0.18;
      feedback.gain.value = 0.24;
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 2400;
      this.delay.connect(delayFilter);
      delayFilter.connect(feedback);
      feedback.connect(this.delay);
      delayFilter.connect(this.musicGain);

      this.noiseBuffer = this.createNoiseBuffer();
    },

    createNoiseBuffer() {
      const length = Math.floor((this.ctx ? this.ctx.sampleRate : 44100) * 1.1);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    },

    resume() {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.unlocked = true;
    },

    startMusic() {
      if (!this.ctx || !this.enabled) return;
      this.nextStepTime = this.ctx.currentTime + 0.04;
      this.step = 0;
    },

    toggle() {
      this.enabled = !this.enabled;
      this.init();
      if (this.master) {
        this.master.gain.setTargetAtTime(this.enabled ? 0.86 : 0, this.ctx.currentTime, 0.03);
      }
      updateMuteLabel();
    },

    update() {
      if (!this.ctx || !this.enabled || !this.unlocked) return;
      if (game.state !== "playing" && game.state !== "countdown") return;
      const now = this.ctx.currentTime;
      const bpm = clamp(90 + game.difficulty * 15 + game.speed * 0.55, 92, 176);
      this.lastBpm = bpm;
      const stepDuration = 60 / bpm / 2;

      while (this.nextStepTime < now + 0.15) {
        this.scheduleStep(this.nextStepTime, this.step, game.difficulty);
        this.nextStepTime += stepDuration;
        this.step += 1;
      }
    },

    scheduleStep(time, step, difficulty) {
      const root = 55;
      const bassPattern = [0, 0, 7, 0, 3, 0, 10, 7];
      const leadPattern = [12, 15, 19, 22, 19, 15, 24, 22, 27, 24, 19, 17, 15, 17, 19, 22];
      const chordColor = [0, 7, 10, 15];
      const bassNote = bassPattern[step % bassPattern.length];
      const leadNote = leadPattern[(step + Math.floor(difficulty)) % leadPattern.length];

      if (step % 4 === 0) {
        this.tone(root * semitone(bassNote), time, 0.22, "triangle", 0.16, this.musicGain, root * semitone(bassNote - 12));
        this.kick(time, 0.34);
      }

      if (step % 2 === 0) {
        const freq = root * semitone(leadNote);
        this.tone(freq, time + 0.01, 0.1, "square", 0.035 + difficulty * 0.003, this.delay, freq * 1.005);
      }

      if (difficulty > 1.9 && step % 4 === 2) {
        const freq = root * semitone(pick(chordColor) + 24);
        this.tone(freq, time, 0.06, "sawtooth", 0.022, this.delay, freq * 0.5);
      }

      if (step % 2 === 1) this.hat(time, 0.045 + difficulty * 0.004);
      if (difficulty > 3.2 && step % 4 === 3) this.hat(time + 0.08, 0.035);
    },

    tone(freq, time, duration, type, gainValue, destination, endFreq) {
      if (!this.ctx || !this.enabled) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400 + game.difficulty * 360, time);
      filter.Q.value = 1.6;

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), time);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + duration);
      }

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destination || this.sfxGain);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    },

    noise(time, duration, gainValue, filterType, frequency, destination) {
      if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      source.buffer = this.noiseBuffer;
      filter.type = filterType || "bandpass";
      filter.frequency.value = frequency || 1200;
      filter.Q.value = 2.2;
      gain.gain.setValueAtTime(Math.max(0.0001, gainValue), time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination || this.sfxGain);
      source.start(time);
      source.stop(time + duration + 0.02);
    },

    kick(time, gainValue) {
      this.tone(92, time, 0.18, "sine", gainValue || 0.25, this.musicGain, 39);
    },

    hat(time, gainValue) {
      this.noise(time, 0.045, gainValue || 0.05, "highpass", 6500, this.musicGain);
    },

    sfx(name) {
      this.resume();
      if (!this.ctx || !this.enabled) return;
      const now = this.ctx.currentTime + 0.004;

      if (name === "lane") {
        this.tone(510, now, 0.055, "triangle", 0.08, this.sfxGain, 310);
      } else if (name === "jump") {
        this.tone(210, now, 0.16, "sine", 0.11, this.sfxGain, 540);
        this.noise(now, 0.08, 0.035, "highpass", 2600, this.sfxGain);
      } else if (name === "dash") {
        this.noise(now, 0.28, 0.16, "bandpass", 820, this.sfxGain);
        this.tone(120, now, 0.24, "sawtooth", 0.13, this.sfxGain, 620);
      } else if (name === "collect") {
        this.tone(740, now, 0.075, "sine", 0.055, this.sfxGain, 980);
        this.tone(1110, now + 0.045, 0.075, "triangle", 0.045, this.sfxGain, 1480);
      } else if (name === "power") {
        this.tone(420, now, 0.12, "triangle", 0.09, this.sfxGain, 840);
        this.tone(840, now + 0.09, 0.16, "sine", 0.08, this.sfxGain, 1260);
      } else if (name === "hit") {
        this.noise(now, 0.22, 0.22, "lowpass", 900, this.sfxGain);
        this.tone(110, now, 0.28, "sawtooth", 0.17, this.sfxGain, 42);
      } else if (name === "start") {
        this.tone(196, now, 0.12, "triangle", 0.08, this.sfxGain, 294);
        this.tone(392, now + 0.11, 0.12, "triangle", 0.08, this.sfxGain, 588);
        this.tone(784, now + 0.22, 0.2, "square", 0.06, this.sfxGain, 784);
      } else if (name === "pause") {
        this.tone(420, now, 0.12, "triangle", 0.06, this.sfxGain, 220);
      } else if (name === "gameover") {
        this.tone(330, now, 0.26, "sawtooth", 0.08, this.sfxGain, 220);
        this.tone(180, now + 0.18, 0.34, "triangle", 0.09, this.sfxGain, 64);
      }
    }
  };

  function semitone(steps) {
    return Math.pow(2, steps / 12);
  }

  function updateMuteLabel() {
    dom.muteBtn.textContent = audio.enabled ? "Sound On" : "Sound Off";
  }

  function resetRun() {
    game.time = 0;
    game.distance = 0;
    game.score = 0;
    game.shards = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.speed = 21;
    game.difficulty = 1;
    game.integrity = 3;
    game.countdown = 2.55;
    game.spawnTimer = 0.62;
    game.hudTimer = 0;
    game.shake = 0;
    game.flash = 0;
    game.objects.length = 0;
    game.particles.length = 0;
    game.rings.length = 0;

    player.lane = 2;
    player.targetLane = 2;
    player.x = laneWorld(2);
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
    player.dash = 0;
    player.invuln = 0;
    player.charge = 72;
    player.lean = 0;
    player.streak = 0;

    for (let i = 0; i < 8; i += 1) {
      makeObject("shard", 2, 24 + i * 4.2, { y: 0.85 + Math.sin(i) * 0.18 });
    }
    for (let i = 0; i < 2; i += 1) {
      makeObject("power", i === 0 ? 1 : 3, 56 + i * 14, { y: 1.05 });
    }

    updateHud(true);
  }

  function startRun() {
    audio.resume();
    resetRun();
    audio.startMusic();
    audio.sfx("start");
    setScreen("countdown");
  }

  function setScreen(state) {
    game.state = state;
    dom.menu.classList.toggle("hidden", state !== "menu");
    dom.pause.classList.toggle("hidden", state !== "paused");
    dom.gameOver.classList.toggle("hidden", state !== "gameover");
    dom.hud.classList.toggle("hidden", state === "menu" || state === "gameover");
    if (state === "menu") {
      dom.statusBanner.textContent = "";
      game.objects.length = 0;
      game.particles.length = 0;
    }
    if (state === "playing") dom.statusBanner.textContent = "";
  }

  function pauseRun() {
    if (game.state !== "playing" && game.state !== "countdown") return;
    audio.sfx("pause");
    setScreen("paused");
  }

  function resumeRun() {
    if (game.state !== "paused") return;
    audio.resume();
    audio.startMusic();
    setScreen("playing");
  }

  function endRun() {
    game.integrity = 0;
    game.flash = 0.42;
    game.shake = 0.8;
    audio.sfx("gameover");
    if (game.score > game.best) {
      game.best = game.score;
      writeBest(game.best);
    }

    dom.finalScore.textContent = formatNumber(game.score);
    dom.bestScore.textContent = formatNumber(game.best);
    dom.finalDistance.textContent = `${Math.floor(game.distance)}m`;
    dom.finalCombo.textContent = `x${Math.max(1, game.maxCombo)}`;
    setScreen("gameover");
  }

  function showToast(message) {
    clearTimeout(toastHandle);
    dom.toast.textContent = message;
    dom.toast.classList.remove("hidden");
    toastHandle = window.setTimeout(() => dom.toast.classList.add("hidden"), 950);
  }

  function moveLane(direction) {
    if (game.state !== "playing") return;
    const next = clamp(player.targetLane + direction, 0, LANES - 1);
    if (next === player.targetLane) return;
    player.targetLane = next;
    player.lane = next;
    player.lean = clamp(direction * 1.35, -1.35, 1.35);
    audio.sfx("lane");
    spawnBurst(player.x, 0.12, 0.8, 8, palette.teal, 0.7);
  }

  function jump() {
    if (game.state !== "playing" || !player.grounded) return;
    player.vy = 5.9;
    player.grounded = false;
    audio.sfx("jump");
    spawnBurst(player.x, 0.05, 0.2, 16, palette.amber, 0.9);
  }

  function dash() {
    if (game.state !== "playing") return;
    if (player.charge < 34 || player.dash > 0) {
      showToast("Phase charge low");
      return;
    }
    player.charge -= 34;
    player.dash = 0.48;
    player.invuln = Math.max(player.invuln, 0.58);
    player.streak = 0.48;
    game.shake = Math.max(game.shake, 0.12);
    audio.sfx("dash");
    spawnBurst(player.x, 0.72, 0.2, 34, palette.coral, 1.5);
  }

  function makeObject(type, lane, z, extra = {}) {
    const object = {
      type,
      lane,
      z,
      x: laneWorld(lane),
      y: extra.y || 0,
      spin: rand(0, Math.PI * 2),
      length: extra.length || 3.4,
      color: extra.color || palette.teal,
      hit: false,
      scored: false,
      wobble: rand(0, Math.PI * 2)
    };

    if (type === "shard") {
      object.y = extra.y == null ? 0.9 : extra.y;
      object.color = pick([palette.teal, palette.amber, palette.lime]);
    } else if (type === "barrier") {
      object.y = 0;
      object.color = pick([palette.coral, palette.amber]);
    } else if (type === "drone") {
      object.y = extra.y == null ? 1.14 : extra.y;
      object.color = pick([palette.violet, palette.coral, palette.teal]);
    } else if (type === "power") {
      object.y = extra.y == null ? 1.05 : extra.y;
      object.color = palette.lime;
    } else if (type === "gap") {
      object.length = extra.length || 4.1;
      object.color = palette.coral;
    }

    game.objects.push(object);
    return object;
  }

  function spawnPattern() {
    const z = FAR_Z + rand(2, 8);
    const roll = Math.random();
    const safe = randInt(0, LANES - 1);
    const lanes = [0, 1, 2, 3, 4];

    if (roll < 0.22) {
      const startLane = randInt(0, LANES - 1);
      const drift = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 7; i += 1) {
        const lane = clamp(startLane + Math.floor(i / 3) * drift, 0, LANES - 1);
        makeObject("shard", lane, z + i * 2.1, { y: 0.82 + Math.sin(i * 0.8) * 0.26 });
      }
      return;
    }

    if (roll < 0.42) {
      let blocked = shuffle(lanes.filter((lane) => lane !== safe)).slice(0, game.difficulty > 2.4 ? 3 : 2);
      if (Math.random() < 0.35 && game.difficulty > 3) blocked = lanes.filter((lane) => lane !== safe);
      blocked.forEach((lane) => makeObject("barrier", lane, z, {}));
      for (let i = 0; i < 5; i += 1) makeObject("shard", safe, z + 1.7 + i * 2, { y: 0.95 });
      return;
    }

    if (roll < 0.61) {
      const gapCount = clamp(2 + Math.floor(game.difficulty * 0.55), 2, 4);
      shuffle(lanes.filter((lane) => lane !== safe))
        .slice(0, gapCount)
        .forEach((lane) => makeObject("gap", lane, z, { length: rand(3.5, 4.8) }));
      for (let i = 0; i < 4; i += 1) makeObject("shard", safe, z + i * 2.25, { y: 1.24 });
      return;
    }

    if (roll < 0.78) {
      shuffle(lanes)
        .slice(0, game.difficulty > 2.8 ? 3 : 2)
        .forEach((lane, index) => makeObject("drone", lane, z + index * 1.7, { y: 1.02 + index * 0.12 }));
      const rewardLane = clamp(safe + pick([-1, 0, 1]), 0, LANES - 1);
      for (let i = 0; i < 4; i += 1) makeObject("shard", rewardLane, z + 3 + i * 2.1, { y: 0.85 });
      return;
    }

    if (roll < 0.92) {
      const safeA = safe;
      const safeB = clamp(safe + pick([-2, -1, 1, 2]), 0, LANES - 1);
      lanes.filter((lane) => lane !== safeA).slice(0, 3).forEach((lane) => makeObject("barrier", lane, z, {}));
      lanes.filter((lane) => lane !== safeB).slice(0, 3).forEach((lane) => makeObject("gap", lane, z + 5.2, { length: 3.6 }));
      makeObject("shard", safeA, z + 1.3, { y: 1.0 });
      makeObject("shard", safeB, z + 6.8, { y: 1.25 });
      return;
    }

    makeObject("power", safe, z + 1.5, { y: 1.08 });
    lanes.filter((lane) => lane !== safe).forEach((lane, index) => {
      if (index % 2 === 0) makeObject("drone", lane, z + rand(0, 3.4), {});
      else makeObject("barrier", lane, z + rand(0, 3.4), {});
    });
  }

  function spawnBurst(x, y, z, count, color, power) {
    for (let i = 0; i < count; i += 1) {
      if (game.particles.length > 260) game.particles.shift();
      game.particles.push({
        x,
        y,
        z,
        vx: rand(-1, 1) * power,
        vy: rand(0.2, 1.5) * power,
        vz: rand(-4, 5) * power,
        life: rand(0.34, 0.85),
        maxLife: 0,
        size: rand(2, 7) * (0.8 + power * 0.2),
        color
      });
      game.particles[game.particles.length - 1].maxLife = game.particles[game.particles.length - 1].life;
    }
  }

  function takeDamage(reason) {
    if (player.invuln > 0 || game.state !== "playing") return;
    game.integrity -= 1;
    game.combo = 0;
    player.invuln = 1.25;
    player.charge = clamp(player.charge + 12, 0, 100);
    game.flash = 0.34;
    game.shake = Math.max(game.shake, 0.62);
    audio.sfx("hit");
    spawnBurst(player.x, 0.85, 0.6, 42, palette.coral, 1.8);
    showToast(reason);
    updateHud(true);

    if (game.integrity <= 0) endRun();
  }

  function collectShard(object) {
    if (object.hit) return;
    object.hit = true;
    game.shards += 1;
    game.combo += 1;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.score += 38 + game.combo * 7;
    player.charge = clamp(player.charge + 7.5, 0, 100);
    audio.sfx("collect");
    spawnBurst(object.x, object.y, object.z, 12, object.color, 0.85);
  }

  function collectPower(object) {
    if (object.hit) return;
    object.hit = true;
    game.score += 220 + game.combo * 10;
    game.combo += 3;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    player.charge = 100;
    player.invuln = Math.max(player.invuln, 1.4);
    audio.sfx("power");
    spawnBurst(object.x, object.y, object.z, 30, palette.lime, 1.3);
    showToast("Phase core restored");
  }

  function breakHazard(object) {
    if (object.hit) return;
    object.hit = true;
    game.score += 120 + game.combo * 8;
    game.combo += 2;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    spawnBurst(object.x, Math.max(0.7, object.y + 0.35), object.z, 30, object.color, 1.5);
  }

  function scoreAvoid(object) {
    if (object.scored || object.hit) return;
    object.scored = true;
    game.combo += 1;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.score += 24 + Math.min(260, game.combo * 5);
    if (Math.abs(object.x - player.x) < 0.74 && player.invuln <= 0) {
      game.score += 40;
      player.charge = clamp(player.charge + 4, 0, 100);
      spawnBurst(player.x, 0.45, 0.4, 6, palette.amber, 0.7);
    }
  }

  function updateRun(dt) {
    if (game.state === "countdown") {
      game.countdown -= dt;
      game.menuRoad += dt * 18;
      player.charge = clamp(player.charge + dt * 6, 0, 100);
      if (game.countdown <= 0) {
        setScreen("playing");
        dom.statusBanner.textContent = "RUN";
        window.setTimeout(() => {
          if (game.state === "playing") dom.statusBanner.textContent = "";
        }, 350);
      } else {
        const step = Math.ceil(game.countdown);
        dom.statusBanner.textContent = step > 0 ? String(step) : "RUN";
      }
      updatePlayer(dt);
      updateParticles(dt);
      return;
    }

    if (game.state !== "playing") {
      game.menuRoad += dt * 15;
      updateParticles(dt * 0.6);
      return;
    }

    game.time += dt;
    game.difficulty = clamp(1 + game.time / 24 + game.shards / 72, 1, 6.2);
    game.speed = 20 + game.difficulty * 4.15 + Math.min(8, game.time * 0.035);
    const dashSpeed = player.dash > 0 ? 5.4 : 0;
    const travel = (game.speed + dashSpeed) * dt;
    game.distance += travel;
    game.score += travel * (1.4 + Math.min(4.4, game.combo * 0.055));
    player.charge = clamp(player.charge + dt * (3.7 + game.difficulty * 0.34), 0, 100);

    updatePlayer(dt);
    updateObjects(dt, game.speed + dashSpeed);
    updateParticles(dt);
    updateBackgroundGlyphs(dt);

    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnPattern();
      game.spawnTimer = clamp(rand(0.74, 1.2) - game.difficulty * 0.055, 0.48, 1.12);
    }
  }

  function updatePlayer(dt) {
    const targetX = laneWorld(player.targetLane);
    player.x = lerp(player.x, targetX, 1 - Math.pow(0.0008, dt));
    player.lean = lerp(player.lean, 0, 1 - Math.pow(0.008, dt));

    if (!player.grounded) {
      player.vy -= GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        player.grounded = true;
        spawnBurst(player.x, 0.04, 0.25, 12, palette.teal, 0.65);
      }
    }

    if (player.dash > 0) {
      player.dash = Math.max(0, player.dash - dt);
      if (Math.random() < 0.8) spawnBurst(player.x, 0.55 + Math.random() * 0.5, 0.4, 2, palette.coral, 0.6);
    }
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    if (player.streak > 0) player.streak = Math.max(0, player.streak - dt);
  }

  function updateObjects(dt, speed) {
    const playerX = player.x;

    for (let i = game.objects.length - 1; i >= 0; i -= 1) {
      const object = game.objects[i];
      object.z -= speed * dt;
      object.spin += dt * (object.type === "shard" ? 4.2 : 1.6);
      object.wobble += dt * 2.2;

      const laneHit = Math.abs(object.x - playerX) < 0.58;

      if (!object.hit && (object.type === "shard" || object.type === "power")) {
        const collectRange = object.type === "power" ? 1.2 : 1.0;
        const verticalRange = object.type === "power" ? 1.1 : 0.86;
        if (laneHit && object.z < collectRange && object.z > -1.2 && Math.abs((player.y + 0.62) - object.y) < verticalRange) {
          if (object.type === "shard") collectShard(object);
          else collectPower(object);
        }
      }

      if (!object.hit && object.type === "barrier" && laneHit && object.z < 0.9 && object.z > -0.9) {
        if (player.dash > 0) breakHazard(object);
        else {
          object.hit = true;
          takeDamage("Barrier impact");
        }
      }

      if (!object.hit && object.type === "drone" && laneHit && object.z < 1.05 && object.z > -1.05) {
        if (player.dash > 0) breakHazard(object);
        else if (player.y > 1.55) scoreAvoid(object);
        else {
          object.hit = true;
          takeDamage("Sentinel contact");
        }
      }

      if (!object.hit && object.type === "gap" && laneHit && Math.abs(object.z) < object.length * 0.48) {
        if (player.y < 0.55 && player.dash <= 0) {
          object.hit = true;
          takeDamage("Memory rift");
        } else if (player.y >= 0.55) {
          scoreAvoid(object);
        }
      }

      if ((object.type === "barrier" || object.type === "drone" || object.type === "gap") && object.z < -1.7) {
        scoreAvoid(object);
      }

      if (object.z < -8 || (object.hit && object.z < -1.5)) {
        game.objects.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i -= 1) {
      const p = game.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 2.4 * dt;
      if (p.life <= 0 || p.z < -5 || p.z > FAR_Z + 12) {
        game.particles.splice(i, 1);
      }
    }

    for (let i = game.rings.length - 1; i >= 0; i -= 1) {
      const ring = game.rings[i];
      ring.life -= dt;
      ring.radius += ring.speed * dt;
      if (ring.life <= 0) game.rings.splice(i, 1);
    }
  }

  function updateBackgroundGlyphs(dt) {
    for (const glyph of background.glyphs) {
      glyph.z -= dt * (2 + game.difficulty * 0.45);
      glyph.rot += dt * glyph.speed;
      if (glyph.z < 2) {
        glyph.z = FAR_Z + rand(5, 24);
        glyph.lane = rand(-3.8, 3.8);
        glyph.y = rand(2.2, 5.4);
      }
    }
  }

  function updateHud(force) {
    if (!force && game.hudTimer > 0) return;
    game.hudTimer = 0.08;
    dom.score.textContent = formatNumber(game.score);
    dom.combo.textContent = `x${Math.max(1, game.combo)}`;
    dom.shards.textContent = String(game.shards);
    dom.speed.textContent = `${game.speed.toFixed(1)}`;
    dom.threat.textContent = `${game.difficulty.toFixed(1)}x`;
    dom.chargeFill.style.width = `${Math.round(player.charge)}%`;

    if (integrityPipNodes.length === 0) {
      for (let i = 0; i < 3; i += 1) {
        const pip = document.createElement("i");
        pip.className = "pip";
        integrityPipNodes.push(pip);
        dom.integrity.appendChild(pip);
      }
    }
    for (let i = 0; i < 3; i += 1) {
      integrityPipNodes[i].className = `pip${i >= game.integrity ? " off" : ""}`;
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (game.shake > 0) {
      const shake = game.shake * 9;
      ctx.translate(rand(-shake, shake), rand(-shake, shake));
    }

    drawBackground();
    drawTrack();
    drawWorldGlyphs();

    game.objects.sort((a, b) => b.z - a.z);
    for (const object of game.objects) {
      if (object.z > -6 && object.z < FAR_Z + 12) drawObject(object);
    }

    drawParticles();
    drawPlayer();
    drawRings();
    ctx.restore();

    if (game.flash > 0) {
      ctx.fillStyle = `rgba(255, 109, 122, ${game.flash * 0.42})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBackground() {
    const t = game.globalTime;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#03040a");
    sky.addColorStop(0.34, "#07121a");
    sky.addColorStop(0.56, "#10181d");
    sky.addColorStop(1, "#05070b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 0.5 + Math.sin(t * 0.9) * 0.14;
    const ring = ctx.createRadialGradient(W * 0.5, 140, 24, W * 0.5, 140, 205);
    ring.addColorStop(0, `rgba(77, 240, 216, ${0.05 + pulse * 0.03})`);
    ring.addColorStop(0.42, "rgba(247, 201, 105, 0.06)");
    ring.addColorStop(0.64, "rgba(255, 109, 122, 0.04)");
    ring.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = ring;
    ctx.fillRect(0, 0, W, 330);

    ctx.strokeStyle = `rgba(77, 240, 216, ${0.13 + pulse * 0.06})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W * 0.5, 146, 165 + pulse * 14, 45 + pulse * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (const star of background.stars) {
      const y = (star.y + t * star.speed) % 305;
      const alpha = 0.22 + Math.sin(t * 2 + star.x) * 0.11;
      ctx.fillStyle = `rgba(${star.hue}, ${alpha})`;
      ctx.fillRect(star.x, y, star.size, star.size);
    }

    drawSkyline(t);
  }

  function drawSkyline(t) {
    ctx.save();
    ctx.translate(0, 8 + Math.sin(t * 0.32) * 4);
    for (const tower of background.towers) {
      const x = tower.x + Math.sin(t * 0.12 + tower.tone * 9) * 10;
      const y = HORIZON + 42 - tower.height;
      const color = tower.tone > 0.66 ? "77, 240, 216" : tower.tone > 0.34 ? "247, 201, 105" : "255, 109, 122";
      ctx.fillStyle = `rgba(7, 18, 23, ${0.48 + tower.tone * 0.24})`;
      ctx.fillRect(x, y, tower.width, tower.height);
      ctx.fillStyle = `rgba(${color}, 0.12)`;
      for (let row = y + 8; row < HORIZON + 34; row += 16) {
        ctx.fillRect(x + 4, row, Math.max(4, tower.width - 8), 2);
      }
    }
    ctx.restore();
  }

  function drawTrack() {
    const visualDistance = game.state === "menu" || game.state === "paused" || game.state === "gameover"
      ? game.menuRoad
      : game.distance;
    const left = laneWorld(0) - 0.66;
    const right = laneWorld(LANES - 1) + 0.66;
    const farLeft = project(left, 0, FAR_Z);
    const farRight = project(right, 0, FAR_Z);
    const nearLeft = project(left, 0, 0);
    const nearRight = project(right, 0, 0);

    const floorGradient = ctx.createLinearGradient(0, HORIZON, 0, GROUND_Y);
    floorGradient.addColorStop(0, "rgba(14, 38, 44, 0.38)");
    floorGradient.addColorStop(0.55, "rgba(15, 24, 25, 0.78)");
    floorGradient.addColorStop(1, "rgba(12, 16, 16, 0.97)");

    ctx.fillStyle = floorGradient;
    ctx.beginPath();
    ctx.moveTo(farLeft.x, farLeft.y);
    ctx.lineTo(farRight.x, farRight.y);
    ctx.lineTo(nearRight.x, nearRight.y);
    ctx.lineTo(nearLeft.x, nearLeft.y);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    drawTrackGlow(left, right);
    drawLaneLines(left, right);
    drawTileLines(left, right, visualDistance);
    drawSideRibs(left, right, visualDistance);
    ctx.restore();
  }

  function drawTrackGlow(left, right) {
    const centerNear = project(0, 0.02, 0);
    const centerFar = project(0, 0.02, FAR_Z);
    const grad = ctx.createLinearGradient(0, centerFar.y, 0, centerNear.y);
    grad.addColorStop(0, "rgba(77, 240, 216, 0.03)");
    grad.addColorStop(1, "rgba(77, 240, 216, 0.22)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.moveTo(centerFar.x, centerFar.y);
    ctx.lineTo(centerNear.x, centerNear.y);
    ctx.stroke();

    for (const edge of [left, right]) {
      const a = project(edge, 0.03, 0);
      const b = project(edge, 0.03, FAR_Z);
      ctx.strokeStyle = "rgba(247, 201, 105, 0.32)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawLaneLines(left, right) {
    for (let i = 1; i < LANES; i += 1) {
      const x = (laneWorld(i - 1) + laneWorld(i)) * 0.5;
      const near = project(x, 0.04, 0);
      const far = project(x, 0.04, FAR_Z);
      ctx.strokeStyle = i % 2 === 0 ? "rgba(77, 240, 216, 0.33)" : "rgba(255, 109, 122, 0.24)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 18]);
      ctx.lineDashOffset = -game.globalTime * 35;
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(near.x, near.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (let lane = 0; lane < LANES; lane += 1) {
      const laneX = laneWorld(lane);
      const near = project(laneX, 0.055, 0);
      const far = project(laneX, 0.055, FAR_Z);
      ctx.strokeStyle = lane === player.targetLane ? "rgba(185, 255, 118, 0.35)" : "rgba(77, 240, 216, 0.09)";
      ctx.lineWidth = lane === player.targetLane ? 5 : 2;
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(near.x, near.y);
      ctx.stroke();
    }
  }

  function drawTileLines(left, right, visualDistance) {
    const step = 4.7;
    let offset = step - (visualDistance % step);
    if (offset < 0.25) offset += step;
    for (let z = offset; z < FAR_Z; z += step) {
      const a = project(left, 0.05, z);
      const b = project(right, 0.05, z);
      const alpha = clamp(0.5 - z / FAR_Z * 0.4, 0.05, 0.38);
      ctx.strokeStyle = `rgba(77, 240, 216, ${alpha})`;
      ctx.lineWidth = clamp(8 / (z + 2), 0.8, 3.2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawSideRibs(left, right, visualDistance) {
    const step = 9.4;
    const offset = step - ((visualDistance * 0.52) % step);
    for (let z = offset; z < FAR_Z; z += step) {
      for (const side of [-1, 1]) {
        const baseX = side < 0 ? left - 0.88 : right + 0.88;
        const innerX = side < 0 ? left - 0.1 : right + 0.1;
        const base = project(baseX, 0, z);
        const top = project(baseX, 3.4, z);
        const inner = project(innerX, 2.2, z + 1.2);
        const alpha = clamp(0.42 - z / FAR_Z * 0.32, 0.05, 0.36);
        ctx.strokeStyle = side < 0 ? `rgba(255, 109, 122, ${alpha})` : `rgba(77, 240, 216, ${alpha})`;
        ctx.lineWidth = clamp(10 / (z + 3), 1, 4);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.lineTo(inner.x, inner.y);
        ctx.stroke();
      }
    }
  }

  function drawWorldGlyphs() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const glyph of background.glyphs) {
      const p = project(glyph.lane, glyph.y, glyph.z);
      const size = 34 * p.s;
      if (size < 2) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(glyph.rot);
      ctx.strokeStyle = colorWithAlpha(glyph.color, clamp(p.s * 0.58, 0.04, 0.28));
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.rect(-size * 0.5, -size * 0.5, size, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.42, 0);
      ctx.lineTo(size * 0.42, 0);
      ctx.moveTo(0, -size * 0.42);
      ctx.lineTo(0, size * 0.42);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawObject(object) {
    if (object.type === "gap") drawGap(object);
    else if (object.type === "barrier") drawBarrier(object);
    else if (object.type === "drone") drawDrone(object);
    else if (object.type === "power") drawPower(object);
    else drawShard(object);
  }

  function drawGap(object) {
    const laneX = object.x;
    const half = 0.49;
    const nearZ = object.z - object.length * 0.5;
    const farZ = object.z + object.length * 0.5;
    const a = project(laneX - half, 0.06, nearZ);
    const b = project(laneX + half, 0.06, nearZ);
    const c = project(laneX + half, 0.06, farZ);
    const d = project(laneX - half, 0.06, farZ);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const grad = ctx.createLinearGradient(0, d.y, 0, a.y);
    grad.addColorStop(0, "rgba(9, 2, 9, 0.8)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.95)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    const alpha = clamp(0.55 - object.z / FAR_Z * 0.3, 0.08, 0.5);
    ctx.strokeStyle = `rgba(255, 109, 122, ${alpha})`;
    ctx.lineWidth = Math.max(1.2, 9 * a.s);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(d.x, d.y);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    ctx.strokeStyle = `rgba(77, 240, 216, ${alpha * 0.55})`;
    ctx.lineWidth = Math.max(1, 3 * a.s);
    for (let i = 0; i < 3; i += 1) {
      const z = lerp(nearZ, farZ, (i + 1) / 4);
      const p1 = project(laneX - half * 0.72, 0.08, z);
      const p2 = project(laneX + half * 0.72, 0.08, z + Math.sin(object.wobble + i) * 0.4);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBarrier(object) {
    const base = project(object.x, 0, object.z);
    const top = project(object.x, 2.25, object.z);
    const width = clamp(78 * base.s, 5, 118);
    const topWidth = width * 0.58;
    const height = base.y - top.y;

    ctx.save();
    drawShadow(base.x, base.y, width * 0.68, base.s, "rgba(0, 0, 0, 0.42)");
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(base.x, top.y + height * 0.45, 2, base.x, top.y + height * 0.45, width * 1.4);
    glow.addColorStop(0, colorWithAlpha(object.color, 0.28));
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(base.x - width * 1.3, top.y - height * 0.12, width * 2.6, height * 1.25);
    ctx.globalCompositeOperation = "source-over";

    const body = ctx.createLinearGradient(base.x - width, top.y, base.x + width, base.y);
    body.addColorStop(0, "#2d1119");
    body.addColorStop(0.42, object.color);
    body.addColorStop(1, "#0b1013");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(base.x - width * 0.5, base.y);
    ctx.lineTo(base.x + width * 0.5, base.y);
    ctx.lineTo(base.x + topWidth * 0.5, top.y);
    ctx.lineTo(base.x - topWidth * 0.5, top.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = Math.max(1, 2 * base.s);
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(247, 201, 105, 0.5)";
    ctx.lineWidth = Math.max(1, 3 * base.s);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y - height * 0.1);
    ctx.lineTo(base.x, top.y + height * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  function drawDrone(object) {
    const p = project(object.x, object.y + Math.sin(object.wobble * 2) * 0.1, object.z);
    const size = clamp(65 * p.s, 5, 82);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, size * 1.7);
    halo.addColorStop(0, colorWithAlpha(object.color, 0.34));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(p.x - size * 1.8, p.y - size * 1.8, size * 3.6, size * 3.6);

    ctx.translate(p.x, p.y);
    ctx.rotate(object.spin * 0.6);
    ctx.fillStyle = "rgba(7, 12, 16, 0.9)";
    ctx.strokeStyle = colorWithAlpha(object.color, 0.82);
    ctx.lineWidth = Math.max(1.2, size * 0.07);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.68);
    ctx.lineTo(size * 0.68, 0);
    ctx.lineTo(0, size * 0.68);
    ctx.lineTo(-size * 0.68, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.rotate(-object.spin * 1.2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.62)";
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.35, size * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = colorWithAlpha(palette.amber, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.5, size * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShard(object) {
    const bob = Math.sin(object.wobble * 2.4) * 0.1;
    const p = project(object.x, object.y + bob, object.z);
    const size = clamp(38 * p.s, 4, 44);
    if (object.hit) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, size * 1.7);
    glow.addColorStop(0, colorWithAlpha(object.color, 0.4));
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - size * 1.8, p.y - size * 1.8, size * 3.6, size * 3.6);

    ctx.translate(p.x, p.y);
    ctx.rotate(object.spin);
    ctx.fillStyle = colorWithAlpha(object.color, 0.84);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.62);
    ctx.lineTo(size * 0.42, 0);
    ctx.lineTo(0, size * 0.62);
    ctx.lineTo(-size * 0.42, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPower(object) {
    const p = project(object.x, object.y + Math.sin(object.wobble * 2) * 0.12, object.z);
    const size = clamp(54 * p.s, 5, 62);
    if (object.hit) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = colorWithAlpha(palette.lime, 0.8);
    ctx.lineWidth = Math.max(1.2, size * 0.08);
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, size * (0.35 + i * 0.18), size * (0.18 + i * 0.09), object.spin + i, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = colorWithAlpha(palette.lime, 0.78);
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const particle of game.particles) {
      const p = project(particle.x, particle.y, particle.z);
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      const size = particle.size * p.s;
      if (size < 0.6) continue;
      ctx.fillStyle = colorWithAlpha(particle.color, alpha * 0.82);
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRings() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const ring of game.rings) {
      const p = project(ring.x, ring.y, ring.z);
      ctx.strokeStyle = colorWithAlpha(ring.color, ring.life / ring.maxLife);
      ctx.lineWidth = 3 * p.s;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, ring.radius * p.s, ring.radius * 0.32 * p.s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const ground = project(player.x, 0, 0);
    const p = project(player.x, player.y + 0.15 + Math.sin(game.globalTime * 9) * 0.025, 0);
    const dashAlpha = player.dash > 0 ? 0.9 : 0;
    const invulnFlicker = player.invuln > 0 && Math.sin(game.globalTime * 48) > 0.25;
    const scale = 1;

    ctx.save();
    drawShadow(ground.x, ground.y + 5, 72 + player.y * 18, 1, "rgba(0, 0, 0, 0.46)");

    if (dashAlpha > 0) {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 1; i <= 5; i += 1) {
        const trail = project(player.x, player.y + 0.18, i * 0.52);
        ctx.fillStyle = `rgba(255, 109, 122, ${dashAlpha * (0.16 / i)})`;
        ctx.beginPath();
        ctx.ellipse(trail.x, trail.y + 25, 100 / i, 20 / i, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (invulnFlicker && player.dash <= 0) ctx.globalAlpha = 0.42;
    ctx.translate(p.x, p.y);
    ctx.rotate(player.lean * 0.08);

    ctx.globalCompositeOperation = "source-over";
    const boardY = 60 * scale;
    const boardGrad = ctx.createLinearGradient(-78, boardY - 14, 78, boardY + 14);
    boardGrad.addColorStop(0, "#0b171c");
    boardGrad.addColorStop(0.35, palette.teal);
    boardGrad.addColorStop(0.68, palette.amber);
    boardGrad.addColorStop(1, "#111319");
    ctx.fillStyle = boardGrad;
    ctx.beginPath();
    ctx.ellipse(0, boardY, 80 * scale, 15 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.36)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = player.dash > 0 ? "rgba(255, 109, 122, 0.8)" : "rgba(77, 240, 216, 0.55)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-55, boardY + 4);
    ctx.lineTo(55, boardY + 4);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    const cloak = ctx.createLinearGradient(-34, -18, 38, 54);
    cloak.addColorStop(0, "#233945");
    cloak.addColorStop(0.5, "#0c141a");
    cloak.addColorStop(1, "#ff6d7a");
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(-22, -12);
    ctx.lineTo(24, -4);
    ctx.lineTo(40 + Math.sin(game.globalTime * 7) * 6, 48);
    ctx.lineTo(-36, 52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#dffcf4";
    ctx.beginPath();
    ctx.moveTo(-15, -42);
    ctx.lineTo(18, -38);
    ctx.lineTo(24, -10);
    ctx.lineTo(-20, -13);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#071014";
    ctx.beginPath();
    ctx.moveTo(-8, -37);
    ctx.lineTo(20, -34);
    ctx.lineTo(17, -22);
    ctx.lineTo(-11, -24);
    ctx.closePath();
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = player.dash > 0 ? "rgba(255, 109, 122, 0.92)" : "rgba(77, 240, 216, 0.82)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -29);
    ctx.lineTo(15, -27);
    ctx.stroke();

    const chargeGlow = player.charge / 100;
    ctx.strokeStyle = `rgba(185, 255, 118, ${0.18 + chargeGlow * 0.42})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 8, 45 + chargeGlow * 8, -0.35, Math.PI + 0.3);
    ctx.stroke();
    ctx.restore();
  }

  function drawShadow(x, y, radius, scale, fill) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * scale, radius * 0.22 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function colorWithAlpha(hex, alpha) {
    const normalized = hex.replace("#", "");
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
  }

  function tick(now) {
    const dt = clamp((now - lastFrame) / 1000, 0, 0.033);
    lastFrame = now;
    game.globalTime += dt;
    game.hudTimer = Math.max(0, game.hudTimer - dt);
    game.shake = Math.max(0, game.shake - dt * 1.9);
    game.flash = Math.max(0, game.flash - dt * 1.8);

    updateRun(dt);
    if (game.state === "playing" || game.state === "countdown") updateHud(false);
    audio.update();
    draw();

    requestAnimationFrame(tick);
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    const actionKeys = ["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w", "shift", "j", "p", "escape", "enter", "m"];
    if (actionKeys.includes(key)) event.preventDefault();
    if (event.repeat && key !== " ") return;

    if (key === "m") {
      audio.toggle();
      return;
    }

    if (key === "enter") {
      if (game.state === "menu" || game.state === "gameover") startRun();
      return;
    }

    if (key === "p" || key === "escape") {
      if (game.state === "paused") resumeRun();
      else pauseRun();
      return;
    }

    if (key === "arrowleft" || key === "a") moveLane(-1);
    else if (key === "arrowright" || key === "d") moveLane(1);
    else if (key === "arrowup" || key === "w" || key === " ") jump();
    else if (key === "shift" || key === "j") dash();
  }

  function wireUi() {
    dom.startBtn.addEventListener("click", startRun);
    dom.restartBtn.addEventListener("click", startRun);
    dom.restartPauseBtn.addEventListener("click", startRun);
    dom.resumeBtn.addEventListener("click", resumeRun);
    dom.menuBtn.addEventListener("click", () => setScreen("menu"));
    dom.menuPauseBtn.addEventListener("click", () => setScreen("menu"));
    dom.muteBtn.addEventListener("click", () => audio.toggle());
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("blur", () => {
      if (game.state === "playing") pauseRun();
    });
    window.addEventListener("resize", resizeCanvas);
  }

  resizeCanvas();
  wireUi();
  updateMuteLabel();
  updateHud(true);
  if (new URLSearchParams(window.location.search).has("autoplay")) {
    window.setTimeout(() => {
      startRun();
      if (new URLSearchParams(window.location.search).has("skipCountdown")) game.countdown = 0.01;
    }, 80);
  }
  requestAnimationFrame(tick);
})();

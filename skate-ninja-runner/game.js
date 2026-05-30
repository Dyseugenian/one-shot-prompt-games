(() => {
  "use strict";

  const WIDTH = 1280;
  const HEIGHT = 720;
  const GROUND_Y = 528;
  const GRAVITY = 2050;
  const JUMP_VELOCITY = -850;
  const STORAGE_RECORDS = "skate-ninja-runner-records";
  const STORAGE_MUTE = "skate-ninja-runner-muted";
  const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";

  const stage = document.getElementById("stage");
  const worldCanvas = document.getElementById("world3d");
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  const ui = {
    hud: document.getElementById("hud"),
    score: document.getElementById("scoreText"),
    distance: document.getElementById("distanceText"),
    speed: document.getElementById("speedText"),
    cooldownFill: document.getElementById("cooldownFill"),
    cooldownText: document.getElementById("cooldownText"),
    mute: document.getElementById("muteBtn"),
    hint: document.getElementById("hint"),
    countdown: document.getElementById("countdown"),
    flash: document.getElementById("flash"),
    recordsList: document.getElementById("recordsList"),
    emptyRecords: document.getElementById("emptyRecords"),
    finalScore: document.getElementById("finalScoreText"),
    finalStats: document.getElementById("finalStatsText"),
    play: document.getElementById("playBtn"),
    records: document.getElementById("recordsBtn"),
    quit: document.getElementById("quitBtn"),
    backRecords: document.getElementById("backRecordsBtn"),
    resume: document.getElementById("resumeBtn"),
    pauseMenu: document.getElementById("pauseMenuBtn"),
    restart: document.getElementById("restartBtn"),
    gameOverMenu: document.getElementById("gameOverMenuBtn"),
    quitBack: document.getElementById("quitBackBtn")
  };

  const screens = {
    menu: document.getElementById("mainMenu"),
    records: document.getElementById("recordsScreen"),
    paused: document.getElementById("pauseScreen"),
    gameover: document.getElementById("gameOverScreen"),
    quit: document.getElementById("quitScreen")
  };

  let dpr = 1;
  let lastFrame = performance.now();
  let seed = 7612345;

  const input = {
    mouseX: 800,
    mouseY: 360,
    jumpHeld: false,
    jumpBuffer: 0,
    pointerInside: false
  };

  const state = {
    mode: "menu",
    time: 0,
    runTime: 0,
    distance: 0,
    score: 0,
    speed: 250,
    difficulty: 0,
    spawnTimer: 1.2,
    enemyTimer: 2.5,
    shurikenCooldown: 0,
    combo: 0,
    comboTimer: 0,
    hintTimer: 0,
    countdown: 0,
    trackOffset: 0,
    backgroundOffset: 0,
    shake: 0,
    flash: 0,
    savedRecord: false,
    uiTimer: 0
  };

  const player = {
    x: 260,
    y: GROUND_Y,
    vy: 0,
    grounded: true,
    falling: false,
    ollieTime: 0,
    landTimer: 0,
    wheelSpin: 0,
    hitFlash: 0
  };

  const obstaclePool = makePool(36, () => ({
    active: false,
    kind: "crate",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    passed: false,
    color: "#c9794e",
    wobble: 0
  }));

  const enemyPool = makePool(18, () => ({
    active: false,
    x: 0,
    y: 0,
    baseY: 0,
    radius: 22,
    phase: 0,
    amp: 0,
    speed: 0,
    rot: 0,
    passed: false,
    color: "#e74f7a"
  }));

  const projectilePool = makePool(16, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    rot: 0,
    trail: []
  }));

  const particlePool = makePool(180, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    size: 1,
    color: "#ffffff",
    gravity: 0,
    line: false,
    rot: 0
  }));
  let particleCursor = 0;

  const clouds = Array.from({ length: 12 }, (_, i) => ({
    x: randRange(0, WIDTH),
    y: randRange(45, 210),
    size: randRange(38, 92),
    speed: randRange(0.07, 0.18),
    puff: 3 + (i % 4)
  }));

  const fallbackDecor = Array.from({ length: 32 }, (_, i) => ({
    x: i * 92 + randRange(0, 70),
    y: randRange(390, 470),
    scale: randRange(0.72, 1.22),
    type: ["tree", "house", "bush", "fence", "lamp", "flowers"][i % 6],
    depth: randRange(0.32, 0.72),
    colorShift: randRange(0, 1)
  }));

  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    windGain: null,
    windSource: null,
    muted: readMute(),
    musicStep: 0,
    nextMusicAt: 0
  };

  const three = {
    ready: false,
    failed: false,
    renderer: null,
    scene: null,
    camera: null,
    props: [],
    hills: [],
    materials: null
  };

  function makePool(size, factory) {
    return Array.from({ length: size }, factory);
  }

  function acquire(pool) {
    for (const item of pool) {
      if (!item.active) return item;
    }
    return null;
  }

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function randRange(min, max) {
    return min + (max - min) * random();
  }

  function choose(list) {
    return list[Math.floor(random() * list.length)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  }

  function formatNumber(value) {
    return Math.max(0, Math.floor(value)).toLocaleString("en-US");
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, screen]) => {
      const active = key === name;
      screen.classList.toggle("active", active);
      screen.classList.toggle("hidden", !active);
    });
  }

  function setHudVisible(visible) {
    ui.hud.classList.toggle("hidden", !visible);
  }

  function setHintVisible(visible) {
    ui.hint.classList.toggle("hidden", !visible);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    worldCanvas.width = Math.round(WIDTH * dpr);
    worldCanvas.height = Math.round(HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resizeThree();
  }

  function pointerToGame(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * HEIGHT;
  }

  function readMute() {
    try {
      return localStorage.getItem(STORAGE_MUTE) === "1";
    } catch {
      return false;
    }
  }

  function writeMute() {
    try {
      localStorage.setItem(STORAGE_MUTE, audio.muted ? "1" : "0");
    } catch {
      return;
    }
  }

  function setMuteButton() {
    ui.mute.textContent = audio.muted ? "Sound Off" : "Sound On";
    ui.mute.setAttribute("aria-pressed", String(audio.muted));
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.65;
  }

  function unlockAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    audio.ctx = new AudioContext();
    audio.master = audio.ctx.createGain();
    audio.musicGain = audio.ctx.createGain();
    audio.windGain = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.65;
    audio.musicGain.gain.value = 0.12;
    audio.windGain.gain.value = 0;
    audio.musicGain.connect(audio.master);
    audio.windGain.connect(audio.master);
    audio.master.connect(audio.ctx.destination);
    createWind();
    setMuteButton();
  }

  function createWind() {
    if (!audio.ctx || audio.windSource) return;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 2, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.45;
    }
    const source = audio.ctx.createBufferSource();
    const filter = audio.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 620;
    filter.Q.value = 0.5;
    source.buffer = buffer;
    source.loop = true;
    source.connect(filter);
    filter.connect(audio.windGain);
    source.start();
    audio.windSource = source;
  }

  function playTone(freq, duration, type, gain, when = 0, target = audio.master) {
    if (!audio.ctx || audio.muted) return;
    const now = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const env = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.86), now + duration);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(target);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function playNoise(duration, gain, filterType, frequency) {
    if (!audio.ctx || audio.muted) return;
    const now = audio.ctx.currentTime;
    const buffer = audio.ctx.createBuffer(1, Math.max(1, audio.ctx.sampleRate * duration), audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = audio.ctx.createBufferSource();
    const filter = audio.ctx.createBiquadFilter();
    const env = audio.ctx.createGain();
    filter.type = filterType;
    filter.frequency.value = frequency;
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(env);
    env.connect(audio.master);
    source.start(now);
    source.stop(now + duration);
  }

  function sound(name) {
    if (!audio.ctx || audio.muted) return;
    switch (name) {
      case "button":
        playTone(620, 0.08, "triangle", 0.08);
        playTone(930, 0.08, "triangle", 0.05, 0.045);
        break;
      case "start":
        playTone(330, 0.12, "triangle", 0.09);
        playTone(495, 0.14, "triangle", 0.09, 0.08);
        playTone(742, 0.18, "triangle", 0.1, 0.17);
        break;
      case "jump":
        playTone(270, 0.13, "sawtooth", 0.08);
        playTone(530, 0.12, "triangle", 0.07, 0.03);
        playNoise(0.08, 0.035, "highpass", 1200);
        break;
      case "land":
        playTone(130, 0.11, "triangle", 0.07);
        playNoise(0.11, 0.055, "lowpass", 650);
        break;
      case "throw":
        playTone(810, 0.08, "square", 0.045);
        playNoise(0.08, 0.045, "highpass", 2200);
        break;
      case "hit":
        playTone(760, 0.08, "triangle", 0.08);
        playTone(1140, 0.09, "triangle", 0.06, 0.04);
        playNoise(0.09, 0.05, "highpass", 1800);
        break;
      case "crash":
        playTone(180, 0.2, "sawtooth", 0.13);
        playTone(92, 0.32, "sawtooth", 0.12, 0.03);
        playNoise(0.32, 0.14, "lowpass", 520);
        break;
      case "speed":
        playTone(440, 0.1, "triangle", 0.04);
        playTone(660, 0.1, "triangle", 0.04, 0.06);
        break;
      default:
        break;
    }
  }

  function updateMusic(dt) {
    if (!audio.ctx || audio.muted) return;
    const playing = state.mode === "playing";
    const windTarget = playing ? clamp(0.035 + state.difficulty * 0.008, 0.035, 0.12) : 0;
    audio.windGain.gain.setTargetAtTime(windTarget, audio.ctx.currentTime, 0.1);
    if (!playing) return;

    const tempo = 0.29 / clamp(1 + state.difficulty * 0.035, 1, 1.42);
    const now = audio.ctx.currentTime;
    if (audio.nextMusicAt < now) audio.nextMusicAt = now;

    const melody = [392, 494, 587, 659, 587, 494, 440, 523, 659, 784, 659, 523, 440, 392, 330, 392];
    while (audio.nextMusicAt < now + 0.08) {
      const step = audio.musicStep % melody.length;
      const freq = melody[step];
      const bass = step % 4 === 0 ? 196 : 0;
      playTone(freq, 0.13, "triangle", 0.035, audio.nextMusicAt - now, audio.musicGain);
      if (bass) playTone(bass, 0.18, "sine", 0.045, audio.nextMusicAt - now, audio.musicGain);
      audio.musicStep += 1;
      audio.nextMusicAt += tempo;
    }
    void dt;
  }

  function loadThreeAsync() {
    const script = document.createElement("script");
    script.src = THREE_CDN;
    script.async = true;
    script.onload = initThree;
    script.onerror = () => {
      three.failed = true;
    };
    document.head.appendChild(script);
  }

  function initThree() {
    if (!window.THREE || three.ready) return;
    try {
      const T = window.THREE;
      const renderer = new T.WebGLRenderer({ canvas: worldCanvas, alpha: true, antialias: true });
      renderer.setPixelRatio(dpr);
      renderer.setSize(WIDTH, HEIGHT, false);
      renderer.setClearColor(0x000000, 0);

      const scene = new T.Scene();
      scene.fog = new T.Fog(0x93e6ff, 10, 32);

      const camera = new T.PerspectiveCamera(42, WIDTH / HEIGHT, 0.1, 100);
      camera.position.set(0, 3.5, 12.5);
      camera.lookAt(0, 1.25, -5);

      const hemi = new T.HemisphereLight(0xffffff, 0x68a05f, 1.9);
      const sun = new T.DirectionalLight(0xfff4c2, 1.5);
      sun.position.set(4, 8, 6);
      scene.add(hemi, sun);

      three.renderer = renderer;
      three.scene = scene;
      three.camera = camera;
      three.materials = {
        leaf: new T.MeshLambertMaterial({ color: 0x42c96f }),
        leafDark: new T.MeshLambertMaterial({ color: 0x239b58 }),
        trunk: new T.MeshLambertMaterial({ color: 0x8b5837 }),
        roof: new T.MeshLambertMaterial({ color: 0xff6f59 }),
        wall: new T.MeshLambertMaterial({ color: 0xffe0a0 }),
        fence: new T.MeshLambertMaterial({ color: 0xf2c179 }),
        stone: new T.MeshLambertMaterial({ color: 0x9aa9af }),
        hillA: new T.MeshLambertMaterial({ color: 0x83da78 }),
        hillB: new T.MeshLambertMaterial({ color: 0x5fca72 })
      };

      for (let i = 0; i < 8; i += 1) {
        const hill = makeThreeHill(T, i % 2 === 0 ? three.materials.hillA : three.materials.hillB);
        hill.position.set(-17 + i * 5.4, -1.25, -14 - (i % 3) * 1.9);
        hill.scale.set(1.6 + (i % 3) * 0.3, 0.7 + (i % 2) * 0.2, 0.45);
        scene.add(hill);
        three.hills.push(hill);
      }

      for (let i = 0; i < 24; i += 1) {
        const prop = makeThreeProp(T, i);
        prop.group.position.set(-16 + i * 1.65 + randRange(-0.4, 0.4), -0.75, -5.5 - randRange(0, 8));
        prop.group.scale.setScalar(randRange(0.72, 1.28));
        scene.add(prop.group);
        three.props.push(prop);
      }

      three.ready = true;
      resizeThree();
    } catch {
      three.failed = true;
      three.ready = false;
    }
  }

  function makeThreeHill(T, material) {
    const mesh = new T.Mesh(new T.SphereGeometry(2.8, 18, 10), material);
    mesh.rotation.z = randRange(-0.08, 0.08);
    return mesh;
  }

  function makeThreeProp(T, index) {
    const group = new T.Group();
    const kind = ["tree", "tree", "house", "fence", "stone", "bush"][index % 6];
    if (kind === "tree") {
      const trunk = new T.Mesh(new T.CylinderGeometry(0.08, 0.12, 0.9, 7), three.materials.trunk);
      trunk.position.y = 0.35;
      const crown = new T.Mesh(new T.ConeGeometry(0.48, 1.15, 9), index % 3 === 0 ? three.materials.leafDark : three.materials.leaf);
      crown.position.y = 1.18;
      const cap = new T.Mesh(new T.ConeGeometry(0.36, 0.82, 9), three.materials.leaf);
      cap.position.y = 1.72;
      group.add(trunk, crown, cap);
    } else if (kind === "house") {
      const body = new T.Mesh(new T.BoxGeometry(0.9, 0.72, 0.72), three.materials.wall);
      body.position.y = 0.36;
      const roof = new T.Mesh(new T.ConeGeometry(0.72, 0.55, 4), three.materials.roof);
      roof.position.y = 0.98;
      roof.rotation.y = Math.PI / 4;
      group.add(body, roof);
    } else if (kind === "fence") {
      for (let i = -1; i <= 1; i += 1) {
        const post = new T.Mesh(new T.BoxGeometry(0.08, 0.55, 0.08), three.materials.fence);
        post.position.set(i * 0.35, 0.28, 0);
        group.add(post);
      }
      const railA = new T.Mesh(new T.BoxGeometry(0.95, 0.08, 0.08), three.materials.fence);
      const railB = railA.clone();
      railA.position.y = 0.22;
      railB.position.y = 0.43;
      group.add(railA, railB);
    } else if (kind === "stone") {
      const stone = new T.Mesh(new T.DodecahedronGeometry(0.28, 0), three.materials.stone);
      stone.position.y = 0.22;
      stone.scale.set(1.35, 0.62, 0.9);
      group.add(stone);
    } else {
      const bush = new T.Mesh(new T.SphereGeometry(0.42, 10, 6), three.materials.leafDark);
      bush.position.y = 0.32;
      bush.scale.set(1.4, 0.62, 0.7);
      group.add(bush);
    }
    group.rotation.y = randRange(-0.22, 0.22);
    return { group, kind };
  }

  function resizeThree() {
    if (!three.ready || !three.renderer) return;
    three.renderer.setPixelRatio(dpr);
    three.renderer.setSize(WIDTH, HEIGHT, false);
    three.camera.aspect = WIDTH / HEIGHT;
    three.camera.updateProjectionMatrix();
  }

  function updateThree(dt) {
    if (!three.ready) return;
    const scroll = (state.mode === "playing" || state.mode === "countdown") ? state.speed : 125;
    const hillMove = scroll * dt * 0.0028;
    const propMove = scroll * dt * 0.0085;

    for (const hill of three.hills) {
      hill.position.x -= hillMove;
      if (hill.position.x < -20) hill.position.x += 43;
    }

    for (const prop of three.props) {
      const depth = clamp((Math.abs(prop.group.position.z) - 4) / 10, 0.2, 1);
      prop.group.position.x -= propMove * (1.1 - depth * 0.35);
      prop.group.rotation.y += Math.sin(state.time + prop.group.position.x) * dt * 0.04;
      if (prop.group.position.x < -18.5) {
        prop.group.position.x = 18 + randRange(0, 5);
        prop.group.position.z = -5.5 - randRange(0, 8);
        prop.group.scale.setScalar(randRange(0.72, 1.32));
      }
    }

    const jumpLift = clamp((GROUND_Y - player.y) / 260, -0.4, 0.7);
    three.camera.position.y = 3.45 + jumpLift * 0.22 + Math.sin(state.time * 0.8) * 0.025;
    three.camera.position.x = clamp((state.speed - 350) / 900, 0, 0.45);
    three.camera.lookAt(0.2, 1.24 + jumpLift * 0.08, -5);
    three.renderer.render(three.scene, three.camera);
  }

  function resetRun() {
    seed = 7612345 + Math.floor(performance.now()) % 100000;
    state.runTime = 0;
    state.distance = 0;
    state.score = 0;
    state.speed = 340;
    state.difficulty = 0;
    state.spawnTimer = 1.25;
    state.enemyTimer = 2.35;
    state.shurikenCooldown = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.hintTimer = 5.4;
    state.countdown = 3.25;
    state.trackOffset = 0;
    state.backgroundOffset = 0;
    state.shake = 0;
    state.flash = 0;
    state.savedRecord = false;
    input.jumpBuffer = 0;
    input.jumpHeld = false;

    player.x = 260;
    player.y = GROUND_Y;
    player.vy = 0;
    player.grounded = true;
    player.falling = false;
    player.ollieTime = 0;
    player.landTimer = 0;
    player.wheelSpin = 0;
    player.hitFlash = 0;

    for (const pool of [obstaclePool, enemyPool, projectilePool, particlePool]) {
      for (const item of pool) item.active = false;
    }
  }

  function startRun(options = {}) {
    resetRun();
    showScreen(null);
    setHudVisible(true);
    setHintVisible(false);
    ui.countdown.classList.remove("hidden");
    state.mode = options.skipCountdown ? "playing" : "countdown";
    if (options.skipCountdown) {
      ui.countdown.classList.add("hidden");
      setHintVisible(true);
    }
    sound("start");
  }

  function goMenu() {
    state.mode = "menu";
    showScreen("menu");
    setHudVisible(false);
    setHintVisible(false);
    ui.countdown.classList.add("hidden");
  }

  function openRecords() {
    state.mode = "records";
    renderRecords();
    showScreen("records");
    setHudVisible(false);
    setHintVisible(false);
    ui.countdown.classList.add("hidden");
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      showScreen("paused");
      setHintVisible(false);
      sound("button");
    } else if (state.mode === "paused") {
      state.mode = "playing";
      showScreen(null);
      setHintVisible(state.hintTimer > 0);
      sound("button");
    }
  }

  function gameOver() {
    if (state.mode === "gameover") return;
    state.mode = "gameover";
    state.shake = 18;
    state.flash = 0.7;
    player.hitFlash = 0.4;
    sound("crash");
    burst(player.x, player.y - 62, "#ff4f6d", 34, 360);
    saveRecord();
    ui.finalScore.textContent = formatNumber(state.score);
    ui.finalStats.textContent = `Distance ${formatNumber(state.distance)} m  |  Speed ${state.speed.toFixed(0)}`;
    showScreen("gameover");
    setHintVisible(false);
  }

  function saveRecord() {
    if (state.savedRecord) return;
    state.savedRecord = true;
    const record = {
      score: Math.max(0, Math.floor(state.score)),
      distance: Math.max(0, Math.floor(state.distance)),
      date: new Date().toISOString()
    };
    try {
      const list = readRecords();
      list.unshift(record);
      localStorage.setItem(STORAGE_RECORDS, JSON.stringify(list.slice(0, 10)));
    } catch {
      return;
    }
  }

  function readRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_RECORDS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => Number.isFinite(item.score) && item.date)
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  function renderRecords() {
    const list = readRecords();
    ui.recordsList.innerHTML = "";
    ui.emptyRecords.classList.toggle("hidden", list.length > 0);
    list.forEach((record, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("strong");
      const meta = document.createElement("span");
      const date = new Date(record.date);
      rank.textContent = `#${index + 1}  ${formatNumber(record.score)}`;
      meta.textContent = `${Number(record.distance || 0).toLocaleString("en-US")} m  |  ${date.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })}`;
      item.append(rank, meta);
      ui.recordsList.appendChild(item);
    });
  }

  function requestJump() {
    input.jumpBuffer = 0.14;
    if (state.mode === "playing") tryStartOllie();
  }

  function tryStartOllie() {
    if (!player.grounded || player.falling || !isGroundUnder(player.x + 10)) return;
    player.grounded = false;
    player.vy = JUMP_VELOCITY;
    player.ollieTime = 0;
    player.landTimer = 0;
    input.jumpBuffer = 0;
    sound("jump");
    for (let i = 0; i < 12; i += 1) {
      spawnParticle(player.x - 42 + randRange(-8, 8), GROUND_Y + 3, randRange(-210, -70), randRange(-110, -20), randRange(0.28, 0.48), "#f4d39a", randRange(2, 5), 420);
    }
  }

  function landPlayer() {
    player.y = GROUND_Y;
    player.vy = 0;
    player.grounded = true;
    player.falling = false;
    player.landTimer = 0.2;
    sound("land");
    for (let i = 0; i < 16; i += 1) {
      spawnParticle(player.x - 8 + randRange(-30, 36), GROUND_Y + 7, randRange(-180, 80), randRange(-120, -20), randRange(0.25, 0.5), "#d7a263", randRange(2, 6), 520);
    }
  }

  function updateCountdown(dt) {
    state.countdown -= dt;
    const c = state.countdown;
    ui.countdown.textContent = c > 2.35 ? "3" : c > 1.5 ? "2" : c > 0.65 ? "1" : "RUN";
    if (state.countdown <= 0) {
      state.mode = "playing";
      ui.countdown.classList.add("hidden");
      setHintVisible(true);
      state.hintTimer = 5.2;
    }
  }

  function updateRun(dt) {
    state.runTime += dt;
    state.difficulty = clamp(state.runTime / 20 + state.distance / 950, 0, 11);
    const previousBand = Math.floor((state.speed - 340) / 120);
    state.speed = 340 + state.difficulty * 42 + Math.sin(state.runTime * 0.35) * 8;
    const nextBand = Math.floor((state.speed - 340) / 120);
    if (nextBand > previousBand && state.runTime > 5) sound("speed");

    state.distance += state.speed * dt * 0.055;
    state.score += dt * (14 + state.difficulty * 3.5) + state.speed * dt * 0.035;
    state.shurikenCooldown = Math.max(0, state.shurikenCooldown - dt);
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer <= 0) state.combo = 0;
    state.hintTimer = Math.max(0, state.hintTimer - dt);
    setHintVisible(state.hintTimer > 0);

    updateSpawns(dt);
    updateObstacles(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePlayer(dt);
    updateParticles(dt);
    checkCollisions();
  }

  function updateVisualMotion(dt) {
    const visualSpeed = state.mode === "playing" || state.mode === "countdown" ? state.speed : 130;
    if (state.mode !== "paused") {
      state.trackOffset += visualSpeed * dt;
      state.backgroundOffset += visualSpeed * dt;
      player.wheelSpin += visualSpeed * dt * 0.05;
    }
  }

  function updatePlayer(dt) {
    input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
    player.landTimer = Math.max(0, player.landTimer - dt);
    player.hitFlash = Math.max(0, player.hitFlash - dt);

    if (player.grounded && !isGroundUnder(player.x + 10)) {
      player.grounded = false;
      player.falling = true;
      player.vy = Math.max(player.vy, 80);
    }

    if (!player.grounded) {
      player.ollieTime += dt;
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;

      if (player.y >= GROUND_Y && isGroundUnder(player.x + 10) && player.vy > 0) {
        landPlayer();
      }

      if (player.y > HEIGHT + 110) {
        gameOver();
      }
    } else {
      player.y = GROUND_Y;
      if (input.jumpHeld || input.jumpBuffer > 0) tryStartOllie();
      if (state.mode === "playing" && random() < dt * 12) {
        spawnParticle(player.x - 48, GROUND_Y + randRange(0, 12), randRange(-230, -120), randRange(-20, 18), randRange(0.22, 0.42), "#e8c082", randRange(1.5, 3.5), 80);
      }
    }
  }

  function updateSpawns(dt) {
    state.spawnTimer -= dt;
    state.enemyTimer -= dt;

    if (state.spawnTimer <= 0) {
      spawnPattern();
      const base = randRange(0.95, 1.42) - clamp(state.difficulty * 0.045, 0, 0.42);
      state.spawnTimer = Math.max(0.58, base);
    }

    if (state.enemyTimer <= 0) {
      spawnEnemy();
      const base = randRange(1.7, 3.15) - clamp(state.difficulty * 0.11, 0, 1.12);
      state.enemyTimer = Math.max(0.78, base);
    }
  }

  function spawnPattern() {
    const roll = random();
    if (roll < 0.28) {
      spawnObstacle("pit", 90);
    } else if (roll < 0.58) {
      spawnObstacle(choose(["crate", "barrier", "stone"]), 90);
    } else if (roll < 0.76 && state.difficulty > 1.5) {
      spawnObstacle("crate", 90);
      spawnObstacle("stone", 330 + randRange(0, 80));
    } else if (state.difficulty > 2.4) {
      spawnObstacle("pit", 90);
      if (random() < 0.55) spawnEnemy(360 + randRange(0, 120), randRange(250, 340));
    } else {
      spawnObstacle(choose(["crate", "stone"]), 90);
    }
  }

  function spawnObstacle(kind, offset) {
    const obstacle = acquire(obstaclePool);
    if (!obstacle) return;
    obstacle.active = true;
    obstacle.kind = kind;
    obstacle.x = WIDTH + offset;
    obstacle.passed = false;
    obstacle.wobble = randRange(0, Math.PI * 2);
    obstacle.color = choose(["#d47b4e", "#c66559", "#6e9fd8", "#dca848"]);

    if (kind === "pit") {
      obstacle.w = randRange(128, Math.min(270, 178 + state.difficulty * 14));
      obstacle.h = 170;
      obstacle.y = GROUND_Y - 22;
    } else if (kind === "barrier") {
      obstacle.w = randRange(44, 58);
      obstacle.h = randRange(76, 104);
      obstacle.y = GROUND_Y - 14 - obstacle.h;
      obstacle.color = "#df4f5f";
    } else if (kind === "stone") {
      obstacle.w = randRange(58, 82);
      obstacle.h = randRange(42, 58);
      obstacle.y = GROUND_Y - 12 - obstacle.h;
      obstacle.color = "#8aa0aa";
    } else {
      obstacle.w = randRange(54, 72);
      obstacle.h = randRange(54, 74);
      obstacle.y = GROUND_Y - 12 - obstacle.h;
    }
  }

  function spawnEnemy(offset = 90, forcedY = 0) {
    const enemy = acquire(enemyPool);
    if (!enemy) return;
    enemy.active = true;
    enemy.x = WIDTH + offset;
    enemy.baseY = forcedY || randRange(230, 390);
    enemy.y = enemy.baseY;
    enemy.radius = randRange(20, 28);
    enemy.phase = randRange(0, Math.PI * 2);
    enemy.amp = randRange(10, 44);
    enemy.speed = randRange(48, 108) + state.difficulty * 9;
    enemy.rot = randRange(0, Math.PI * 2);
    enemy.passed = false;
    enemy.color = choose(["#e74f7a", "#ff9d3b", "#7357ff", "#2d88ff"]);
  }

  function updateObstacles(dt) {
    for (const obstacle of obstaclePool) {
      if (!obstacle.active) continue;
      obstacle.x -= state.speed * dt;
      obstacle.wobble += dt * 7;
      if (!obstacle.passed && obstacle.kind !== "pit" && obstacle.x + obstacle.w < player.x - 20) {
        obstacle.passed = true;
        state.score += 18 + state.difficulty * 3;
      }
      if (obstacle.x + obstacle.w < -120) obstacle.active = false;
    }
  }

  function updateEnemies(dt) {
    for (const enemy of enemyPool) {
      if (!enemy.active) continue;
      enemy.x -= (state.speed * 0.86 + enemy.speed) * dt;
      enemy.phase += dt * (2.2 + state.difficulty * 0.08);
      enemy.y = enemy.baseY + Math.sin(enemy.phase) * enemy.amp;
      enemy.rot += dt * 5.5;
      if (!enemy.passed && enemy.x + enemy.radius < player.x - 18) {
        enemy.passed = true;
        state.score += 10;
      }
      if (enemy.x < -90) enemy.active = false;
    }
  }

  function updateProjectiles(dt) {
    for (const shuriken of projectilePool) {
      if (!shuriken.active) continue;
      shuriken.life -= dt;
      shuriken.trail.push({ x: shuriken.x, y: shuriken.y });
      if (shuriken.trail.length > 6) shuriken.trail.shift();
      shuriken.x += shuriken.vx * dt;
      shuriken.y += shuriken.vy * dt;
      shuriken.vy += 840 * dt;
      shuriken.rot += dt * 18;
      if (shuriken.life <= 0 || shuriken.x < -120 || shuriken.x > WIDTH + 160 || shuriken.y > HEIGHT + 120) {
        shuriken.active = false;
      }
    }
  }

  function updateParticles(dt) {
    for (const p of particlePool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rot += dt * 8;
    }
  }

  function throwShuriken() {
    if (state.mode !== "playing" || state.shurikenCooldown > 0) return;
    const shuriken = acquire(projectilePool);
    if (!shuriken) return;
    const hand = getHandPosition();
    const dx = input.mouseX - hand.x;
    const dy = input.mouseY - hand.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / length;
    const dirY = dy / length;
    const launch = 760 + state.speed * 0.18;

    shuriken.active = true;
    shuriken.x = hand.x;
    shuriken.y = hand.y;
    shuriken.vx = dirX * launch + 110;
    shuriken.vy = dirY * launch - 25;
    shuriken.life = 2.15;
    shuriken.maxLife = 2.15;
    shuriken.rot = 0;
    shuriken.trail = [];
    state.shurikenCooldown = 0.5;
    state.flash = Math.max(state.flash, 0.14);
    sound("throw");

    for (let i = 0; i < 8; i += 1) {
      spawnParticle(hand.x, hand.y, randRange(-80, 80), randRange(-70, 70), randRange(0.16, 0.28), "#ddf7ff", randRange(1.5, 3.5), 0, true);
    }
  }

  function checkCollisions() {
    const box = playerBox();

    for (const obstacle of obstaclePool) {
      if (!obstacle.active || obstacle.kind === "pit") continue;
      const obstacleBox = {
        x: obstacle.x + 6,
        y: obstacle.y + 5,
        w: obstacle.w - 12,
        h: obstacle.h - 5
      };
      if (aabb(box, obstacleBox)) {
        gameOver();
        return;
      }
    }

    for (const enemy of enemyPool) {
      if (!enemy.active) continue;
      const enemyBox = {
        x: enemy.x - enemy.radius * 0.78,
        y: enemy.y - enemy.radius * 0.7,
        w: enemy.radius * 1.56,
        h: enemy.radius * 1.4
      };
      if (aabb(box, enemyBox)) {
        gameOver();
        return;
      }
    }

    for (const shuriken of projectilePool) {
      if (!shuriken.active) continue;
      for (const enemy of enemyPool) {
        if (!enemy.active) continue;
        const hit = Math.hypot(shuriken.x - enemy.x, shuriken.y - enemy.y) < enemy.radius + 15;
        if (!hit) continue;
        shuriken.active = false;
        enemy.active = false;
        state.combo += 1;
        state.comboTimer = 2.3;
        state.score += 120 + state.combo * 28 + state.difficulty * 8;
        burst(enemy.x, enemy.y, enemy.color, 26, 260);
        sound("hit");
        break;
      }
    }
  }

  function playerBox() {
    const crouch = player.grounded ? (player.landTimer > 0 ? 8 : 0) : 4;
    return {
      x: player.x - 24,
      y: player.y - 122 + crouch,
      w: 44,
      h: 100 - crouch
    };
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function isGroundUnder(x) {
    for (const obstacle of obstaclePool) {
      if (!obstacle.active || obstacle.kind !== "pit") continue;
      const left = obstacle.x + 12;
      const right = obstacle.x + obstacle.w - 12;
      if (x > left && x < right) return false;
    }
    return true;
  }

  function spawnParticle(x, y, vx, vy, life, color, size, gravity = 0, line = false) {
    const p = particlePool[particleCursor];
    particleCursor = (particleCursor + 1) % particlePool.length;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.color = color;
    p.size = size;
    p.gravity = gravity;
    p.line = line;
    p.rot = randRange(0, Math.PI * 2);
  }

  function burst(x, y, color, count, force) {
    for (let i = 0; i < count; i += 1) {
      const angle = randRange(0, Math.PI * 2);
      const speed = randRange(force * 0.25, force);
      spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, randRange(0.28, 0.72), i % 4 === 0 ? "#ffffff" : color, randRange(2, 6), 500, i % 5 === 0);
    }
  }

  function getHandPosition() {
    return {
      x: player.x + 30,
      y: player.y - 88 + Math.sin(state.time * 8) * 2
    };
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const shake = state.shake > 0 ? state.shake : 0;
    const shakeX = shake ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake ? (Math.random() - 0.5) * shake * 0.65 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    if (!three.ready) drawFallbackBackground();
    else drawCloudOverlay();
    drawSpeedLines(false);
    drawTrack();
    drawObstacles();
    drawEnemies();
    drawAim();
    drawProjectiles();
    drawParticles();
    drawPlayer();
    drawSpeedLines(true);
    ctx.restore();

    ui.flash.style.backgroundColor = `rgba(255, 255, 255, ${clamp(state.flash, 0, 0.55)})`;
  }

  function drawFallbackBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#82dcff");
    sky.addColorStop(0.46, "#c7f5ff");
    sky.addColorStop(0.73, "#aee982");
    sky.addColorStop(1, "#63ca61");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff2a8";
    ctx.beginPath();
    ctx.arc(1005, 100, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawCloudOverlay();
    drawFallbackHills();
    drawFallbackDecor();
  }

  function drawCloudOverlay() {
    ctx.save();
    ctx.globalAlpha = three.ready ? 0.58 : 0.78;
    for (const cloud of clouds) {
      const x = wrap(cloud.x - state.backgroundOffset * cloud.speed, -190, WIDTH + 210);
      drawCloud(x, cloud.y, cloud.size, cloud.puff);
    }
    ctx.restore();
  }

  function drawCloud(x, y, size, puff) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    for (let i = 0; i < puff; i += 1) {
      const px = x + i * size * 0.45;
      const py = y + Math.sin(i * 1.9) * size * 0.12;
      ctx.moveTo(px + size * 0.45, py);
      ctx.ellipse(px, py, size * (0.42 + i * 0.04), size * (0.22 + (i % 2) * 0.08), 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawFallbackHills() {
    const farOffset = state.backgroundOffset * 0.12;
    const nearOffset = state.backgroundOffset * 0.23;
    drawHillLayer(farOffset, 392, "#8edc78", 160, 0.72);
    drawHillLayer(nearOffset, 430, "#63c979", 120, 0.85);
    ctx.fillStyle = "rgba(109, 205, 104, 0.58)";
    ctx.fillRect(0, 435, WIDTH, 110);
  }

  function drawHillLayer(offset, baseY, color, width, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    const start = -wrap(offset, 0, width);
    for (let x = start - width; x <= WIDTH + width; x += width) {
      ctx.quadraticCurveTo(x + width * 0.5, baseY - 75 - (x % 3) * 6, x + width, baseY);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFallbackDecor() {
    for (const decor of fallbackDecor) {
      const x = wrap(decor.x - state.backgroundOffset * decor.depth, -140, WIDTH + 160);
      const y = decor.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(decor.scale, decor.scale);
      if (decor.type === "tree") drawDecorTree(0, 0, decor.colorShift);
      else if (decor.type === "house") drawDecorHouse(0, 0, decor.colorShift);
      else if (decor.type === "fence") drawDecorFence(0, 0);
      else if (decor.type === "lamp") drawDecorLamp(0, 0);
      else if (decor.type === "flowers") drawDecorFlowers(0, 0);
      else drawDecorBush(0, 0, decor.colorShift);
      ctx.restore();
    }
  }

  function wrap(value, min, max) {
    const range = max - min;
    return ((((value - min) % range) + range) % range) + min;
  }

  function drawDecorTree(x, y, shift) {
    ctx.fillStyle = "#8b5837";
    roundRect(x - 7, y - 46, 14, 46, 5);
    ctx.fill();
    ctx.fillStyle = shift > 0.5 ? "#31b869" : "#49c96e";
    ctx.beginPath();
    ctx.ellipse(x, y - 62, 36, 45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.ellipse(x - 12, y - 76, 10, 18, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDecorHouse(x, y, shift) {
    ctx.fillStyle = shift > 0.5 ? "#ffe0a0" : "#ffd28a";
    roundRect(x - 28, y - 45, 56, 45, 5);
    ctx.fill();
    ctx.fillStyle = "#ff735e";
    ctx.beginPath();
    ctx.moveTo(x - 36, y - 44);
    ctx.lineTo(x, y - 76);
    ctx.lineTo(x + 36, y - 44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#54a8ff";
    roundRect(x - 11, y - 30, 22, 18, 4);
    ctx.fill();
  }

  function drawDecorFence(x, y) {
    ctx.strokeStyle = "#e7b56e";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 44, y - 22);
    ctx.lineTo(x + 44, y - 30);
    ctx.moveTo(x - 44, y - 6);
    ctx.lineTo(x + 44, y - 14);
    ctx.stroke();
    for (let i = -2; i <= 2; i += 1) {
      roundRect(x + i * 22 - 3, y - 40, 7, 42, 3);
      ctx.fillStyle = "#f1c77d";
      ctx.fill();
    }
  }

  function drawDecorLamp(x, y) {
    ctx.strokeStyle = "#39445a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 58);
    ctx.stroke();
    ctx.fillStyle = "#fff0a8";
    ctx.beginPath();
    ctx.arc(x, y - 68, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDecorBush(x, y, shift) {
    ctx.fillStyle = shift > 0.5 ? "#23a968" : "#3bc87a";
    ctx.beginPath();
    ctx.ellipse(x - 16, y - 8, 24, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 10, y - 11, 28, 21, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDecorFlowers(x, y) {
    drawDecorBush(x, y, 0.2);
    const colors = ["#ff6f8e", "#fff08a", "#6bb7ff"];
    for (let i = 0; i < 9; i += 1) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x - 28 + i * 7, y - 23 - (i % 2) * 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTrack() {
    const top = GROUND_Y - 28;
    ctx.save();
    ctx.fillStyle = "#5ccb63";
    ctx.fillRect(0, top + 22, WIDTH, HEIGHT - top);

    ctx.fillStyle = "#78da66";
    ctx.beginPath();
    ctx.moveTo(0, top - 12);
    for (let x = 0; x <= WIDTH + 60; x += 60) {
      ctx.quadraticCurveTo(x + 30, top - 22 + Math.sin((x + state.trackOffset) * 0.02) * 5, x + 60, top - 10);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#b87749";
    roundRect(-30, top + 12, WIDTH + 60, 104, 26);
    ctx.fill();
    ctx.fillStyle = "#e5b064";
    roundRect(-28, top, WIDTH + 56, 84, 24);
    ctx.fill();
    ctx.fillStyle = "#f4c979";
    roundRect(-22, top - 8, WIDTH + 44, 46, 18);
    ctx.fill();

    drawTrackMarks(top);
    drawPits(top);
    drawForegroundGrass();
    ctx.restore();
  }

  function drawTrackMarks(top) {
    const offset = wrap(state.trackOffset, 0, 92);
    for (let x = -offset - 60; x < WIDTH + 100; x += 92) {
      ctx.save();
      ctx.translate(x, top + 36);
      ctx.rotate(-0.05);
      ctx.fillStyle = "rgba(118, 84, 56, 0.22)";
      roundRect(0, 0, 48, 7, 5);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPits(top) {
    for (const obstacle of obstaclePool) {
      if (!obstacle.active || obstacle.kind !== "pit") continue;
      const x = obstacle.x;
      const w = obstacle.w;
      ctx.save();
      ctx.fillStyle = "#3b2b38";
      ctx.beginPath();
      ctx.moveTo(x + 14, top - 4);
      ctx.lineTo(x + w - 14, top - 4);
      ctx.quadraticCurveTo(x + w + 8, top + 22, x + w - 2, HEIGHT + 20);
      ctx.lineTo(x + 2, HEIGHT + 20);
      ctx.quadraticCurveTo(x - 8, top + 22, x + 14, top - 4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#7a4d35";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + 10, top - 2);
      ctx.lineTo(x + w - 10, top - 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x + 24 + i * w * 0.18, top + 42 + i * 22);
        ctx.lineTo(x + w - 40 - i * w * 0.08, top + 68 + i * 28);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawForegroundGrass() {
    const offset = wrap(state.trackOffset * 0.9, 0, 40);
    for (let x = -offset; x < WIDTH + 40; x += 40) {
      const y = GROUND_Y + 58 + Math.sin((x + state.time * 60) * 0.03) * 4;
      ctx.strokeStyle = x % 80 === 0 ? "#2daa58" : "#36b761";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + 22);
      ctx.quadraticCurveTo(x + 7, y, x + 16, y + 20);
      ctx.moveTo(x + 18, y + 24);
      ctx.quadraticCurveTo(x + 25, y + 4, x + 32, y + 24);
      ctx.stroke();
    }
  }

  function drawObstacles() {
    for (const obstacle of obstaclePool) {
      if (!obstacle.active || obstacle.kind === "pit") continue;
      if (obstacle.kind === "stone") drawStoneObstacle(obstacle);
      else if (obstacle.kind === "barrier") drawBarrierObstacle(obstacle);
      else drawCrateObstacle(obstacle);
    }
  }

  function drawCrateObstacle(o) {
    ctx.save();
    ctx.translate(o.x, o.y + Math.sin(o.wobble) * 1.5);
    ctx.fillStyle = "rgba(50, 42, 38, 0.22)";
    ctx.beginPath();
    ctx.ellipse(o.w * 0.5, o.h + 10, o.w * 0.52, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.color;
    roundRect(0, 0, o.w, o.h, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(70, 41, 28, 0.38)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(8, 10);
    ctx.lineTo(o.w - 8, o.h - 10);
    ctx.moveTo(o.w - 8, 10);
    ctx.lineTo(8, o.h - 10);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, o.w - 10, o.h - 10);
    ctx.restore();
  }

  function drawBarrierObstacle(o) {
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(Math.sin(o.wobble) * 0.025);
    ctx.fillStyle = "rgba(50, 42, 38, 0.22)";
    ctx.beginPath();
    ctx.ellipse(0, o.h * 0.52, o.w * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.color;
    roundRect(-o.w / 2, -o.h / 2, o.w, o.h, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let y = -o.h / 2 + 10; y < o.h / 2 - 4; y += 23) {
      ctx.save();
      ctx.translate(0, y);
      ctx.rotate(-0.45);
      roundRect(-o.w * 0.62, -4, o.w * 1.24, 8, 4);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawStoneObstacle(o) {
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.fillStyle = "rgba(50, 42, 38, 0.2)";
    ctx.beginPath();
    ctx.ellipse(0, o.h / 2 + 8, o.w * 0.45, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.moveTo(-o.w * 0.48, o.h * 0.15);
    ctx.quadraticCurveTo(-o.w * 0.35, -o.h * 0.48, 0, -o.h * 0.44);
    ctx.quadraticCurveTo(o.w * 0.44, -o.h * 0.36, o.w * 0.48, o.h * 0.1);
    ctx.quadraticCurveTo(o.w * 0.28, o.h * 0.46, -o.w * 0.36, o.h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-o.w * 0.25, -o.h * 0.2);
    ctx.quadraticCurveTo(-o.w * 0.05, -o.h * 0.34, o.w * 0.18, -o.h * 0.16);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemies() {
    for (const enemy of enemyPool) {
      if (!enemy.active) continue;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(Math.sin(enemy.phase) * 0.16);
      ctx.fillStyle = "rgba(30, 40, 60, 0.18)";
      ctx.beginPath();
      ctx.ellipse(0, enemy.radius + 24, enemy.radius * 1.25, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 1.2, 0);
      ctx.quadraticCurveTo(-enemy.radius * 0.2, -enemy.radius * 0.95, enemy.radius * 1.25, -enemy.radius * 0.18);
      ctx.quadraticCurveTo(enemy.radius * 0.38, enemy.radius * 0.85, -enemy.radius * 1.2, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.beginPath();
      ctx.arc(enemy.radius * 0.22, -enemy.radius * 0.18, enemy.radius * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#172033";
      ctx.beginPath();
      ctx.arc(enemy.radius * 0.28, -enemy.radius * 0.18, enemy.radius * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.76)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 0.4, enemy.radius * 0.36);
      ctx.lineTo(enemy.radius * 0.72, enemy.radius * 0.34);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (const shuriken of projectilePool) {
      if (!shuriken.active) continue;
      ctx.save();
      for (let i = 0; i < shuriken.trail.length; i += 1) {
        const point = shuriken.trail[i];
        ctx.globalAlpha = (i + 1) / shuriken.trail.length * 0.42;
        ctx.fillStyle = "#dff8ff";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5 + i * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.translate(shuriken.x, shuriken.y);
      ctx.rotate(shuriken.rot);
      drawShurikenShape(0, 0, 15);
      ctx.restore();
    }
  }

  function drawShurikenShape(x, y, r) {
    ctx.fillStyle = "#eaf8ff";
    ctx.strokeStyle = "#4a6680";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 4;
      const radius = i % 2 === 0 ? r : r * 0.38;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6bb7ff";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAim() {
    if (state.mode !== "playing") return;
    const hand = getHandPosition();
    const dx = input.mouseX - hand.x;
    const dy = input.mouseY - hand.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const ready = state.shurikenCooldown <= 0;
    ctx.save();
    ctx.globalAlpha = ready ? 0.82 : 0.34;
    ctx.strokeStyle = ready ? "#eaffff" : "#172033";
    ctx.lineWidth = ready ? 3 : 2;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(hand.x + ux * 96, hand.y + uy * 96);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ready ? "#27d19d" : "#ffffff";
    ctx.beginPath();
    ctx.arc(hand.x + ux * 108, hand.y + uy * 108, ready ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particlePool) {
      if (!p.active) continue;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.line) {
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-p.size * 2.2, 0);
        ctx.lineTo(p.size * 2.2, 0);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawPlayer() {
    const t = state.time;
    const air = !player.grounded;
    const jumpT = clamp(player.ollieTime / 0.62, 0, 1);
    const bob = player.grounded ? Math.sin(t * 14) * 2.2 : 0;
    const land = easeOut(player.landTimer / 0.2);
    const crouch = player.grounded ? land * 10 : Math.max(0, 1 - jumpT * 6) * 9;
    let boardAngle = Math.sin(t * 18) * 0.015;
    if (air) {
      if (player.ollieTime < 0.1) boardAngle = -0.38;
      else if (player.ollieTime < 0.22) boardAngle = 0.26;
      else boardAngle = Math.sin(player.ollieTime * 6) * 0.08;
    } else if (land > 0) {
      boardAngle = -0.04 * land;
    }

    const x = player.x;
    const y = player.y + bob + crouch;
    ctx.save();
    ctx.globalAlpha = player.hitFlash > 0 ? 0.74 + Math.sin(t * 60) * 0.2 : 1;

    if (isGroundUnder(player.x + 10)) {
      ctx.fillStyle = "rgba(28, 32, 42, 0.2)";
      ctx.beginPath();
      ctx.ellipse(x + 5, GROUND_Y + 16, air ? 36 : 54, air ? 8 : 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawWindRibbon(x, y, air);
    drawBoard(x, y, boardAngle);
    drawSkaterBody(x, y, crouch, boardAngle, air, jumpT);
    ctx.restore();
  }

  function drawWindRibbon(x, y, air) {
    const speedAlpha = clamp((state.speed - 300) / 420, 0.25, 0.9);
    ctx.save();
    ctx.globalAlpha = state.mode === "playing" ? speedAlpha : 0.3;
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const lines = air ? 4 : 6;
    for (let i = 0; i < lines; i += 1) {
      const yy = y - 92 + i * 17 + Math.sin(state.time * 8 + i) * 5;
      const len = 54 + state.difficulty * 4 + i * 7;
      ctx.beginPath();
      ctx.moveTo(x - 62 - i * 9, yy);
      ctx.quadraticCurveTo(x - len - 45, yy - 8, x - len - 95, yy + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoard(x, y, angle) {
    ctx.save();
    ctx.translate(x, y - 7);
    ctx.rotate(angle);
    ctx.fillStyle = "#232838";
    roundRect(-52, -7, 104, 14, 8);
    ctx.fill();
    ctx.fillStyle = "#6dd2ff";
    roundRect(-40, -11, 80, 8, 7);
    ctx.fill();
    ctx.strokeStyle = "#151926";
    ctx.lineWidth = 3;
    ctx.stroke();

    drawWheel(-33, 10, player.wheelSpin);
    drawWheel(34, 10, player.wheelSpin + 1.5);
    ctx.restore();
  }

  function drawWheel(x, y, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#1f2635";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d9f4ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(spin);
    ctx.strokeStyle = "#89d8ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 7);
    ctx.stroke();
    ctx.restore();
  }

  function drawSkaterBody(x, y, crouch, boardAngle, air, jumpT) {
    ctx.save();
    ctx.translate(x, y - 16);
    const lean = air ? lerp(-0.12, 0.1, jumpT) : -0.15 - clamp((state.speed - 360) / 800, 0, 0.08);
    ctx.rotate(lean);

    const hipY = -32 + crouch * 0.22;
    const chestY = -78 + crouch * 0.55;
    const headY = -121 + crouch * 0.42;
    const armSwing = Math.sin(state.time * 13) * (air ? 0.18 : 0.28);

    ctx.strokeStyle = "#171b28";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(-15, hipY);
    ctx.lineTo(-28, -8 + Math.sin(boardAngle) * 4);
    ctx.moveTo(12, hipY + 2);
    ctx.lineTo(28, -7 - Math.sin(boardAngle) * 5);
    ctx.stroke();

    ctx.strokeStyle = "#202636";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-28, -8);
    ctx.lineTo(-43, -6);
    ctx.moveTo(28, -7);
    ctx.lineTo(42, -7);
    ctx.stroke();

    ctx.fillStyle = "#171b28";
    ctx.beginPath();
    ctx.ellipse(0, chestY, 24, 36 - crouch * 0.08, -0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#263047";
    ctx.beginPath();
    ctx.ellipse(7, chestY - 8, 12, 24, -0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#171b28";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-16, chestY - 18);
    ctx.quadraticCurveTo(-46, chestY - 8 + armSwing * 16, -42, chestY + 25);
    ctx.moveTo(17, chestY - 18);
    ctx.quadraticCurveTo(46, chestY - 20 - armSwing * 14, 36, chestY + 19);
    ctx.stroke();

    ctx.strokeStyle = "#e3485f";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-15, chestY - 28);
    ctx.quadraticCurveTo(-54, chestY - 45 + Math.sin(state.time * 9) * 5, -76, chestY - 33);
    ctx.stroke();

    drawHeadAndHair(0, headY);
    ctx.restore();
  }

  function drawHeadAndHair(x, y) {
    ctx.save();
    ctx.translate(x, y);
    const hairWave = Math.sin(state.time * 12) * 4;
    ctx.strokeStyle = "#4a2f25";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-10 - i * 2, 10 + i * 2);
      ctx.quadraticCurveTo(-32 - i * 7, 7 + hairWave, -49 - i * 6, 18 + i * 4 + hairWave * 0.35);
      ctx.stroke();
    }

    ctx.fillStyle = "#f4b887";
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 24, 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#171b28";
    ctx.beginPath();
    ctx.ellipse(0, -2, 23, 17, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    roundRect(-24, -3, 48, 16, 7);
    ctx.fill();

    ctx.fillStyle = "#101521";
    ctx.beginPath();
    ctx.ellipse(2, -23, 23, 11, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#171b28";
    ctx.beginPath();
    ctx.ellipse(18, -21, 23, 7, 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(8, 3, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#172033";
    ctx.beginPath();
    ctx.arc(10, 3, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSpeedLines(front) {
    if (state.mode !== "playing" && state.mode !== "countdown") return;
    const amount = Math.floor(clamp(state.difficulty + 2, 2, 9));
    ctx.save();
    ctx.globalAlpha = front ? 0.16 : 0.18;
    ctx.strokeStyle = front ? "#ffffff" : "#dff8ff";
    ctx.lineWidth = front ? 3 : 2;
    ctx.lineCap = "round";
    for (let i = 0; i < amount; i += 1) {
      const y = 160 + wrap(i * 71 + state.trackOffset * (front ? 0.7 : 0.45), 0, 330);
      const x = front ? wrap(WIDTH - state.trackOffset * 1.4 - i * 173, -260, WIDTH + 260) : player.x - 185 - i * 42;
      const len = 70 + i * 12 + state.difficulty * 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len, y + Math.sin(i) * 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function updateUi(dt) {
    state.uiTimer -= dt;
    if (state.uiTimer > 0) return;
    state.uiTimer = 0.06;
    ui.score.textContent = formatNumber(state.score);
    ui.distance.textContent = `${formatNumber(state.distance)} m`;
    ui.speed.textContent = `${(state.speed / 340).toFixed(1)}x`;
    const progress = 1 - clamp(state.shurikenCooldown / 0.5, 0, 1);
    ui.cooldownFill.style.transform = `scaleX(${progress})`;
    ui.cooldownText.textContent = progress >= 1 ? "Ready" : `${Math.ceil(state.shurikenCooldown * 10) / 10}s`;
  }

  function update(dt) {
    state.time += dt;
    state.flash = Math.max(0, state.flash - dt * 2.7);
    state.shake = Math.max(0, state.shake - dt * 30);

    updateVisualMotion(dt);
    updateThree(dt);
    updateMusic(dt);

    if (state.mode === "countdown") {
      updateCountdown(dt);
      updateParticles(dt);
    } else if (state.mode === "playing") {
      updateRun(dt);
    } else if (state.mode === "gameover") {
      updateParticles(dt);
    }

    updateUi(dt);
  }

  function loop(now) {
    const dt = Math.min(1 / 30, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindEvents() {
    window.addEventListener("resize", resize);

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === " " || key === "arrowup" || key === "w") {
        event.preventDefault();
        unlockAudio();
        input.jumpHeld = true;
        if (!event.repeat) requestJump();
      } else if (key === "p" || key === "escape") {
        event.preventDefault();
        unlockAudio();
        togglePause();
      } else if (key === "r" && state.mode === "gameover") {
        event.preventDefault();
        unlockAudio();
        sound("button");
        startRun({ skipCountdown: false });
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key === " " || key === "arrowup" || key === "w") {
        input.jumpHeld = false;
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      pointerToGame(event);
      input.pointerInside = true;
    });

    canvas.addEventListener("pointerleave", () => {
      input.pointerInside = false;
    });

    canvas.addEventListener("pointerdown", (event) => {
      pointerToGame(event);
      unlockAudio();
      if (event.button === 0) throwShuriken();
    });

    const click = (handler) => () => {
      unlockAudio();
      sound("button");
      handler();
    };

    ui.play.addEventListener("click", click(() => startRun()));
    ui.records.addEventListener("click", click(openRecords));
    ui.quit.addEventListener("click", click(() => {
      state.mode = "quit";
      showScreen("quit");
      setHudVisible(false);
      setHintVisible(false);
    }));
    ui.backRecords.addEventListener("click", click(goMenu));
    ui.resume.addEventListener("click", click(togglePause));
    ui.pauseMenu.addEventListener("click", click(goMenu));
    ui.restart.addEventListener("click", click(() => startRun()));
    ui.gameOverMenu.addEventListener("click", click(goMenu));
    ui.quitBack.addEventListener("click", click(goMenu));
    ui.mute.addEventListener("click", () => {
      unlockAudio();
      audio.muted = !audio.muted;
      writeMute();
      setMuteButton();
      if (!audio.muted) sound("button");
    });
  }

  function init() {
    bindEvents();
    resize();
    setMuteButton();
    setHudVisible(false);
    setHintVisible(false);
    showScreen("menu");
    loadThreeAsync();
    requestAnimationFrame(loop);

    const params = new URLSearchParams(window.location.search);
    if (params.has("autoplay")) {
      startRun({ skipCountdown: params.has("skipCountdown") });
    }
  }

  init();
})();

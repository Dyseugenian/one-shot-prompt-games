# Skate Ninja Runner

## Codex GPT-5.5 Extra High

### Prompt (Original short prompt was extended via AI): 

You are an experienced game developer. Create a complete 2.5D web game from scratch for desktop browsers in a 16:9 format. The game is called **Skate Ninja Runner**.

I need not a prototype or a placeholder, but the most complete, playable, visually pleasant, and functional version of the game possible within a single response. I do not plan to give any additional prompts for improvements, so implement all missing details yourself while preserving the spirit of the description. Do not ask clarifying questions — immediately implement the game.

## Output Format

Generate the project using exactly 3 files:

1. `index.html`
2. `style.css`
3. `game.js`

In your response, output the full code for each file in a separate code block. The game must run locally in a browser after saving these three files. You may use CDN libraries. Preferably use **Three.js via CDN** or another suitable WebGL library to achieve the 2.5D effect. Do not use external assets that need to be downloaded manually. All graphical assets, textures, simple sprites, effects, and sounds should be created programmatically through JS, Canvas, Web Audio API, and WebGL whenever possible.

## General Game Idea

**Skate Ninja Runner** is an endless high-speed 2.5D runner. The main character is a ninja boy in a black ninja outfit and a black cap, riding a skateboard. The player must survive for as long as possible, gaining points over time and distance traveled. The game cannot be completed: it endlessly becomes harder, speed increases, obstacles become more frequent, dangerous combinations appear, and flying enemy objects appear more often.

All game UI, menus, labels, buttons, Records, Game Over screens, and hints must be **in English**.

## Visual Style

Create a bright, colorful, fairytale-like anime setting, but with a cartoonish Disney/Pixar-like presentation. The game should feel like a small finished product, not a technical placeholder.

Atmosphere:

* blue sky;
* soft clouds;
* green fields;
* grass and bushes;
* distant hills;
* trees;
* occasional houses;
* fairytale anime summer vibe;
* rich but pleasant colors;
* soft lighting;
* a feeling of speed and depth.

The game must feel truly **2.5D**:

* gameplay happens from a side-view perspective;
* the character may be a sprite or a 2D figure;
* the background and environment should have depth through WebGL/Three.js;
* use multiple parallax layers;
* add simple 3D background objects: houses, trees, hills, fences, rocks, decorative objects;
* background objects should appear and disappear procedurally, creating variety.

## Camera and Scene

Use a fixed side-view runner camera. The hero stays roughly in the left/center part of the screen while the world moves from right to left. The camera should slightly react to jumps and speed, but must not interfere with gameplay.

The screen is designed for 16:9 desktop. No adaptation for other aspect ratios is required, but the game should remain centered and preserve 16:9 when the browser window is resized.

## Main Menu

Create a simple but beautiful start menu.

The main screen must include:

* game title: **Skate Ninja Runner**;
* 3 menu items:

  * **Play**
  * **Records**
  * **Quit**

`Play` starts the game.
`Records` opens the score history screen.
`Quit` may show a nice message such as “Thanks for playing!” or return to a locked state, since browsers do not reliably allow closing tabs.

## Records

The **Records** tab must contain score history:

* score amount;
* date and time of the result;
* results saved in `localStorage`;
* show the last 10 results;
* add a **Back** button;
* if there are no records, show “No records yet”.

After Game Over, the current result must be saved to Records.

## Gameplay UI

During gameplay, display:

* current score;
* current distance;
* speed or difficulty level;
* control hints at the beginning of the game;
* shuriken cooldown indicator;
* Game Over screen with final result and buttons **Restart** and **Main Menu**.

The UI should look neat, with cartoon-style panels, readable fonts, soft shadows, and good contrast.

## Main Character

The main character is a ninja boy:

* black ninja outfit;
* black cap;
* medium-length hair visible under the cap;
* hair must flow backward while moving;
* the hero rides a skateboard;
* skateboard wheels must spin;
* the hero’s pose should be dynamic;
* the body should slightly bounce while moving;
* wind effects should become stronger as speed increases.

The main character may be implemented as a sprite, canvas texture, a set of 2D/3D primitives, or a hybrid. The most important thing is that he is recognizable: a black-clad ninja skater wearing a cap and riding a skateboard.

## Character Animations

Pay special attention to the skater’s animation.

Required animations:

### Riding

During regular movement:

* medium-length hair flows backward under the cap;
* wind/speed lines appear behind the skater’s body;
* skateboard wheels rotate;
* body slightly leans forward;
* feet stand on the board;
* the board slightly vibrates/bounces;
* clothes may slightly move from the speed.

### Jump / Ollie

When the hero jumps, he must perform an **OLLIE**, not just fly upward.

The Ollie animation must include these phases:

1. **Crouch / preparation** — the hero slightly crouches before takeoff.
2. **Pop** — the rear part of the skateboard sharply goes down while the front rises.
3. **Drag / level out** — the front foot appears to pull the board upward, leveling it in the air.
4. **Airborne** — the hero and skateboard fly together, with the board under the feet.
5. **Landing** — the hero lands, knees bend, and the board slightly compresses/bounces.
6. **Recovery** — the hero returns to the regular riding stance.

Important: jump height must always be the same regardless of how long the jump key is held. Holding the key must not make the jump higher.

## Controls

Desktop controls:

* **Space** — jump / ollie;
* **W** or **Arrow Up** — alternative jump;
* **Mouse aim** — aim the shuriken throw direction;
* **Left Mouse Button** — throw shuriken;
* **P** or **Esc** — pause/resume;
* **R** on Game Over — restart.

Special jump behavior:

* if the player presses and holds Space, the hero jumps immediately when on the ground;
* if Space is held during the air phase, then after landing the hero must instantly jump again as soon as possible;
* implement jump buffering / hold-to-auto-jump;
* the jump must not trigger in the air as a double jump;
* jump height is always fixed.

## Jump Physics

Create pleasant arcade-style physics:

* fixed jump height;
* smooth parabola;
* fairly fast takeoff;
* clear landing;
* no floaty feel;
* the player should feel in control.

Be sure to calculate maximum jump height and jump distance at the current game speed. These values must be used for smart procedural obstacle generation.

## Core Mechanics

The player moves forward endlessly. The world moves from right to left.

The player must:

* jump over obstacles;
* jump over pits;
* avoid dangerous objects;
* shoot down flying enemies/objects with shurikens;
* survive as long as possible.

Collision with a dangerous obstacle, falling into a pit, or being hit by a flying enemy causes Game Over.

## Obstacles

Add different obstacle types:

* low crates;
* rocks;
* logs;
* bamboo barriers;
* cartoon-style traffic cones;
* pits in the ground;
* longer pits at later stages;
* double obstacle combinations;
* obstacles of different heights, but always fair.

Procedural generation must be smart:

* obstacles must be realistically passable;
* do not create impossible combinations;
* account for current speed;
* account for maximum jump distance;
* account for jump height;
* account for player reaction time;
* keep minimum safe gaps;
* as difficulty grows, reduce gaps, but never below a fair minimum;
* pits must not be wider than the allowed jump distance;
* obstacle height must not exceed jump height;
* in obstacle combinations, there must be either a chance to land between them or clear them with one understandable jump arc.

Create a function or system that checks obstacle validity based on jump physics and current speed.

## Flying Enemies / Objects

Sometimes flying objects or enemies appear from the right. They must have their own movement trajectory aimed toward the skater. Their movement must not simply depend on the general world scrolling.

Examples:

* small flying ninja drones;
* paper demons;
* flying masks;
* magical lanterns;
* spirit birds.

Requirements:

* they fly using their own trajectory;
* they can move in a straight line, arc, sine wave, or diagonal path;
* some enemies fly at a height where they need to be shot down;
* some may force the player to jump or visually dodge, but the main mechanic is shooting them with shurikens;
* if an enemy hits the hero, it causes Game Over;
* if a shuriken hits an enemy, the enemy is destroyed;
* destruction must create a small effect: flash, particles, sound.

## Shurikens

The hero can throw shurikens.

Mechanics:

* direction is controlled by the mouse;
* the shuriken flies toward the cursor;
* it uses ballistic motion;
* trajectory must account for initial velocity, gravity, and throw angle;
* cooldown is **0.5 seconds**;
* the player cannot spam faster than the cooldown;
* add a UI readiness indicator;
* the shuriken must spin while flying;
* when it hits an enemy, the enemy is destroyed;
* when it misses, it disappears outside the screen or after its lifetime expires;
* add a throw sound.

Make throwing feel satisfying: the player should be able to see the approximate throw direction from the cursor. You may add a subtle aim indicator or small direction arrow.

## Difficulty

The game must gradually become harder.

Over time:

* movement speed increases;
* score grows faster;
* obstacles appear more often;
* pits become longer, but remain passable;
* obstacle combinations become more complex;
* flying enemies appear more often;
* enemy trajectories become more dangerous;
* reaction time decreases, but never to an unfair level.

Difficulty must grow smoothly without sudden spikes. Create a `difficulty` parameter based on time/distance.

## Score

Score is awarded for:

* survival time;
* distance traveled;
* destroying flying enemies;
* possibly a small bonus for a long no-mistake streak.

Display the score during gameplay. After Game Over, show the final score.

## Sounds and Music

All main actions must have sound effects.

Required sounds:

* game start;
* menu button click;
* jump / ollie;
* landing;
* shuriken throw;
* shuriken hit;
* enemy destruction;
* collision / Game Over;
* background movement/wind sound;
* speed increase.

Use the Web Audio API to generate simple sounds programmatically. No external audio files are required.

Create simple thematic music:

* light ninja/anime/arcade motif;
* music must loop during gameplay;
* as difficulty grows, the tempo or intensity of the music should slightly increase;
* do not make the sound annoying;
* add the ability to enable sound after the first user interaction so the browser allows `AudioContext`.

Add a mute/unmute button or icon.

## Optimization

It is very important for the game to run smoothly without lag.

Requirements:

* use object pooling for frequently created objects: obstacles, particles, shurikens, enemies;
* remove or reuse old elements outside the screen;
* do not create heavy objects every frame;
* avoid unnecessary DOM operations in the game loop;
* use `requestAnimationFrame`;
* account for delta time;
* generation of new elements must feel seamless;
* background scrolling must be smooth;
* collisions must be accurate enough but not overly expensive;
* the game should feel stable on a normal desktop browser.

## Collisions

Implement clear hitbox/collision box logic for:

* hero;
* obstacles;
* pits;
* flying enemies;
* shurikens.

The hero hitbox should be fair, not too large. You may add collision feedback visually when hit.

On Game Over:

* stop the game world;
* play a sound;
* show final score;
* save the result to Records;
* allow Restart or Main Menu.

## Particles and Effects

Add simple but pleasant effects:

* dust under the wheels;
* speed lines / wind trails behind the skater;
* flash when throwing a shuriken;
* shuriken trail;
* particles when destroying an enemy;
* dust on landing;
* collision effect;
* light screen shake on Game Over;
* stronger speed effect at later difficulty levels.

## Procedural Background

The background must be varied.

Layers:

1. Distant sky and clouds.
2. Distant hills.
3. Fields and trees.
4. Houses and decorative objects.
5. Foreground ground/road layer.
6. Grass, rocks, and small details.

Add simple procedural generation of background objects:

* different houses;
* trees of different sizes;
* bushes;
* fences;
* lanterns;
* rocks;
* flowers;
* decorative elements.

Background objects must not interfere with gameplay objects. They should enhance the feeling of a living world.

## Ground and Track

The skateboard must ride on a clear surface:

* a fairytale-style road/path;
* green grass at the edges;
* pits must be visually clear;
* pit edges must be readable;
* obstacles must stand out from the background.

## Pause

Add Pause:

* **P** or **Esc** key;
* during pause, the game stops;
* an overlay appears with the text **Paused**;
* buttons: **Resume** and **Main Menu**.

## Finished Product Requirements

The game must feel like a complete mini-game:

* beautiful start menu;
* smooth gameplay;
* pleasant character animation;
* fair obstacle generation;
* progressive difficulty;
* Records via `localStorage`;
* Game Over screen;
* sounds and music;
* visual effects;
* clean UI;
* no obvious placeholders;
* no empty TODOs;
* everything must be implemented directly in the code.

## Important Restrictions

* UI and in-game text must be English only.
* Desktop web 16:9 only.
* Main format: 3 files — HTML, CSS, JS.
* CDN libraries are allowed.
* Do not use assets that must be manually downloaded.
* Do not create mobile adaptation.
* Do not create networking.
* Do not create a server.
* Do not create authentication.
* Do not create a level editor.
* Do not explain the architecture in too much detail — the main priority is finished functionality.

## Additional Improvements to Add Yourself

If something is logically needed to make the game feel complete, add it yourself:

* tutorial hint before the start;
* smooth fade between menu and gameplay;
* hover/click effects for buttons;
* save mute setting in `localStorage`;
* small countdown before starting;
* visual difficulty indicator;
* combo or bonus for destroying enemies;
* beautiful Game Over presentation;
* restart without reloading the page;
* small camera and effects polish.

## Final Requirement

Create the most complete implementation possible in one response. Do not limit yourself to a minimal example. Focus on implementing all mechanics and the overall game feel. The code may be simple, but the game must be playable, smooth, visually interesting, and feel finished.

Output only:

1. `index.html`
2. `style.css`
3. `game.js`

Each file must be provided as a separate complete code block.


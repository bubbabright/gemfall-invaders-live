# Gemfall Invaders

A Space Invaders game for one person. Phone or keyboard.

**Play it: [https://invaders.moopit.fun](https://invaders.moopit.fun)**

That name is the front door. Until the DNS record is in place, the same build is also on this repo's Netlify address, linked from the About section on GitHub once the first build is up.

I made this for family and friends. One pilot. The ships, the bunkers, and the music are made in the browser while you play. Nothing to install. No account. Your high score stays on the device you played on.

## How to play

| | Move | Fire | Pause |
|---|---|---|---|
| Keyboard | `A` `D` or the arrow keys to slide. `W` `S` or up and down to push in and drop back | `Space` or `Z` | `P` or `Esc` |
| Phone | Drag the thumb pad. Up pushes you toward the swarm | `FIRE`, or `AUTO` if you want the button held | The pause button on the dock |

Pushing in shortens your shot. Dropping back gives you longer to see theirs. Aliens only fire from the front ship in each column.

The swarm is five rows of eleven. It speeds up as you thin it out. Waves do not end. The run ends when they cross the line, or you run out of lives.

Typing a pilot name does not fly the ship. `P` in that box does not pause. `Esc` closes the box.

## Guns

You hold one gun at a time.

- **Normal** is a single bolt down the middle.
- **Rapid** is two gold barrels.
- **Spread** is three bolts.
- **Beam** is a thicker green shot. It goes through aliens and stops on a bunker.
- **Shield** is a bubble that takes one hit for you.
- **EMP** is not a gun. It clears the front row and leaves the gun you already have.

Bigger ships drop these more often. The saucer always drops one. Four bunkers last the whole run, cracks included. The next sortie builds a fresh set.

An extra life comes at every 5000 points. You can hold five. After a hit you get a short breath before they can hit you again. Points stack when you keep hitting things inside a few seconds, up to five times, and the number floats where the ship was.

The dock along the bottom has the themes and the sound. Opening it pauses the game. Sound is generated as you play. There are no audio files.

## Run it on your machine

```bash
npm install
npm run dev
```

That serves the game at http://127.0.0.1:3000, and on your local network.

```bash
npm run build     # the files Netlify publishes, in dist/
npm run lint      # typecheck
npm run test:e2e  # browser tests, Chromium
```

## Bugs and ideas

Please open an [issue](https://github.com/bubbabright/gemfall-invaders-live/issues).

A bug is most useful with three things: what you expected, what happened, and whether you were on a phone or a keyboard. The wave number helps. A screenshot helps.

Feature ideas are welcome, including the ones that are just "this would be fun." I am one person tinkering on this for the people I know. I may not build it. I still want to hear it.

## For the curious

This repository is the published game. It changes when a version is ready to play.

The game itself is Three.js, in `src/game/GameEngine.ts`. Screens are React, in `src/`. Sound is `src/audio/SoundSynth.ts`. The six themes are in `src/game/themes.ts`.

Netlify runs `npm run build` and serves `dist/`. Node 22 is pinned in `netlify.toml`. A refresh on any path comes back to the game.

Dev builds expose `window.__gemfall` so the tests can fly the ship. Production builds leave that out.

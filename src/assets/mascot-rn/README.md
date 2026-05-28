# Planora Mascot — React Native

Drop-in animated mascot component for React Native. **9 variants**, all on the
native thread, no extra libraries beyond React Native itself.

## Install

1. Copy `Mascot.js` into your project (e.g. `src/components/Mascot.js`)
2. Copy `assets/mascot.png` and `assets/mascot-closed.png` into the matching
   folder next to it, OR update the two `require('./assets/...')` paths inside
   Mascot.js to point at your asset folder.

## Use

```jsx
import Mascot from './Mascot';

// Default — always-on alive idle (float + breathe + sway + blink)
<Mascot />

// Specific gesture
<Mascot variant="jump" />
<Mascot variant="wave" />
<Mascot variant="wiggle" />
<Mascot variant="bounce" />

// Interactive button
<Mascot variant="tap" onTap={() => console.log('pressed!')} />

// Custom size + style
<Mascot size={80} style={{ marginVertical: 24 }} />

// Disable blink
<Mascot blink={false} />
```

## Variants

| Variant   | When to use                                       |
| --------- | ------------------------------------------------- |
| `alive`   | **Default.** Splash, home, header, empty state — always-on idle |
| `float`   | Subtle bob only — for tight spaces                |
| `breathe` | Soft scale pulse                                  |
| `sway`    | Continuous pendulum tilt                          |
| `bounce`  | Happy hop — loading, success                      |
| `jump`    | Big airborne hop — celebrations, level-up         |
| `wiggle`  | Side-to-side dance — streaks, celebration         |
| `wave`    | Greeting wave — onboarding, splash                |
| `tap`     | Interactive button — FAB, mascot-as-cta           |

All variants blink every ~5s by default. Pass `blink={false}` to disable.

## Props

| Prop      | Type     | Default   | Notes                                  |
| --------- | -------- | --------- | -------------------------------------- |
| `size`    | number   | `140`     | Width and height of the mascot in px   |
| `variant` | string   | `'alive'` | Which animation (see above)            |
| `blink`   | boolean  | `true`    | Whether to play the periodic blink     |
| `onTap`   | function | —         | Only for `variant="tap"`               |
| `style`   | object   | —         | Extra View style on the wrapper        |

## Switching variants

You can change `variant` on the fly — the component resets and starts the new
loop. Common pattern:

```jsx
const [mood, setMood] = useState('alive');

// after a user completes a lesson:
setMood('jump');
setTimeout(() => setMood('alive'), 3000);

return <Mascot variant={mood} />;
```

## Files

- `Mascot.js`              — the component
- `assets/mascot.png`        — eyes open (the original)
- `assets/mascot-closed.png` — eyes closed (used for the blink frame)

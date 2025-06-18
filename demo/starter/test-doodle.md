# Test DoodleSvg - Uruguay Flag

<DoodleSvg src="/uy.svg" :duration="4000" debug />

Debug mode enabled to see console output.

---

# Issues to Check

1. **Stroke Width**: Should be 0.6 (from SVG) not 2 (default)
2. **Fill Color**: Should be #fcd116 (yellow) from parent group
3. **Use Elements**: All sun rays should animate

---

# Manual Test

<DoodleSvg src="/uy.svg" :duration="5000" :autoplay="false" debug />

<button @click="$refs.manualSvg?.animate()">Start Animation</button>
<button @click="$refs.manualSvg?.reset()">Reset</button>

<style>
button {
  margin: 10px;
  padding: 10px;
  font-size: 16px;
}
</style>

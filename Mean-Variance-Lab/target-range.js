(() => {
  const slider = document.getElementById('target');
  const box = document.getElementById('targetBox');
  const reset = document.getElementById('resetBtn');
  if (!slider || !box || typeof targetBounds !== 'function' || typeof update !== 'function') return;

  const baseTargetBounds = targetBounds;
  let selectedTarget = Number(slider.value) / 100;
  let expandedLo = null;
  let expandedHi = null;

  targetBounds = function(M) {
    const base = baseTargetBounds(M);
    let lo = base.lo;
    let hi = base.hi;

    if (Number.isFinite(expandedLo)) lo = Math.min(lo, expandedLo);
    if (Number.isFinite(expandedHi)) hi = Math.max(hi, expandedHi);

    if (Number.isFinite(selectedTarget)) {
      const baseSpan = Math.max(hi - lo, 0.0002);
      const pad = Math.max(baseSpan * 0.08, Math.abs(selectedTarget - M.gmMu) * 0.05, 0.00005);
      if (selectedTarget < lo) lo = selectedTarget - pad;
      if (selectedTarget > hi) hi = selectedTarget + pad;
    }
    return {lo, hi};
  };

  function expandSliderNearEdge() {
    const v = Number(slider.value);
    const lo = Number(slider.min);
    const hi = Number(slider.max);
    const step = Math.max(Number(slider.step) || 0, 0.0001);
    const span = Math.max(hi - lo, step * 20);
    const threshold = Math.max(step * 2, span * 0.015);

    if (v >= hi - threshold) expandedHi = (hi + span * 0.5) / 100;
    if (v <= lo + threshold) expandedLo = (lo - span * 0.5) / 100;
  }

  slider.oninput = () => {
    selectedTarget = Number(slider.value) / 100;
    expandSliderNearEdge();
    update();
  };

  box.onchange = () => {
    const pctValue = Number(box.value);
    if (!Number.isFinite(pctValue)) return;

    selectedTarget = pctValue / 100;

    // HTML range inputs clamp values outside min/max. Expand first, then assign.
    if (pctValue > Number(slider.max)) slider.max = String(pctValue);
    if (pctValue < Number(slider.min)) slider.min = String(pctValue);
    slider.value = String(pctValue);
    update();
  };

  const originalReset = reset && reset.onclick;
  if (reset && originalReset) {
    reset.onclick = () => {
      selectedTarget = NaN;
      expandedLo = null;
      expandedHi = null;
      originalReset();
      selectedTarget = Number(slider.value) / 100;
    };
  }
})();

(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const labels = {
    market: "B-spline-shaped browser surface",
    polynomial: "Polynomial browser surface",
    heston: "Heston-shaped browser surface"
  };
  let frame = 0;
  function sync() {
    const model = $("surfaceModel")?.value || "market";
    const confidence = Math.round(Number($("confidence")?.value || 0.95) * 100);
    const seed = $("seed")?.value || "2311";
    const changes = [
      [$("experimentName"), `SPX · ${labels[model]} · ${confidence}% VaR`],
      [$("surfaceChartTitle"), labels[model]],
      [$("metricRole"), "Browser formula"],
      [$("metricRoleNote"), "not fitted from WRDS quotes"],
      [$("footerFingerprint"), `Seed ${seed}`]
    ];
    changes.forEach(([element, text]) => {
      if (element && element.textContent !== text) element.textContent = text;
    });
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(sync));
  }
  document.addEventListener("input", schedule, true);
  document.addEventListener("change", schedule, true);
  document.addEventListener("click", schedule, true);
  ["experimentName", "surfaceChartTitle", "metricRole", "metricRoleNote", "footerFingerprint"].forEach(id => {
    const element = $(id);
    if (element) new MutationObserver(schedule).observe(element, {childList: true, characterData: true, subtree: true});
  });
  schedule();
})();

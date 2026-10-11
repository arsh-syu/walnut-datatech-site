// ClickSpark — React Bits' <ClickSpark /> (https://reactbits.dev, MIT + Commons Clause) in plain JavaScript:
// a canvas over its parent on which short lines fly out from a point and shrink as they go. The component
// bursts where the person clicks; here `burst(x, y)` is also exposed, so a success can set the sparks off.
//
//   const spark = mountClickSpark(stage, { sparkColor: '#7d62ff', sparkCount: 12 });
//   spark.burst(cx, cy);   // canvas coordinates (the parent's box)

const EASE = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  'ease-out': (t) => t * (2 - t),
};

export function mountClickSpark(parent, { sparkColor = '#fff', sparkSize = 10, sparkRadius = 15, sparkCount = 8, duration = 400, easing = 'ease-out', extraScale = 1.0, onClick = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'click-spark';
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  parent.append(canvas);
  const ctx = canvas.getContext('2d');
  const easeFunc = EASE[easing] || EASE['ease-out'];
  let sparks = [];
  let raf = 0;
  let resizeTimeout;

  const resizeCanvas = () => {
    const { width, height } = parent.getBoundingClientRect();
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 100);
  });
  ro.observe(parent);
  resizeCanvas();

  const draw = (timestamp) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparks = sparks.filter((spark) => {
      const elapsed = timestamp - spark.startTime;
      if (elapsed >= duration) return false;
      const progress = elapsed / duration;
      const eased = easeFunc(progress);
      const distance = eased * sparkRadius * extraScale;
      const lineLength = sparkSize * (1 - eased);
      const x1 = spark.x + distance * Math.cos(spark.angle);
      const y1 = spark.y + distance * Math.sin(spark.angle);
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);
      ctx.strokeStyle = sparkColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      return true;
    });
    raf = sparks.length ? requestAnimationFrame(draw) : 0; // sleeps once the last spark has faded
  };

  const burst = (x, y) => {
    const now = performance.now();
    sparks.push(...Array.from({ length: sparkCount }, (_, i) => ({ x, y, angle: (2 * Math.PI * i) / sparkCount, startTime: now })));
    if (!raf) raf = requestAnimationFrame(draw);
  };
  const handleClick = (e) => {
    const rect = canvas.getBoundingClientRect();
    burst(e.clientX - rect.left, e.clientY - rect.top);
  };
  if (onClick) parent.addEventListener('click', handleClick);

  return {
    canvas,
    burst,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearTimeout(resizeTimeout);
      parent.removeEventListener('click', handleClick);
      canvas.remove();
    },
  };
}

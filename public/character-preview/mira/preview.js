/* Standalone art review. No game simulation, save data, or shared character registry. */
(() => {
  'use strict';
  const manifest = window.MIRA_PREVIEW;
  const find = id => document.getElementById(id);
  const stage = find('stage');
  const context = stage.getContext('2d');
  const images = {};
  const state = { action: 'walk', direction: 'SW', time: 0, frame: 0, paused: false, speed: 1, scale: 2, distance: 0, last: null, ready: false };
  const directions = manifest.directions;
  const directionNames = { SW: '왼쪽 앞', NW: '왼쪽 뒤', NE: '오른쪽 뒤', SE: '오른쪽 앞' };
  const descriptions = {
    walk: '4방향 × 8프레임 보행 시안 · 방향을 바꿔도 현재 걸음의 순서를 유지합니다.',
    idle: '대기 · 작은 호흡과 눈 깜빡임을 확인하세요.',
    rotation: '4방향 쿼터뷰 · 앞좌, 뒤좌, 뒤우, 앞우를 90도 간격으로 보기.',
    work: '도구 작업 · 준비, 들어 올리기, 내려치기, 복귀.',
    greet: '상호작용 · 손을 들어 인사하고 대기 자세로 돌아옵니다.',
    cargo: '상호작용 · 무릎을 굽혀 상자를 들고 다시 내려놓습니다.',
  };
  const thumbnailButtons = [];
  function sourceFrame(action, index, direction) { const clip = manifest.clips[action]; return (clip.facings?.[direction] || clip.frames)[index]; }
  function drawSprite(ctx, action, index, x, baseline, height, direction = state.direction) {
    const clip = manifest.clips[action];
    const f = sourceFrame(action, index, direction);
    const factor = height / clip.nominalHeight;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(images[clip.image], ...f.rect,
      x + (f.rect[0] - f.anchor[0]) * factor,
      baseline + (f.rect[1] - f.anchor[1]) * factor,
      f.rect[2] * factor, f.rect[3] * factor);
  }
  function updateThumbnails() {
    thumbnailButtons.forEach((button, index) => {
      button.hidden = index >= manifest.clips[state.action].frames.length;
      if (button.hidden) return;
      const canvas = button.firstElementChild;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = manifest.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawSprite(ctx, state.action, index, 45, 81, 72);
      button.lastElementChild.textContent = state.action === 'rotation' ? directions[index] : String(index + 1).padStart(2, '0');
      button.setAttribute('aria-label', state.action === 'rotation' ? `${directions[index]} 방향 보기` : `${index + 1}번째 프레임 보기`);
    });
  }
  function updateSelection() {
    thumbnailButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === state.frame)));
    find('frame-label').textContent = state.action === 'rotation' ? `${directions[state.frame]} · ${state.frame + 1} / 4` : `${state.action === 'walk' ? state.direction + ' · ' : ''}${state.frame + 1} / 8 프레임`;
  }
  function draw() {
    if (!state.ready) return;
    const width = stage.width, height = stage.height;
    context.fillStyle = manifest.background; context.fillRect(0, 0, width, height);
    const spriteHeight = Math.min(108 * state.scale, height - 72);
    let baseline = Math.round(height * .83);
    // Fractional screen positions are intentional: rounding translation to a tile or
    // advancing position only when a sprite frame changes causes visible stepping.
    const compare = state.action === 'walk' && find('view-all').checked;
    const traveling = state.action === 'walk' && find('travel').checked && !compare;
    let x = width / 2;
    if (traveling) {
      // Four quarter-view axes. Position advances every display frame, separately
      // from sprite-pose changes; a direction switch keeps the pose phase.
      const [vx, vy] = { SW: [-1,.5], NW: [-1,-.5], NE: [1,-.5], SE: [1,.5] }[state.direction];
      const span = Math.min(width + spriteHeight * 1.5, height * 2 + spriteHeight);
      const offset = ((state.distance + span / 2) % span) - span / 2;
      x += vx * offset;
      baseline = height / 2 + spriteHeight * .35 + vy * offset;
    }
    if (compare) {
      const columns = width < 560 ? 2 : 4, rows = 4 / columns;
      const cellWidth = width / columns, cellHeight = height / rows;
      const figureHeight = Math.min(spriteHeight, cellHeight - 38, cellWidth * 1.25);
      directions.forEach((direction, i) => {
        const cx = cellWidth * (i % columns + .5), floor = cellHeight * Math.floor(i / columns) + (cellHeight + figureHeight) / 2 - 12;
        drawSprite(context, 'walk', state.frame, cx, floor, figureHeight, direction);
        context.fillStyle = '#40574b'; context.font = '12px sans-serif'; context.textAlign = 'center';
        context.fillText(`${direction} · ${directionNames[direction]}`, cx, floor + 19);
        if (find('anchor').checked) { context.fillStyle = '#245d50'; context.fillRect(cx - 3, floor - 2, 6, 4); }
      });
    } else drawSprite(context, state.action, state.frame, x, baseline, spriteHeight);
    if (find('anchor').checked && !compare) {
      context.strokeStyle = '#719884'; context.lineWidth = 1;
      context.beginPath();context.moveTo(0, baseline + .5);context.lineTo(width, baseline + .5);context.stroke();
      context.fillStyle = '#245d50'; context.fillRect(x - 3, baseline - 2, 6, 4);
    }
    stage.dataset.action = state.action;
    stage.dataset.frame = String(state.frame);
    stage.dataset.positionX = x.toFixed(3);
    stage.dataset.positionY = baseline.toFixed(3);
    stage.dataset.direction = state.direction;
    stage.dataset.comparison = String(compare);
    stage.dataset.paused = String(state.paused);
  }
  function syncPlayback() {
    find('play').textContent = state.paused ? '재생' : '일시정지';
    find('play').setAttribute('aria-label', state.paused ? '재생' : '일시정지');
  }
  function selectAction(action) {
    state.action = action; state.time = 0; state.frame = 0; state.distance = 0; state.last = null;
    document.querySelectorAll('button[data-action]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.action === action)));
    find('action-description').textContent = descriptions[action];
    find('walk-directions').hidden = action !== 'walk';
    find('travel').disabled = action !== 'walk' || find('view-all').checked;
    find('frames').style.gridTemplateColumns = `repeat(${manifest.clips[action].frames.length},minmax(0,1fr))`;
    updateThumbnails(); updateSelection(); draw();
  }
  function selectDirection(direction) {
    state.direction = direction; state.distance = 0;
    document.querySelectorAll('button[data-direction]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.direction === direction)));
    updateThumbnails(); updateSelection(); draw();
  }
  for (let index = 0; index < 8; index++) {
    const button = document.createElement('button');
    button.type = 'button';
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 90; canvas.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    button.append(canvas, label);
    button.addEventListener('click', () => {
      state.paused = true; state.frame = index; state.time = index / manifest.clips[state.action].fps;
      syncPlayback(); updateSelection(); draw();
    });
    find('frames').append(button); thumbnailButtons.push(button);
  }
  document.querySelectorAll('button[data-action]').forEach(button => button.addEventListener('click', () => selectAction(button.dataset.action)));
  document.querySelectorAll('button[data-direction]').forEach(button => button.addEventListener('click', () => selectDirection(button.dataset.direction)));
  document.addEventListener('keydown', event => {
    if (!state.ready || state.action !== 'walk' || event.altKey || event.ctrlKey || event.metaKey || ['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return;
    const key = event.key.toLowerCase(); if (key !== 'q' && key !== 'e') return;
    event.preventDefault(); selectDirection(directions[(directions.indexOf(state.direction) + (key === 'e' ? 1 : 3)) % 4]);
  });
  find('view-all').addEventListener('change', () => { state.distance = 0; find('travel').disabled = find('view-all').checked; draw(); });
  find('play').addEventListener('click', () => { state.paused = !state.paused; state.last = null; syncPlayback(); draw(); });
  find('step').addEventListener('click', () => {
    state.paused = true; state.frame = (state.frame + 1) % manifest.clips[state.action].frames.length; state.time = state.frame / manifest.clips[state.action].fps;
    syncPlayback(); updateSelection(); draw();
  });
  find('speed').addEventListener('change', event => { state.speed = Number(event.target.value); });
  find('scale').addEventListener('change', event => { state.scale = Number(event.target.value); draw(); });
  find('travel').addEventListener('change', () => { state.distance = 0; draw(); });
  find('anchor').addEventListener('change', draw);
  function resize() { const bounds = stage.getBoundingClientRect(); stage.width = Math.max(1, Math.round(bounds.width)); stage.height = Math.max(1, Math.round(bounds.height)); draw(); }
  new ResizeObserver(resize).observe(stage);
  document.addEventListener('visibilitychange', () => { state.last = null; });
  function animate(now) {
    const elapsed = state.last === null ? 0 : Math.min(.05, (now - state.last) / 1000);
    state.last = now;
    if (state.ready && !state.paused && !document.hidden) {
      state.time += elapsed * state.speed;
      if (state.action === 'walk') state.distance += elapsed * state.speed * 72;
      const next = Math.floor((state.time + 1e-9) * manifest.clips[state.action].fps) % manifest.clips[state.action].frames.length;
      if (next !== state.frame) { state.frame = next; updateSelection(); }
      draw();
    }
    requestAnimationFrame(animate);
  }
  const controls = [...document.querySelectorAll('button, select, input')];
  controls.forEach(control => { control.disabled = true; });
  Promise.all(Object.entries(manifest.images).map(([key, url]) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { images[key] = img; resolve(); };
    img.onerror = () => reject(new Error(`불러오지 못한 이미지: ${url}`));
    img.src = url;
  }))).then(() => {
    const portrait = find('portrait').getContext('2d'); portrait.imageSmoothingEnabled = false;
    portrait.drawImage(images.study, 0, 0, 384, 612, 0, 0, 384, 612);
    state.ready = true; controls.forEach(control => { control.disabled = false; });
    find('loading').hidden = true; resize(); selectAction('walk');
    document.documentElement.dataset.previewReady = 'true';
  }).catch(error => { find('loading').textContent = `${error.message}. 이 폴더의 PNG 파일과 함께 열어 주세요.`; });
  requestAni
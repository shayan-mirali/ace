// Isolate the spade mark from the full logo lockup.
// The lockup is spade + "ACE DEVELOPERS" wordmark on a dark field. Find the
// bright bands by row, take the topmost one (the spade), crop with padding,
// and emit a WebP data URI small enough to inline in the page.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SRC = 'C:/Users/karac/OneDrive/Desktop/AceDev/assets/logo-full.png';
const OUT = 'C:/Users/karac/OneDrive/Desktop/AceDev/assets';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const b64 = fs.readFileSync(SRC).toString('base64');

  const res = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;

    const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const THRESH = 90;

    // rows that contain anything bright
    const rowHot = [];
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let px = 0; px < W; px += 2) if (lum((y * W + px) * 4) > THRESH) n++;
      rowHot.push(n);
    }
    // contiguous bands of hot rows, ignoring 1-2px noise
    const bands = [];
    let start = -1;
    for (let y = 0; y < H; y++) {
      const hot = rowHot[y] > 3;
      if (hot && start < 0) start = y;
      if ((!hot || y === H - 1) && start >= 0) {
        if (y - start > 12) bands.push([start, y]);
        start = -1;
      }
    }
    if (!bands.length) return { error: 'no bright bands found' };
    const [y0, y1] = bands[0];                    // topmost = the spade

    // column extent within that band
    let x0 = W, x1 = 0;
    for (let y = y0; y <= y1; y++)
      for (let px = 0; px < W; px++)
        if (lum((y * W + px) * 4) > THRESH) { if (px < x0) x0 = px; if (px > x1) x1 = px; }

    // pad so the rim glow survives, but never run into the wordmark below
    const nextBand = bands[1] ? bands[1][0] : H;
    const padX = Math.round((x1 - x0) * 0.14), padY = Math.round((y1 - y0) * 0.10);
    const cx0 = Math.max(0, x0 - padX), cy0 = Math.max(0, y0 - padY);
    const cx1 = Math.min(W, x1 + padX);
    const cy1 = Math.min(H, y1 + padY, nextBand - 8);
    const cw = cx1 - cx0, ch = cy1 - cy0;

    // letterbox into a square rather than widening the crop — expanding it
    // is what dragged the top of "ACE" into frame
    const side = Math.max(cw, ch);
    const TARGET = 620;
    const k = TARGET / side;
    const o = document.createElement('canvas');
    o.width = TARGET; o.height = TARGET;
    const ox = o.getContext('2d');
    ox.imageSmoothingQuality = 'high';
    ox.drawImage(img, cx0, cy0, cw, ch,
      (TARGET - cw * k) / 2, (TARGET - ch * k) / 2, cw * k, ch * k);

    // ---- key the dark field out to real transparency --------------------
    // A plain luminance key would punch holes in the spade's own dark
    // interior. Instead, flood-fill inwards from the border: the fill walks
    // through the field and the surrounding glow but is stopped dead by the
    // bright chrome rim, so everything inside the mark is left untouched.
    const id = ox.getImageData(0, 0, TARGET, TARGET);
    const d2 = id.data;
    const T = TARGET;
    const lum2 = (p) => 0.2126 * d2[p << 2] + 0.7152 * d2[(p << 2) + 1] + 0.0722 * d2[(p << 2) + 2];
    const RIM = 150;                    // brighter than this = the rim, don't cross
    const seen = new Uint8Array(T * T);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= T || y >= T) return;
      const p = y * T + x;
      if (seen[p] || lum2(p) >= RIM) return;
      seen[p] = 1; stack.push(p);
    };
    for (let x = 0; x < T; x++){ push(x, 0); push(x, T - 1); }
    for (let y = 0; y < T; y++){ push(0, y); push(T - 1, y); }
    while (stack.length){
      const p = stack.pop(), x = p % T, y = (p / T) | 0;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
    let cleared = 0;
    for (let p = 0; p < T * T; p++){
      if (!seen[p]) continue;           // inside the mark — leave fully opaque
      // keep the rim glow as partial alpha so the mark doesn't look cut out
      // steep ramp: the navy field and its hexagons sit under ~45 and must go
      // fully clear, while the rim glow (60-140) keeps proportional alpha
      const a = Math.max(0, Math.min(1, (lum2(p) - 45) / 70));
      d2[(p << 2) + 3] = Math.round(a * 255);
      if (a < .04) cleared++;
    }
    ox.putImageData(id, 0, 0);

    // ---- favicons ------------------------------------------------------
    // Crop tight to what is actually opaque: the padding that keeps the rim
    // glow looking right in the hero just wastes pixels at 32px square.
    let fx0 = T, fy0 = T, fx1 = 0, fy1 = 0;
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++)
        if (d2[((y * T + x) << 2) + 3] > 170){   // the mark itself, not its halo
          if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
          if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
        }
    const fw = fx1 - fx0, fh = fy1 - fy0, fside = Math.max(fw, fh);
    const icon = (px) => {
      const ic = document.createElement('canvas');
      ic.width = ic.height = px;
      const c2 = ic.getContext('2d');
      c2.imageSmoothingQuality = 'high';
      const s = px / fside * 0.94;                 // a hair of breathing room
      c2.drawImage(o, fx0, fy0, fw, fh,
        (px - fw * s) / 2, (px - fh * s) / 2, fw * s, fh * s);
      return ic.toDataURL('image/png');
    };

    return {
      src: { W, H }, bands, spade: { x0, y0, x1, y1 },
      crop: { sx: cx0, sy: cy0, w: cw, h: ch, side: Math.round(side) },
      keyed: { background: seen.reduce((n, v) => n + v, 0), fullyClear: cleared, total: T * T },
      iconBox: { x: fx0, y: fy0, w: fw, h: fh },
      webp: o.toDataURL('image/webp', 0.94),
      png:  o.toDataURL('image/png'),
      fav64: icon(64),
      fav180: icon(180),
    };
  }, 'data:image/png;base64,' + b64);

  if (res.error) { console.log(res.error); await browser.close(); return; }

  console.log('source        :', res.src.W + 'x' + res.src.H);
  console.log('bright bands  :', res.bands.map(b => b.join('-')).join(', '));
  console.log('spade bbox    : x', res.spade.x0, '-', res.spade.x1, ' y', res.spade.y0, '-', res.spade.y1);
  console.log('crop rect     :', res.crop.w + 'x' + res.crop.h, 'at', res.crop.sx + ',' + res.crop.sy);
  const k = res.keyed;
  console.log('keyed out     :', (100*k.background/k.total).toFixed(1) + '% background,',
              (100*k.fullyClear/k.total).toFixed(1) + '% fully transparent');

  for (const [name, uri] of [['spade.webp', res.webp], ['spade.png', res.png]]) {
    const buf = Buffer.from(uri.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log(name.padEnd(14) + ':', (buf.length / 1024).toFixed(0) + 'KB');
  }
  fs.writeFileSync(path.join(OUT, 'spade.webp.datauri'), res.webp);
  console.log('data uri chars:', res.webp.length);

  const b = res.iconBox;
  console.log('icon crop     :', b.w + 'x' + b.h, 'at', b.x + ',' + b.y);
  for (const [name, uri] of [['favicon-64.datauri', res.fav64], ['favicon-180.datauri', res.fav180]]) {
    fs.writeFileSync(path.join(OUT, name), uri);
    console.log(name.padEnd(20) + ':', (uri.length / 1024).toFixed(1) + 'KB as data uri');
  }
  fs.writeFileSync(path.join(OUT, 'favicon.png'), Buffer.from(res.fav180.split(',')[1], 'base64'));
  await browser.close();
})();

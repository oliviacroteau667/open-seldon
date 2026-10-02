"use client";
// Open Seldon brand motion — port of openseldon-brand.js (v1) as a typed module.
// createMark / createLockup return a controller: start() → finish() (Promise) → pulse() / idle().

type Kind = "mark" | "lockup";

interface Geo {
  vb: string; w: number; h: number;
  cx: number; cy: number; dx: number; dy: number;
  r: number; drop: number; sw: number; rimW: number; ringW: number;
  centerX?: number;
  hands: string[]; rim: string[];
}

export interface BrandController {
  el: SVGSVGElement;
  readonly state: "idle" | "loading" | "finishing" | "done";
  start(): BrandController;
  finish(): Promise<void>;
  reveal(): Promise<void>;
  pulse(): BrandController;
  idle(): BrandController;
  destroy(): void;
}

export interface LaunchOptions {
  tagline?: string;
  footer?: string;
  width?: number;
  minDuration?: number;
  hold?: number;
  dismiss?: "auto" | "click"; // "click" holds on the wordmark until the arrow is pressed
  enterLabel?: string;
  onDone?: () => void;
}

export interface LaunchHandle {
  controller: BrandController;
  finish(): Promise<void>;
}

const NS = "http://www.w3.org/2000/svg";

const WORD = "M58.17 43.34L58.17 43.34Q56.10 43.34 54.65 42.49Q53.21 41.64 52.56 40.14L52.56 40.14L52.56 49.97L48.28 49.97L48.28 25.66L52.46 25.66L52.46 28.55Q53.14 27.05 54.74 26.19Q56.34 25.32 58.44 25.32L58.44 25.32Q60.76 25.32 62.47 26.42Q64.19 27.53 65.14 29.54Q66.09 31.54 66.09 34.26L66.09 34.26Q66.09 37.02 65.11 39.06Q64.12 41.10 62.34 42.22Q60.55 43.34 58.17 43.34ZM57.08 39.80L57.08 39.80Q59.12 39.80 60.37 38.36Q61.61 36.91 61.61 34.30L61.61 34.30Q61.61 31.68 60.37 30.25Q59.12 28.82 57.05 28.82L57.05 28.82Q54.98 28.82 53.73 30.28Q52.49 31.75 52.49 34.33L52.49 34.33Q52.49 36.95 53.75 38.38Q55.01 39.80 57.08 39.80ZM76.62 43.34L76.62 43.34Q73.86 43.34 71.80 42.18Q69.75 41.03 68.61 39.01Q67.47 36.98 67.47 34.30L67.47 34.30Q67.47 31.64 68.61 29.62Q69.75 27.60 71.79 26.46Q73.83 25.32 76.55 25.32L76.55 25.32Q79.13 25.32 81.04 26.39Q82.94 27.46 83.99 29.40Q85.05 31.34 85.05 33.92L85.05 33.92Q85.05 34.43 85.01 34.82Q84.98 35.21 84.91 35.62L84.91 35.62L71.82 35.62Q72.09 37.83 73.33 38.97Q74.58 40.11 76.65 40.11L76.65 40.11Q78.01 40.11 79.01 39.60Q80.02 39.09 80.53 38.04L80.53 38.04L84.57 38.04Q83.72 40.52 81.70 41.93Q79.68 43.34 76.62 43.34ZM76.48 28.55L76.48 28.55Q74.64 28.55 73.45 29.59Q72.26 30.62 71.92 32.63L71.92 32.63L80.70 32.63Q80.53 30.59 79.42 29.57Q78.32 28.55 76.48 28.55ZM91.73 43L87.44 43L87.44 25.66L91.63 25.66L91.63 28.86Q92.54 27.22 94.16 26.27Q95.77 25.32 97.95 25.32L97.95 25.32Q100.77 25.32 102.35 26.90Q103.93 28.48 103.93 31.17L103.93 31.17L103.93 43L99.62 43L99.62 32.05Q99.62 28.82 96.42 28.82L96.42 28.82Q94.35 28.82 93.04 30.16Q91.73 31.51 91.73 33.65L91.73 33.65L91.73 43ZM122.53 43.31L122.53 43.31Q117.91 43.31 115.17 41.20Q112.43 39.09 111.96 35.18L111.96 35.18L116.21 35.18Q116.51 37.42 118.19 38.66Q119.88 39.91 122.67 39.91L122.67 39.91Q124.98 39.91 126.17 39.07Q127.36 38.24 127.36 36.74L127.36 36.74Q127.36 35.42 126.61 34.60Q125.86 33.79 124.09 33.28L124.09 33.28L119.67 31.95Q116.31 30.93 114.73 29.28Q113.15 27.63 113.15 25.08L113.15 25.08Q113.15 22.97 114.25 21.41Q115.36 19.85 117.33 19.00Q119.30 18.15 121.95 18.15L121.95 18.15Q126.03 18.15 128.46 20.13Q130.89 22.12 131.23 25.52L131.23 25.52L126.98 25.52Q126.61 23.48 125.28 22.51Q123.96 21.55 121.71 21.55L121.71 21.55Q119.71 21.55 118.57 22.33Q117.43 23.11 117.43 24.47L117.43 24.47Q117.43 25.59 118.13 26.37Q118.82 27.16 120.73 27.73L120.73 27.73L125.22 29.09Q128.58 30.08 130.11 31.78Q131.64 33.48 131.64 36.10L131.64 36.10Q131.64 39.57 129.25 41.44Q126.85 43.31 122.53 43.31ZM141.79 43.34L141.79 43.34Q139.04 43.34 136.98 42.18Q134.92 41.03 133.78 39.01Q132.64 36.98 132.64 34.30L132.64 34.30Q132.64 31.64 133.78 29.62Q134.92 27.60 136.96 26.46Q139.00 25.32 141.72 25.32L141.72 25.32Q144.31 25.32 146.21 26.39Q148.11 27.46 149.17 29.40Q150.22 31.34 150.22 33.92L150.22 33.92Q150.22 34.43 150.19 34.82Q150.15 35.21 150.09 35.62L150.09 35.62L137.00 35.62Q137.27 37.83 138.51 38.97Q139.75 40.11 141.82 40.11L141.82 40.11Q143.18 40.11 144.19 39.60Q145.19 39.09 145.70 38.04L145.70 38.04L149.75 38.04Q148.90 40.52 146.87 41.93Q144.85 43.34 141.79 43.34ZM141.65 28.55L141.65 28.55Q139.82 28.55 138.63 29.59Q137.44 30.62 137.10 32.63L137.10 32.63L145.87 32.63Q145.70 30.59 144.59 29.57Q143.49 28.55 141.65 28.55ZM156.90 43L152.62 43L152.62 18.52L156.90 18.52L156.90 43ZM177.22 43L173.03 43L173.03 40.14Q172.32 41.64 170.77 42.49Q169.23 43.34 167.19 43.34L167.19 43.34Q164.81 43.34 163.05 42.23Q161.30 41.13 160.35 39.12Q159.40 37.12 159.40 34.40L159.40 34.40Q159.40 31.64 160.39 29.60Q161.37 27.56 163.14 26.44Q164.91 25.32 167.32 25.32L167.32 25.32Q169.33 25.32 170.77 26.12Q172.22 26.92 172.90 28.38L172.90 28.38L172.90 18.52L177.22 18.52L177.22 43ZM168.44 39.84L168.44 39.84Q170.52 39.84 171.76 38.38Q173.00 36.91 173.00 34.33L173.00 34.33Q173.00 31.71 171.74 30.28Q170.48 28.86 168.41 28.86L168.41 28.86Q166.34 28.86 165.09 30.30Q163.85 31.75 163.85 34.36L163.85 34.36Q163.85 36.98 165.11 38.41Q166.37 39.84 168.44 39.84ZM188.86 43.34L188.86 43.34Q186.11 43.34 184.01 42.18Q181.92 41.03 180.77 38.97Q179.61 36.91 179.61 34.26L179.61 34.26Q179.61 31.61 180.77 29.59Q181.92 27.56 184.00 26.44Q186.07 25.32 188.86 25.32L188.86 25.32Q191.65 25.32 193.72 26.44Q195.80 27.56 196.95 29.59Q198.11 31.61 198.11 34.26L198.11 34.26Q198.11 36.91 196.93 38.97Q195.76 41.03 193.69 42.18Q191.61 43.34 188.86 43.34ZM188.86 39.91L188.86 39.91Q190.90 39.91 192.26 38.36Q193.62 36.81 193.62 34.23L193.62 34.23Q193.62 31.68 192.28 30.22Q190.93 28.75 188.86 28.75L188.86 28.75Q186.79 28.75 185.43 30.22Q184.07 31.68 184.07 34.23L184.07 34.23Q184.07 36.81 185.43 38.36Q186.79 39.91 188.86 39.91ZM204.75 43L200.47 43L200.47 25.66L204.65 25.66L204.65 28.86Q205.57 27.22 207.18 26.27Q208.80 25.32 210.98 25.32L210.98 25.32Q213.80 25.32 215.38 26.90Q216.96 28.48 216.96 31.17L216.96 31.17L216.96 43L212.64 43L212.64 32.05Q212.64 28.82 209.45 28.82L209.45 28.82Q207.37 28.82 206.06 30.16Q204.75 31.51 204.75 33.65L204.75 33.65L204.75 43Z";

const GEO: Record<Kind, Geo> = {
  mark: {
    vb: "0 0 64 64", w: 64, h: 64, cx: 32, cy: 37.3, dx: 32, dy: 24, r: 7, drop: 13.3, sw: 6, rimW: 1, ringW: 1,
    hands: ["M11.3 30.5 A22 22 0 0 0 26.3 59.3", "M37.7 59.3 A22 22 0 0 0 52.7 30.5"],
    rim: ["M9.2 29.5 A25 25 0 0 0 26.3 62.3", "M37.7 62.3 A25 25 0 0 0 54.8 29.5"],
  },
  lockup: {
    vb: "8 0 212 56", w: 212, h: 56, cx: 24, cy: 30, dx: 24, dy: 22, r: 4.8, drop: 8, sw: 5, rimW: 0.8, ringW: 0.6, centerX: 90,
    hands: ["M10.8 25.2 A14 14 0 0 0 20.4 43.5", "M27.6 43.5 A14 14 0 0 0 37.2 25.2"],
    rim: ["M9.4 24.4 A16 16 0 0 0 20.4 45.5", "M27.6 45.5 A16 16 0 0 0 38.6 24.4"],
  },
};

const SPIN = 1800;
const DROP = 600;
let uid = 0;

const reducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: Element
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  parent?.appendChild(n);
  return n;
}

interface Built {
  svg: SVGSVGElement; O: SVGGElement; hands: SVGGElement;
  dot: SVGCircleElement; r1: SVGCircleElement; r2: SVGCircleElement;
  clip?: SVGRectElement; g: Geo;
}

interface BuildOptions { width?: number; text?: string; revealed?: boolean }

function build(kind: Kind, o: BuildOptions): Built {
  const g = GEO[kind];
  const id = "os" + ++uid;
  const text = o.text || "#EDEBFA";
  const svg = el("svg", { viewBox: g.vb, fill: "none" });
  svg.style.cssText = "overflow:visible;display:block;" +
    (o.width ? `width:${o.width}px;height:${(o.width * g.h) / g.w}px` : "width:100%;height:auto");
  const defs = el("defs", {}, svg);
  const lg = el("linearGradient", { id: id + "h", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: 0, "stop-color": "#C9BFFF", "stop-opacity": 0.85 }, lg);
  el("stop", { offset: 1, "stop-color": "#8B7CF6", "stop-opacity": 0.45 }, lg);
  const f = el("filter", { id: id + "g", x: "-100%", y: "-100%", width: "300%", height: "300%" }, defs);
  el("feDropShadow", { dx: 0, dy: 0, stdDeviation: 2.5, "flood-color": "#64B837", "flood-opacity": 0.9 }, f);

  let clip: SVGRectElement | undefined;
  if (kind === "lockup") {
    const cp = el("clipPath", { id: id + "c" }, defs);
    clip = el("rect", { x: 40, y: -10, width: 190, height: 76 }, cp);
    clip.style.cssText = `transform-origin:40px 0px;transform:scaleX(${o.revealed === false ? 0 : 1})`;
    const tg = el("g", { "clip-path": `url(#${id}c)` }, svg);
    el("path", { fill: text, d: WORD }, tg);
  }

  const O = el("g", {}, svg);
  O.style.cssText = `transform-origin:${g.cx}px ${g.cy}px;` +
    (kind === "lockup" && o.revealed === false ? `transform:translate(${g.centerX}px,0px)` : "");
  const hands = el("g", {}, O);
  hands.style.transformOrigin = `${g.cx}px ${g.cy}px`;
  const h1 = el("g", { stroke: `url(#${id}h)`, "stroke-width": g.sw, "stroke-linecap": "round" }, hands);
  g.hands.forEach((d) => el("path", { d }, h1));
  const h2 = el("g", { stroke: "#FFFFFF", "stroke-opacity": 0.6, "stroke-width": g.rimW, "stroke-linecap": "round" }, hands);
  g.rim.forEach((d) => el("path", { d }, h2));

  const ring = () => {
    const c = el("circle", { cx: g.dx, cy: g.dy, r: g.r, stroke: "#64B837", "stroke-width": g.ringW, opacity: 0 }, O);
    c.style.transformOrigin = `${g.dx}px ${g.dy}px`;
    return c;
  };
  const r1 = ring();
  const r2 = ring();
  const dot = el("circle", { cx: g.dx, cy: g.dy, r: g.r, fill: "#64B837", filter: `url(#${id}g)` }, O);
  dot.style.transformOrigin = `${g.dx}px ${g.dy}px`;
  return { svg, O, hands, dot, r1, r2, clip, g };
}

function controller(kind: Kind, host: Element, o: BuildOptions = {}): BrandController {
  const n = build(kind, o);
  host.appendChild(n.svg);
  let a: Record<string, Animation | undefined> = {};
  let state: BrandController["state"] = "idle";
  const cancel = () => { Object.values(a).forEach((x) => x?.cancel()); a = {}; };
  const reduced = reducedMotion();

  const api: BrandController = {
    el: n.svg,
    get state() { return state; },
    start() {
      cancel();
      state = "loading";
      if (reduced) { n.dot.style.opacity = "0.5"; return api; }
      a.drop = n.dot.animate(
        [{ transform: "translateY(0px)" }, { transform: `translateY(${n.g.drop}px)` }],
        { duration: DROP, easing: "cubic-bezier(.5,0,.3,1.25)", fill: "forwards" }
      );
      a.spin = n.hands.animate(
        [
          { transform: "rotate(0deg)", easing: "cubic-bezier(.65,0,.35,1)" },
          { transform: "rotate(360deg)", offset: 2 / 3 },
          { transform: "rotate(360deg)" },
        ],
        { duration: SPIN, iterations: Infinity, delay: DROP }
      );
      return api;
    },
    finish() {
      return new Promise<void>((res) => {
        if (state !== "loading") return res();
        state = "finishing";
        const spin = a.spin;
        if (reduced || !spin) { n.dot.style.opacity = "1"; state = "done"; return res(); }
        const elapsed = Math.max(((spin.currentTime as number) || 0) - DROP, 0);
        (spin.effect as KeyframeEffect).updateTiming({ iterations: Math.max(1, Math.ceil(elapsed / SPIN)) });
        spin.onfinish = () => {
          a.drop?.cancel();
          a.rise = n.dot.animate(
            [{ transform: `translateY(${n.g.drop}px)` }, { transform: "translateY(0px)" }],
            { duration: DROP, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
          );
          a.rise.onfinish = () => { state = "done"; res(); };
        };
      });
    },
    reveal() {
      return new Promise<void>((res) => {
        if (kind !== "lockup" || !n.clip) return res();
        if (reduced) { n.O.style.transform = ""; n.clip.style.transform = "scaleX(1)"; return res(); }
        a.move = n.O.animate(
          [{ transform: `translate(${n.g.centerX}px,0px)` }, { transform: "translate(0px,0px)" }],
          { duration: 900, easing: "cubic-bezier(.65,0,.2,1)", fill: "forwards" }
        );
        a.wipe = n.clip.animate(
          [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
          { duration: 700, delay: 250, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
        );
        a.move.onfinish = () => res();
      });
    },
    pulse() {
      if (reduced) return api;
      const ring = (c: SVGCircleElement, delay: number) =>
        c.animate(
          [{ transform: "scale(1)", opacity: 0.55 }, { transform: "scale(2.1)", opacity: 0 }],
          { duration: 4000, delay, iterations: Infinity, easing: "cubic-bezier(.2,.6,.3,1)" }
        );
      a.p1 = ring(n.r1, 0);
      a.p2 = ring(n.r2, 2000);
      a.p3 = n.dot.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }],
        { duration: 4000, iterations: Infinity, easing: "ease-in-out" }
      );
      return api;
    },
    idle() { cancel(); state = "idle"; n.dot.style.opacity = "1"; return api; },
    destroy() { cancel(); n.svg.remove(); },
  };
  return api;
}

export const createMark = (host: Element, o?: BuildOptions) => controller("mark", host, o);
export const createLockup = (host: Element, o?: BuildOptions) => controller("lockup", host, o);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function launch(o: LaunchOptions = {}): LaunchHandle {
  const width = o.width ?? Math.min(424, window.innerWidth * 0.64);
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0A0912;overflow:hidden;display:flex;align-items:center;justify-content:center;transition:opacity .6s ease";
  root.innerHTML =
    '<div style="position:absolute;left:25%;top:18%;width:40vmin;height:40vmin;border-radius:50%;background:#8B7CF6;filter:blur(12vmin);opacity:.45"></div>' +
    '<div style="position:absolute;left:60%;top:45%;width:30vmin;height:30vmin;border-radius:50%;background:#64B837;filter:blur(12vmin);opacity:.28"></div>' +
    '<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 40px),repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 1px,transparent 1px 40px)"></div>' +
    `<div data-os-center style="position:relative;display:flex;flex-direction:column;align-items:center;gap:${width > 300 ? 18 : 10}px"></div>` +
    (o.footer
      ? `<span data-os-foot style="position:absolute;bottom:36px;left:0;right:0;text-align:center;font:400 11px 'Space Mono',ui-monospace,monospace;letter-spacing:.12em;color:#5E5880;opacity:0;transition:opacity .6s"></span>`
      : "");
  const center = root.querySelector("[data-os-center]") as HTMLDivElement;
  const foot = root.querySelector("[data-os-foot]") as HTMLSpanElement | null;
  if (foot && o.footer) foot.textContent = o.footer;

  const c = controller("lockup", center, { width, revealed: false });

  // Tagline row: caption + (in click mode) a minimalist arrow with a generous hit area
  const big = width > 300;
  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:6px;opacity:0;transition:opacity .5s,transform .5s;transform:translateY(4px)";
  let cap: HTMLSpanElement | null = null;
  if (o.tagline) {
    cap = document.createElement("span");
    cap.textContent = o.tagline;
    cap.style.cssText = `font:400 ${big ? 13 : 11}px 'Space Mono',ui-monospace,monospace;letter-spacing:.15em;color:#9A93B8;white-space:nowrap`;
    row.appendChild(cap);
  }
  let arrow: HTMLButtonElement | null = null;
  if (o.dismiss === "click") {
    arrow = document.createElement("button");
    arrow.type = "button";
    arrow.textContent = "›";
    arrow.setAttribute("aria-label", o.enterLabel ?? "Enter");
    arrow.style.cssText = `width:48px;height:48px;margin:-12px -12px -12px -4px;display:grid;place-items:center;background:none;border:0;border-radius:24px;color:#EDEBFA;font:300 ${big ? 30 : 24}px/1 'Instrument Sans',system-ui,sans-serif;cursor:pointer;transition:color .2s,transform .2s;padding:0`;
    arrow.onmouseenter = () => { arrow!.style.color = "#64B837"; arrow!.style.transform = "translateX(3px)"; };
    arrow.onmouseleave = () => { arrow!.style.color = "#EDEBFA"; arrow!.style.transform = "none"; };
    row.appendChild(arrow);
  }
  if (cap || arrow) center.appendChild(row);
  document.body.appendChild(root);
  c.start();

  const t0 = performance.now();
  const minMs = o.minDuration ?? 1800;
  let done = false;

  const dismiss = async () => {
    root.style.opacity = "0";
    root.style.pointerEvents = "none";
    await sleep(650);
    c.destroy();
    root.remove();
    o.onDone?.();
  };

  const waitForClick = () =>
    new Promise<void>((res) => {
      const go = () => { cleanup(); res(); };
      const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
      const cleanup = () => { arrow?.removeEventListener("click", go); window.removeEventListener("keydown", onKey); };
      arrow?.addEventListener("click", go);
      window.addEventListener("keydown", onKey);
    });

  return {
    controller: c,
    async finish() {
      if (done) return;
      done = true;
      await sleep(Math.max(0, minMs - (performance.now() - t0)));
      await c.finish();
      await c.reveal();
      row.style.opacity = "1";
      row.style.transform = "none";
      if (foot) foot.style.opacity = "1";
      c.pulse();
      if (o.dismiss === "click") await waitForClick();
      else await sleep(o.hold ?? 900);
      await dismiss();
    },
  };
}

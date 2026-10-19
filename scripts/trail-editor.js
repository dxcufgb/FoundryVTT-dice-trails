/**
 * The Dice trails window: build a trail out of one or more layers (a design and style, or an
 * image of your own), tune each layer and its effects, watch it live on a die in the window,
 * roll it on the table, and give it to kinds of roll (attacks, checks, saves, ...).
 * Trails can be saved by name and loaded again later, and exported to a file.
 */

import { MODULE_ID, TAG } from "./constants.js";
import {
  DESIGNS, DESIGN_CATEGORIES, CUSTOM, MOTIONS, COLOR_MODES, KINDS, SOUNDS, MAX_LAYERS, normalizeConfig, normalizeLayer, layerLabel, trailLabel, compileTrail
} from "./custom-trails.js";
import {
  loadThree, renderContext, loadCustomTextures, setPreviewEffect, previewTrail,
  trails, setTrail, clearTrail, ownerRef, ownerFromRef, presets, savePreset, deletePreset
} from "./dice-trails.js";
import { exportTrail, importTrail } from "./transfer.js";
import { playHit } from "./trail-sounds.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PREVIEW = 320;   // preview canvas size in px

const escapeHTML = str => String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** How a slider's value is shown next to it. */
const FORMAT = {
  pct: v => `${Math.round(v * 100)}%`,
  int: v => `${Math.round(v)}`,
  mul: v => `${(Math.round(v * 100) / 100).toFixed(2)}×`
};

/** The character of the token you have selected, if you own it (it can then have trails of its own). */
function selectedCharacter() {
  const actor = canvas?.tokens?.controlled?.[0]?.actor;
  return actor?.isOwner ? actor : null;
}

/** How an owner of trails is named in the window: you, a character, or an unlinked token. */
function ownerLabel(owner) {
  if (owner.documentName === "User") return game.i18n.format("DXDT.App.OwnerYou", { name: owner.name });
  if (owner.isToken) return game.i18n.format("DXDT.App.OwnerToken", { name: owner.token?.name ?? owner.name });
  return owner.name;
}

/**
 * The design categories (DESIGN_CATEGORIES), anything uncategorised under "Other", and an image of
 * your own last: [{id, label, designs: [design id, ...]}].
 */
function designCategories(customLabel) {
  const listed = new Set();
  const groups = [];
  DESIGN_CATEGORIES.forEach((c, i) => {
    const ids = c.designs.filter(id => DESIGNS[id] && !listed.has(id));
    ids.forEach(id => listed.add(id));
    if (ids.length) groups.push({ id: `c${i}`, label: c.label, designs: ids });
  });
  const rest = Object.keys(DESIGNS).filter(id => !listed.has(id));
  if (rest.length) groups.push({ id: "other", label: "Other", designs: rest });
  groups.push({ id: CUSTOM, label: customLabel, designs: [CUSTOM] });
  return groups;
}

/* -------------------------------------------- */
/*  Live preview: a die flying through the window */
/* -------------------------------------------- */

/**
 * A small three.js scene of its own: a d20 that flies a figure of eight, rests a moment and goes
 * again, drawn with the same emitter the real dice use.
 */
export class TrailPreview {
  constructor(host) {
    const ctx = renderContext();
    const THREE = this.THREE = ctx.THREE;
    this.ctx = ctx;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(PREVIEW, PREVIEW);
    this.renderer.setClearColor(0x000000, 0);
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(20, 1, 10, 10000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(0, -260, 820);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-200, -300, 600);
    this.scene.add(sun);

    // The die: a d20 shape about the size of a Dice So Nice die.
    this.radius = 30;
    const geo = new THREE.IcosahedronGeometry(this.radius, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x33384a, roughness: 0.4, metalness: 0.15, flatShading: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.sim = {};
    this.mesh.options = { [TAG]: "preview" };
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.scene.add(this.group);

    // silent: the preview would loop its sound forever while you design; the Test roll plays it.
    this.box = { scene: this.scene, camera: this.camera, renderer: this.renderer, rolling: true, isVisible: true,
                 silent: true, renderScene: () => this.render() };
    this.emitter = null;
    this.t = Math.random() * 5;
    this.last = performance.now();
    this.raf = 0;
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Show this effect definition (null: nothing). */
  setEffect(def) {
    this.emitter?.dispose();
    this.emitter = def ? new this.ctx.DieEmitter(this.box, this.group, this.mesh, def) : null;
  }

  frame(now) {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;

    // 5 s of flight along a figure of eight, then 2 s of rest on the table.
    const cycle = this.t % 7;
    const flying = cycle < 5;
    if (flying) {
      const a = (cycle / 5) * Math.PI * 2;
      this.group.position.set(Math.sin(a) * 95, Math.sin(2 * a) * 50, this.radius + Math.abs(Math.sin(3 * a)) * 40);
      this.mesh.rotation.x += dt * 5;
      this.mesh.rotation.y += dt * 3.2;
    }
    this.box.rolling = flying;

    const ctx = renderContext();
    if (this.emitter) this.emitter.update(dt, ctx.intensity, ctx.afterglow, ctx.pointScale(this.box), ctx.sizeMul);
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.emitter?.dispose();
    this.emitter = null;
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/* -------------------------------------------- */
/*  The window                                  */
/* -------------------------------------------- */

export class DiceTrailsEditor extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "dxdt-editor",
    classes: ["dxdt-editor"],
    tag: "div",
    window: { title: "DXDT.App.Title", icon: "fa-solid fa-dice-d20", resizable: false },
    position: { width: 900, height: "auto" },
    actions: {
      design: DiceTrailsEditor.#onDesign,
      style: DiceTrailsEditor.#onStyle,
      selectLayer: DiceTrailsEditor.#onSelectLayer,
      addLayer: DiceTrailsEditor.#onAddLayer,
      duplicateLayer: DiceTrailsEditor.#onDuplicateLayer,
      moveLayer: DiceTrailsEditor.#onMoveLayer,
      removeLayer: DiceTrailsEditor.#onRemoveLayer,
      browseImage: DiceTrailsEditor.#onBrowseImage,
      uploadImage: DiceTrailsEditor.#onUploadImage,
      loadPreset: DiceTrailsEditor.#onLoadPreset,
      savePreset: DiceTrailsEditor.#onSavePreset,
      deletePreset: DiceTrailsEditor.#onDeletePreset,
      exportTrail: DiceTrailsEditor.#onExport,
      importTrail: DiceTrailsEditor.#onImport,
      testRoll: DiceTrailsEditor.#onTestRoll,
      editKind: DiceTrailsEditor.#onEditKind,
      allKinds: DiceTrailsEditor.#onAllKinds,
      apply: DiceTrailsEditor.#onApply,
      remove: DiceTrailsEditor.#onRemove,
      reset: DiceTrailsEditor.#onReset
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/editor.hbs` }
  };

  /** What the settings menu button opens: the one shared window. */
  static Menu = class extends ApplicationV2 {
    render() {
      DiceTrailsEditor.open();
      return this;
    }
  };

  /** The open window, if any. */
  static instance = null;

  /**
   * Open the window on an owner's trails: a character (Actor) or a User. Without one it opens on the
   * character of the selected token, if you own it, and otherwise on your own trails.
   */
  static open({ owner = null } = {}) {
    if (!game.modules.get("dice-so-nice")?.active) {
      ui.notifications.warn(game.i18n.localize("DXDT.App.NoDiceSoNice"));
      return null;
    }
    owner ??= selectedCharacter() ?? game.user;
    if (this.instance) this.instance.#setOwner(owner);
    else this.instance = new this({ owner });
    if (this.instance.rendered) this.instance.bringToFront();
    this.instance.render({ force: true });
    return this.instance;
  }

  constructor({ owner = game.user, ...options } = {}) {
    super(options);
    this.owner = owner;
    const first = this.#firstTrail();
    this.#setConfig(first ?? game.settings.get(MODULE_ID, "lastConfig"));
    this.kinds = new Set(KINDS);
    this.presetId = null;
    this.preview = null;
    this.previewBuild = 0;
  }

  /** The layer being edited. */
  get layer() {
    return this.cfg.layers[this.sel];
  }

  #setConfig(cfg, sel = 0) {
    this.cfg = normalizeConfig(cfg);
    this.sel = Math.min(Math.max(0, sel), this.cfg.layers.length - 1);
  }

  /** The first trail the owner has, to open the editor on. */
  #firstTrail() {
    const mine = trails(this.owner);
    const first = KINDS.map(k => mine[k]).find(Boolean);
    return first ? foundry.utils.deepClone(first) : null;
  }

  /** Edit another owner's trails: load the trail it has, keep the one in the editor if it has none. */
  #setOwner(owner) {
    if (!owner || owner === this.owner) return;
    this.owner = owner;
    const first = this.#firstTrail();
    if (first) this.#setConfig(first);
    this.presetId = null;
    if (this.rendered) {
      const title = this.window?.title;
      if (title) title.textContent = this.title;
      this.render({ parts: ["main"] });
    }
  }

  get title() {
    return `${game.i18n.localize("DXDT.App.Title")}: ${ownerLabel(this.owner ?? game.user)}`;
  }

  /** Who can be picked in the window: you, the owner being edited, your character and selected tokens you own. */
  #owners() {
    const list = [game.user, this.owner, game.user.character, ...(canvas?.tokens?.controlled ?? []).map(t => t.actor)];
    const seen = new Set();
    return list.filter(o => {
      const ref = o && (o.documentName === "User" || o.isOwner) ? ownerRef(o) : null;
      if (!ref || seen.has(ref)) return false;
      seen.add(ref);
      return true;
    });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const layer = this.layer;
    const isCustom = layer.design === CUSTOM;
    const design = isCustom ? null : DESIGNS[layer.design];
    const slider = (name, label, min, max, step, fmt = "pct") =>
      ({ name, label, min, max, step, fmt, value: layer[name], text: FORMAT[fmt](layer[name]) });
    const motion = isCustom ? MOTIONS[layer.motion] : null;
    const saved = presets();
    if (this.presetId && !saved.some(p => p.id === this.presetId)) this.presetId = null;
    const mine = trails(this.owner);
    const customLabel = game.i18n.localize("DXDT.App.CustomImage");
    const current = ownerRef(this.owner);
    // The category being browsed: the one picked in the dropdown, until another layer is edited; else the design's.
    const categories = designCategories(customLabel);
    const category = (this.browse?.layer === layer && categories.find(c => c.id === this.browse.category))
      || categories.find(c => c.designs.includes(layer.design)) || categories[0];

    return {
      kinds: KINDS.map(k => ({
        id: k, label: game.i18n.localize(`DXDT.Kind.${k}`), hint: game.i18n.localize(`DXDT.KindHint.${k}`),
        trail: mine[k] ? trailLabel(mine[k], customLabel) : null, checked: this.kinds.has(k)
      })),
      owners: this.#owners().map(o => ({ id: ownerRef(o), label: ownerLabel(o), selected: ownerRef(o) === current })),
      isCharacter: this.owner.documentName !== "User",
      allChecked: this.kinds.size === KINDS.length,
      canApply: this.kinds.size > 0,

      layers: this.cfg.layers.map((l, i) => ({
        index: i,
        label: layerLabel(l) ?? customLabel,
        icon: l.design === CUSTOM ? "fa-solid fa-image" : DESIGNS[l.design].icon,
        thumb: l.design === CUSTOM && l.src ? l.src : null,
        active: i === this.sel
      })),
      layerNumber: this.sel + 1,
      layerCount: this.cfg.layers.length,
      canAddLayer: this.cfg.layers.length < MAX_LAYERS,
      canRemoveLayer: this.cfg.layers.length > 1,
      canMoveDown: this.sel > 0,
      canMoveUp: this.sel < this.cfg.layers.length - 1,

      categories: categories.map(c => ({ id: c.id, label: c.label, selected: c.id === category.id })),
      designs: category.designs.map(id => ({
        id, active: id === layer.design,
        label: id === CUSTOM ? customLabel : DESIGNS[id].label,
        icon: id === CUSTOM ? "fa-solid fa-image" : DESIGNS[id].icon
      })),
      designIcon: isCustom ? "fa-solid fa-image" : design.icon,
      isCustom,
      styles: design ? Object.entries(design.styles).map(([id, s]) => ({ id, label: s.label, active: id === layer.style })) : [],
      designLabel: design?.label ?? "",

      // Your own image
      src: isCustom ? layer.src : "",
      canUpload: game.user.can("FILES_UPLOAD"),
      canBrowse: game.user.can("FILES_BROWSE"),
      motions: Object.entries(MOTIONS).map(([id, m]) => ({ id, label: game.i18n.localize(m.label), selected: id === layer.motion })),
      colorModes: COLOR_MODES.map(id => ({ id, label: game.i18n.localize(`DXDT.ColorMode.${id}`), selected: id === layer.colorMode })),
      customSliders: isCustom ? [
        slider("size", "DXDT.App.ImageSize", 0.05, 4, 0.05, "mul"),
        ...(motion.single ? [] : [slider("count", "DXDT.App.Count", 1, 40, 1, "int")])
      ] : [],
      showImageColor: isCustom && layer.colorMode !== "original",
      additive: isCustom && layer.blend === "add",

      sliders: [
        slider("scale", "DXDT.App.Width", 0.4, 2.5, 0.05),
        slider("length", "DXDT.App.Length", 0.3, 2.5, 0.05),
        slider("speed", "DXDT.App.Speed", 0, 3, 0.05),
        slider("alpha", "DXDT.App.Opacity", 0.1, 1, 0.05),
        slider("density", "DXDT.App.Density", 0, 2.5, 0.05)
      ],
      effects: [
        slider("glow", "DXDT.Effect.Glow", 0, 1, 0.05),
        slider("pulse", "DXDT.Effect.Pulse", 0, 1, 0.05),
        slider("sparkle", "DXDT.Effect.Sparkle", 0, 1, 0.05),
        slider("wave", "DXDT.Effect.Wave", 0, 1, 0.05)
      ],
      useColor: !isCustom && !!layer.color,
      color: layer.color ?? "#8a5aff",

      // Sound: the design's own (an image has none), none, or any theme
      sounds: [
        { id: "", label: game.i18n.localize(isCustom ? "DXDT.Sound.none" : "DXDT.Sound.auto"), selected: layer.sound == null },
        ...(isCustom ? [] : [{ id: "none", label: game.i18n.localize("DXDT.Sound.none"), selected: layer.sound === "none" }]),
        ...SOUNDS.map(id => ({ id, label: game.i18n.localize(`DXDT.Sound.${id}`), selected: layer.sound === id }))
      ],
      soundTheme: layer.sound ?? (isCustom ? null : design.sound),

      presets: saved.map(p => ({ id: p.id, name: p.name, selected: p.id === this.presetId })),
      hasPreset: !!this.presetId
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;
    const layer = () => this.layer;

    // Sliders and colours update the preview live, without re-rendering the window.
    for (const input of html.querySelectorAll("input[type=range]")) {
      input.addEventListener("input", ev => {
        const el = ev.currentTarget;
        const v = Number(el.value);
        layer()[el.name] = el.dataset.fmt === "int" ? Math.round(v) : v;
        const out = html.querySelector(`output[data-for="${el.name}"]`);
        if (out) out.textContent = FORMAT[el.dataset.fmt ?? "pct"](v);
        this.#rebuildPreview();
      });
    }

    const useColor = html.querySelector("input[name=useColor]");
    const color = html.querySelector("input[name=color]");
    if (useColor) {
      const onColor = () => {
        layer().color = useColor.checked ? color.value : null;
        color.disabled = !useColor.checked;
        this.#rebuildPreview();
      };
      useColor.addEventListener("change", onColor);
      color?.addEventListener("input", onColor);
    } else {
      // Own image in "tint" or "recolour" mode: the colour is always on.
      color?.addEventListener("input", ev => { layer().color = ev.currentTarget.value; this.#rebuildPreview(); });
    }

    html.querySelector("select[name=motion]")?.addEventListener("change", ev => {
      const m = MOTIONS[ev.currentTarget.value];
      if (!m) return;
      Object.assign(layer(), { motion: ev.currentTarget.value, size: m.size, count: m.count });
      this.render({ parts: ["main"] });
    });
    html.querySelector("select[name=colorMode]")?.addEventListener("change", ev => {
      const l = layer();
      l.colorMode = ev.currentTarget.value;
      if (l.colorMode !== "original" && !l.color) l.color = "#8a5aff";
      this.render({ parts: ["main"] });
    });
    html.querySelector("input[name=additive]")?.addEventListener("change", ev => {
      layer().blend = ev.currentTarget.checked ? "add" : "normal";
      this.#rebuildPreview();
    });
    // The sound: choosing one plays its bounce hit, and the "hear it" button plays the current one.
    const currentSound = () => {
      const l = layer();
      return l.sound ?? (l.design === CUSTOM ? null : DESIGNS[l.design].sound);
    };
    html.querySelector("select[name=sound]")?.addEventListener("change", ev => {
      layer().sound = ev.currentTarget.value || null;
      const theme = currentSound();
      if (theme && theme !== "none") playHit(theme, 1);
      this.#rebuildPreview();
    });
    html.querySelector("button[name=playSound]")?.addEventListener("click", () => {
      const theme = currentSound();
      if (theme && theme !== "none") playHit(theme, 1);
    });
    html.querySelector("input[name=src]")?.addEventListener("change", ev => {
      layer().src = ev.currentTarget.value.trim();
      this.render({ parts: ["main"] });
    });
    html.querySelector("input[name=imageFile]")?.addEventListener("change", ev => {
      const file = ev.currentTarget.files?.[0];
      ev.currentTarget.value = "";
      if (file) this.#upload(file);
    });
    html.querySelector("input[name=trailFile]")?.addEventListener("change", ev => {
      const file = ev.currentTarget.files?.[0];
      ev.currentTarget.value = "";
      if (file) this.#import(file);
    });
    html.querySelector("select[name=preset]")?.addEventListener("change", ev => {
      this.presetId = ev.currentTarget.value || null;
      this.render({ parts: ["main"] });
    });
    for (const box of html.querySelectorAll("input[name=kind]")) {
      box.addEventListener("change", ev => {
        if (ev.currentTarget.checked) this.kinds.add(ev.currentTarget.value);
        else this.kinds.delete(ev.currentTarget.value);
        this.#updateKindButtons();
      });
    }

    html.querySelector("select[name=category]")?.addEventListener("change", ev => {
      this.browse = { layer: this.layer, category: ev.currentTarget.value };
      this.render({ parts: ["main"] });
    });
    html.querySelector("select[name=owner]")?.addEventListener("change", ev => this.#setOwner(ownerFromRef(ev.currentTarget.value)));

    requestAnimationFrame(() => this.#fitWidth());
    await this.#mountPreview();
  }

  /**
   * Widen the window until nothing in it is cut off, up to the width of the screen. Whatever still does
   * not fit scrolls inside the window.
   */
  #fitWidth() {
    const html = this.element;
    if (!html?.isConnected) return;
    const overflow = Math.max(0, ...[".dxdt-body", ".dxdt-footer"].map(sel => {
      const el = html.querySelector(sel);
      return el ? el.scrollWidth - el.clientWidth : 0;
    }));
    if (overflow <= 0) return;
    const current = html.offsetWidth;
    const width = Math.min(current + overflow + 2, window.innerWidth - 16);
    if (width <= current) return;
    const left = Math.max(0, Math.min(this.position.left - (width - current) / 2, window.innerWidth - width));
    this.setPosition({ width, left, height: "auto" });
  }

  #updateKindButtons() {
    const html = this.element;
    const none = this.kinds.size === 0;
    for (const b of html.querySelectorAll("[data-action=apply], [data-action=remove]")) b.disabled = none;
    const all = html.querySelector("input[name=allKinds]");
    if (all) all.checked = this.kinds.size === KINDS.length;
  }

  /* -------------------------------------------- */
  /*  Preview                                     */
  /* -------------------------------------------- */

  async #mountPreview() {
    const host = this.element.querySelector(".dxdt-preview");
    if (!host) return;
    if (!this.preview) {
      try {
        await loadThree();
        if (!this.rendered || this.preview) return;
        this.preview = new TrailPreview(host);
      } catch (err) {
        console.error(`${MODULE_ID} | the preview could not be started`, err);
        host.textContent = game.i18n.localize("DXDT.App.NoPreview");
        return;
      }
    } else {
      host.appendChild(this.preview.renderer.domElement);
    }
    this.#rebuildPreview();
  }

  /** Rebuild the preview shortly after the last change (a slider drag sends many). */
  #rebuildPreview() {
    clearTimeout(this._previewTimer);
    this._previewTimer = setTimeout(() => this.#buildPreview(), 40);
  }

  async #buildPreview() {
    const build = ++this.previewBuild;
    const cfg = normalizeConfig(this.cfg);
    try { await loadCustomTextures(cfg); } catch (_) { /* a failed image draws as a plain glow */ }
    // A newer change arrived while the images loaded, or the window closed.
    if (build !== this.previewBuild || !this.preview) return;
    this.preview.setEffect(compileTrail(cfg));
    setPreviewEffect(cfg);           // dice from a test roll still on the table follow along
  }

  async close(options) {
    this.previewBuild++;
    clearTimeout(this._previewTimer);
    this.preview?.destroy();
    this.preview = null;
    setPreviewEffect(null);
    DiceTrailsEditor.instance = null;
    return super.close(options);
  }

  /* -------------------------------------------- */
  /*  Your own image                              */
  /* -------------------------------------------- */

  #setImage(path) {
    if (!path || this.layer.design !== CUSTOM) return;
    this.layer.src = path;
    this.render({ parts: ["main"] });
  }

  /** Upload a file into the world's folder for this module and use it. */
  async #upload(file) {
    if (!game.user.can("FILES_UPLOAD")) return ui.notifications.warn(game.i18n.localize("DXDT.App.NoUpload"));
    if (!file.type.startsWith("image/")) return ui.notifications.warn(game.i18n.localize("DXDT.App.NotImage"));
    const FP = foundry.applications.apps.FilePicker.implementation;
    const dir = `worlds/${game.world.id}/${MODULE_ID}`;
    try { await FP.createDirectory("data", dir, {}); } catch (_) { /* already there */ }
    try {
      const res = await FP.upload("data", dir, file, {}, { notify: true });
      if (res?.path) this.#setImage(res.path);
    } catch (err) {
      console.error(`${MODULE_ID} | upload failed`, err);
      ui.notifications.error(game.i18n.localize("DXDT.App.UploadFailed"));
    }
  }

  /* -------------------------------------------- */
  /*  Export / import                             */
  /* -------------------------------------------- */

  /** A saved name that isn't taken yet: "Name", "Name (2)", ... */
  static #freeName(name) {
    const taken = new Set(presets().map(p => p.name.toLowerCase()));
    let candidate = name.slice(0, 60);
    for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${name.slice(0, 54)} (${i})`;
    return candidate;
  }

  async #import(file) {
    if (this._importing) return;
    this._importing = true;
    try {
      const result = await importTrail(file);
      this.#setConfig(result.cfg);
      const name = DiceTrailsEditor.#freeName(result.name);
      this.presetId = await savePreset(name, result.cfg);
      ui.notifications.info(game.i18n.format("DXDT.Transfer.Imported", { name, n: result.uploaded }));
      if (result.skipped.length) {
        ui.notifications.warn(game.i18n.format(game.user.can("FILES_UPLOAD") ? "DXDT.Transfer.ImageFailed" : "DXDT.Transfer.NoUploadImport",
          { files: result.skipped.join(", ") }));
      }
      this.render({ parts: ["main"] });
    } catch (err) {
      console.error(`${MODULE_ID} | import failed`, err);
      ui.notifications.error(game.i18n.format("DXDT.Transfer.ImportFailed", { error: err.message }));
    } finally {
      this._importing = false;
    }
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Give the current layer another design, keeping its fine-tuning and effects. */
  #chooseDesign(id) {
    const old = this.layer;
    if (id === old.design || (id !== CUSTOM && !DESIGNS[id])) return;
    // Keep the fine-tuning and effects, change what is drawn.
    const keep = { scale: old.scale, length: old.length, speed: old.speed, alpha: old.alpha, density: old.density,
                   glow: old.glow, pulse: old.pulse, sparkle: old.sparkle, wave: old.wave };
    this.cfg.layers[this.sel] = normalizeLayer(id === CUSTOM
      ? { ...keep, design: CUSTOM }
      : { ...keep, color: old.color, design: id, style: Object.keys(DESIGNS[id].styles)[0] });
    this.render({ parts: ["main"] });
  }

  static #onDesign(event, target) {
    this.#chooseDesign(target.dataset.design);
  }

  static #onStyle(event, target) {
    const id = target.dataset.style;
    const layer = this.layer;
    if (layer.design === CUSTOM || !DESIGNS[layer.design].styles[id]) return;
    layer.style = id;
    this.render({ parts: ["main"] });
  }

  static #onSelectLayer(event, target) {
    const i = Number(target.dataset.index);
    if (!this.cfg.layers[i] || i === this.sel) return;
    this.sel = i;
    this.render({ parts: ["main"] });
  }

  static #onAddLayer() {
    if (this.cfg.layers.length >= MAX_LAYERS) return;
    // Glints are the most common thing to add on top of a trail.
    this.cfg.layers.push(normalizeLayer({ design: "stardust", style: "stardust" }));
    this.sel = this.cfg.layers.length - 1;
    this.render({ parts: ["main"] });
  }

  static #onDuplicateLayer() {
    if (this.cfg.layers.length >= MAX_LAYERS) return;
    this.cfg.layers.splice(this.sel + 1, 0, foundry.utils.deepClone(this.layer));
    this.sel++;
    this.render({ parts: ["main"] });
  }

  /** Move the layer towards the top (+1, drawn later) or the bottom (-1). */
  static #onMoveLayer(event, target) {
    const to = this.sel + Number(target.dataset.dir);
    if (to < 0 || to >= this.cfg.layers.length) return;
    const [l] = this.cfg.layers.splice(this.sel, 1);
    this.cfg.layers.splice(to, 0, l);
    this.sel = to;
    this.render({ parts: ["main"] });
  }

  static #onRemoveLayer() {
    if (this.cfg.layers.length <= 1) return;
    this.cfg.layers.splice(this.sel, 1);
    this.sel = Math.min(this.sel, this.cfg.layers.length - 1);
    this.render({ parts: ["main"] });
  }

  static #onBrowseImage() {
    const FP = foundry.applications.apps.FilePicker.implementation;
    new FP({ type: "image", current: this.layer.src || "", callback: path => this.#setImage(path) }).render(true);
  }

  static #onUploadImage() {
    this.element.querySelector("input[name=imageFile]")?.click();
  }

  static #onLoadPreset() {
    const p = presets().find(x => x.id === this.presetId);
    if (!p) return;
    this.#setConfig(foundry.utils.deepClone(p.cfg));
    this.render({ parts: ["main"] });
  }

  static async #onSavePreset() {
    const current = presets().find(x => x.id === this.presetId);
    const value = escapeHTML(current?.name);
    let name;
    try {
      name = await foundry.applications.api.DialogV2.prompt({
        window: { title: "DXDT.App.SaveTitle" },
        content: `<label>${game.i18n.localize("DXDT.App.SaveName")} <input type="text" name="name" value="${value}" maxlength="60" autofocus></label>`,
        ok: { label: "DXDT.App.Save", icon: "fa-solid fa-floppy-disk", callback: (ev, button) => button.form.elements.name.value },
        rejectClose: false
      });
    } catch (_) { return; }
    if (!name?.trim()) return;
    this.presetId = await savePreset(name, this.cfg);
    ui.notifications.info(game.i18n.format("DXDT.App.Saved", { name: name.trim() }));
    this.render({ parts: ["main"] });
  }

  static async #onDeletePreset() {
    const p = presets().find(x => x.id === this.presetId);
    if (!p) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "DXDT.App.DeleteTitle" },
      content: `<p>${game.i18n.format("DXDT.App.DeleteConfirm", { name: escapeHTML(p.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    await deletePreset(p.id);
    this.presetId = null;
    this.render({ parts: ["main"] });
  }

  static async #onExport() {
    const cfg = normalizeConfig(this.cfg);
    const current = presets().find(x => x.id === this.presetId);
    let name;
    try {
      name = await foundry.applications.api.DialogV2.prompt({
        window: { title: "DXDT.Transfer.ExportTitle", icon: "fa-solid fa-file-export" },
        content: `<p>${game.i18n.localize("DXDT.Transfer.ExportText")}</p>
          <label>${game.i18n.localize("DXDT.App.SaveName")} <input type="text" name="name" value="${escapeHTML(current?.name ?? "")}" maxlength="60" autofocus></label>`,
        ok: { label: "DXDT.Transfer.Export", icon: "fa-solid fa-file-export", callback: (ev, button) => button.form.elements.name.value },
        rejectClose: false
      });
    } catch (_) { return; }
    if (name === null || name === undefined) return;
    try {
      const { file } = await exportTrail(cfg, name);
      ui.notifications.info(game.i18n.format("DXDT.Transfer.Exported", { file }));
    } catch (err) {
      console.error(`${MODULE_ID} | export failed`, err);
      ui.notifications.error(game.i18n.localize("DXDT.Transfer.ExportFailed"));
    }
  }

  static #onImport() {
    this.element.querySelector("input[name=trailFile]")?.click();
  }

  static async #onTestRoll() {
    try {
      await previewTrail(normalizeConfig(this.cfg));
    } catch (err) {
      console.error(`${MODULE_ID} | test roll failed`, err);
    }
  }

  /** Load the trail a kind of roll has into the editor and pick that kind. */
  static #onEditKind(event, target) {
    const kind = target.dataset.kind;
    const cfg = trails(this.owner)[kind];
    if (!cfg) return;
    this.#setConfig(foundry.utils.deepClone(cfg));
    this.kinds = new Set([kind]);
    this.render({ parts: ["main"] });
  }

  static #onAllKinds(event, target) {
    if (this.kinds.size === KINDS.length) this.kinds.clear();
    else this.kinds = new Set(KINDS);
    for (const box of this.element.querySelectorAll("input[name=kind]")) box.checked = this.kinds.has(box.value);
    this.#updateKindButtons();
  }

  static async #onApply() {
    const cfg = normalizeConfig(this.cfg);
    if (cfg.layers.some(l => l.design === CUSTOM && !l.src)) {
      return ui.notifications.warn(game.i18n.localize("DXDT.App.NoImage"));
    }
    const kinds = KINDS.filter(k => this.kinds.has(k));
    if (!kinds.length) return ui.notifications.warn(game.i18n.localize("DXDT.App.NoKinds"));
    await setTrail(kinds, cfg, this.owner);
    await game.settings.set(MODULE_ID, "lastConfig", cfg);
    ui.notifications.info(game.i18n.format("DXDT.App.Applied", {
      owner: ownerLabel(this.owner), kinds: kinds.map(k => game.i18n.localize(`DXDT.Kind.${k}`)).join(", ")
    }));
    this.render({ parts: ["main"] });
  }

  static async #onRemove() {
    const kinds = KINDS.filter(k => this.kinds.has(k));
    if (!kinds.length) return ui.notifications.warn(game.i18n.localize("DXDT.App.NoKinds"));
    await clearTrail(kinds, this.owner);
    ui.notifications.info(game.i18n.format("DXDT.App.Removed", {
      owner: ownerLabel(this.owner), kinds: kinds.map(k => game.i18n.localize(`DXDT.Kind.${k}`)).join(", ")
    }));
    this.render({ parts: ["main"] });
  }

  /** Reset the current layer's fine-tuning and effects (keeps what it shows). */
  static #onReset() {
    const l = this.layer;
    const keep = l.design === CUSTOM
      ? { design: CUSTOM, src: l.src, motion: l.motion, size: MOTIONS[l.motion].size, count: MOTIONS[l.motion].count }
      : { design: l.design, style: l.style };
    this.cfg.layers[this.sel] = normalizeLayer(keep);
    this.render({ parts: ["main"] });
  }
}

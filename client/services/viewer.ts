// Three.js viewer: scene, orbit camera, picking, and the ViewerCommands (highlight, zoom, show_issues, reset).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ElementFacts } from "@shared/elementFacts";
import type { Severity } from "@shared/report";
import type { ViewerCommand } from "@shared/viewerCommand";
import type { CommandResult } from "../state/viewerStore";
import type { MeshData } from "./ifcEngine";

const HIGHLIGHT = new THREE.Color("#3b82f6");
const SEVERITY_COLOR: Record<Severity, THREE.Color> = { major: new THREE.Color("#ef4444"), minor: new THREE.Color("#f59e0b") };

interface Element {
  meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
  baseColors: THREE.Color[];
  baseOpacity: number[];
  isSpace: boolean;
}

export interface Viewer {
  add(meshes: MeshData[]): void;
  /** Connects the meshes (by expressId) to the elements' GlobalIds. */
  setFacts(facts: ElementFacts[]): void;
  run(cmd: ViewerCommand): CommandResult;
  onPick(listener: (globalId: string | null) => void): void;
  dispose(): void;
}

export function createViewer(host: HTMLElement): Viewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1419");
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(20, 40, 30);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);

  // Render only when something changed, not 60 times a second: saves battery and GPU.
  let frame = 0;
  const render = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderer.render(scene, camera);
    });
  };
  controls.addEventListener("change", render);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const byExpress = new Map<number, Element>();
  const byGlobal = new Map<string, Element>();
  const globalOf = new Map<number, string>();
  let issues = new Map<string, Severity>();
  let highlighted = new Set<string>();

  function paint() {
    for (const [expressId, el] of byExpress) {
      const gid = globalOf.get(expressId);
      const sev = gid ? issues.get(gid) : undefined;
      const lit = gid ? highlighted.has(gid) : false;
      // rooms are invisible unless they have an issue or are highlighted
      const visible = !el.isSpace || lit || !!sev;
      el.meshes.forEach((m, i) => {
        m.visible = visible;
        m.material.color.copy(lit ? HIGHLIGHT : sev ? SEVERITY_COLOR[sev] : el.baseColors[i]);
        m.material.opacity = el.isSpace ? 0.35 : el.baseOpacity[i];
        // a highlighted element is drawn last and over everything, so walls in front cannot hide it
        m.material.depthTest = !lit;
        m.renderOrder = lit ? 1 : 0;
      });
    }
    render();
  }

  function boxOf(elements: Element[]): THREE.Box3 {
    const box = new THREE.Box3();
    for (const el of elements) for (const m of el.meshes) box.expandByObject(m);
    return box;
  }

  function frameBox(box: THREE.Box3) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    // frame at least 8 m, so a single door is shown with the room around it (not from inside a wall)
    const distance = Math.max(size, 8) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    // look from the south-east and a bit above
    camera.position.copy(center).add(new THREE.Vector3(0.6, 0.7, 0.9).normalize().multiplyScalar(distance * 1.1));
    controls.target.copy(center);
    controls.update();
    render();
  }

  // Picking: a click (not a drag) sends a ray from the camera through the mouse and takes the first visible mesh.
  const listeners: ((gid: string | null) => void)[] = [];
  const raycaster = new THREE.Raycaster();
  let down = { x: 0, y: 0 };
  renderer.domElement.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; // the user rotated the view
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(scene.children, false).find((h) => h.object.visible);
    const gid = hit ? (globalOf.get(hit.object.userData.expressId as number) ?? null) : null;
    listeners.forEach((l) => l(gid));
  });

  return {
    add(meshes) {
      for (const data of meshes) {
        const el: Element = { meshes: [], baseColors: [], baseOpacity: [], isSpace: data.isSpace };
        for (const p of data.parts) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(p.positions, 3));
          geometry.setAttribute("normal", new THREE.BufferAttribute(p.normals, 3));
          geometry.setIndex(new THREE.BufferAttribute(p.indices, 1));
          const [r, g, b, a] = p.color;
          const opacity = data.isSpace ? 0.35 : a;
          const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(r, g, b), transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData.expressId = data.expressId;
          mesh.visible = !data.isSpace;
          scene.add(mesh);
          el.meshes.push(mesh);
          el.baseColors.push(material.color.clone());
          el.baseOpacity.push(opacity);
        }
        byExpress.set(data.expressId, el);
      }
      frameBox(boxOf([...byExpress.values()].filter((e) => !e.isSpace)));
    },
    setFacts(facts) {
      for (const f of facts) {
        globalOf.set(f.expressId, f.globalId);
        const el = byExpress.get(f.expressId);
        if (el) byGlobal.set(f.globalId, el);
      }
      paint();
    },
    run(cmd) {
      if (cmd.action === "reset") {
        highlighted = new Set();
        paint();
        frameBox(boxOf([...byExpress.values()].filter((e) => !e.isSpace)));
        return { ok: true };
      }
      if (cmd.action === "show_issues") {
        issues = new Map(cmd.issues.map((i) => [i.globalId, i.severity]));
        paint();
        return { ok: true };
      }
      const found = cmd.globalIds.map((g) => byGlobal.get(g)).filter((e): e is Element => !!e);
      if (!found.length) return { ok: false, error: "none of these elements is in the model" };
      if (cmd.action === "highlight") {
        highlighted = new Set(cmd.globalIds);
        paint();
      } else frameBox(boxOf(found));
      return { ok: true };
    },
    onPick(listener) {
      listeners.push(listener);
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

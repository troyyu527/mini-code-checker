// Three.js viewer: scene, lights, orbit camera, drawing only when something changed. Lesson 17 adds picking and commands.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MeshData } from "./ifcEngine";

export interface Viewer {
  add(meshes: MeshData[]): void;
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

  function frameBox(box: THREE.Box3) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const distance = Math.max(size, 8) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    // look from the south-east and a bit above
    camera.position.copy(center).add(new THREE.Vector3(0.6, 0.7, 0.9).normalize().multiplyScalar(distance * 1.1));
    controls.target.copy(center);
    controls.update();
    render();
  }

  return {
    add(meshes) {
      const box = new THREE.Box3();
      for (const data of meshes) {
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
          mesh.visible = !data.isSpace; // rooms are hidden for now
          scene.add(mesh);
          if (!data.isSpace) box.expandByObject(mesh);
        }
      }
      frameBox(box);
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
"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createDriftCoupe } from "./car-model";
type Props = {
  steering: number;
  active: boolean;
  demo: boolean;
  enlarged: boolean;
  onEnlarge: () => void;
  startSeen: boolean;
};
export default function DriveScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xe9eef1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xe9eef1, 30, 85);
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const reflection = pmrem.fromScene(environment, 0.04);
    scene.environment = reflection.texture;
    environment.dispose();
    pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 130);
    camera.position.set(4.6, 4.3, 8);
    camera.lookAt(-0.3, 0.1, -5);
    scene.add(new THREE.HemisphereLight(0xf5fcff, 0x657887, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-6, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    const materials: THREE.Material[] = [];
    const mat = (color: number, metalness = 0.1, roughness = 0.65) => {
      const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
      materials.push(m);
      return m;
    };
    const white = mat(0xf4f8fc, 0.35, 0.25),
      dark = mat(0x101b25, 0.2, 0.5),
      glass = mat(0x17313e, 0.5, 0.18),
      cyan = mat(0x00ccdf, 0.3, 0.3);
    const rubber = mat(0x11161c, 0, 0.9),
      alloy = mat(0x687f90, 0.8, 0.24),
      red = mat(0xed4740, 0.35, 0.27);
    const tail = new THREE.MeshStandardMaterial({
      color: 0xff2946,
      emissive: 0xff1233,
      emissiveIntensity: 2,
    });
    materials.push(tail);
    const geometries: THREE.BufferGeometry[] = [];
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    geometries.push(boxGeometry);
    function box(
      parent: THREE.Object3D,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      material: THREE.Material,
    ) {
      const mesh = new THREE.Mesh(boxGeometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      mat(0xe7edef, 0, 0.95),
    );
    geometries.push(ground.geometry);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    scene.add(ground);
    function road(left: number, right: number, y: number, color: number) {
      const vertices: number[] = [];
      const c = (z: number) => Math.sin(-z / 19) * 5;
      for (let z = 16; z > -95; z -= 0.5)
        vertices.push(
          c(z) + left,
          y,
          z,
          c(z) + right,
          y,
          z,
          c(z - 0.5) + right,
          y,
          z - 0.5,
          c(z) + left,
          y,
          z,
          c(z - 0.5) + right,
          y,
          z - 0.5,
          c(z - 0.5) + left,
          y,
          z - 0.5,
        );
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      geometries.push(g);
      const mesh = new THREE.Mesh(g, mat(color, 0, 0.95));
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    road(-5.3, 5.3, 0, 0x89929c);
    road(-5, -4.87, 0.009, 0xf8fcff);
    road(4.87, 5, 0.009, 0xf8fcff);
    const ownAsset = createDriftCoupe(0xf3f6f7);
    const own = ownAsset.group;
    own.position.set(0, 0, 0.8);
    scene.add(own);
    const leadAsset = createDriftCoupe(0xe53329);
    const lead = leadAsset.group;
    lead.position.set(4.4, 0, -14);
    lead.rotation.y = -0.1;
    scene.add(lead);
    const signCanvas = document.createElement("canvas");
    signCanvas.width = 512;
    signCanvas.height = 192;
    const ctx = signCanvas.getContext("2d")!;
    ctx.fillStyle = "#f8fafb";
    ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = "#14232e";
    ctx.font = "900 112px Arial";
    ctx.textAlign = "center";
    ctx.fillText("START", 256, 135);
    const texture = new THREE.CanvasTexture(signCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshBasicMaterial({ map: texture });
    materials.push(signMat);
    box(scene, -6.6, 0.85, -8, 0.07, 1.7, 0.07, dark);
    box(scene, -8.4, 0.85, -8, 0.07, 1.7, 0.07, dark);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.05), signMat);
    geometries.push(sign.geometry);
    sign.position.set(-7.5, 2, -7.95);
    scene.add(sign);
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.fov = camera.aspect < 1 ? 54 : 43;
      camera.position.set(
        3.1,
        camera.aspect < 1 ? 5.2 : 4.4,
        camera.aspect < 1 ? 11 : 9.5,
      );
      camera.lookAt(-1.4, 0.1, camera.aspect < 1 ? -2.5 : -4);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let animation = 0;
    let lastFrame = 0;
    const tick = (now: number) => {
      animation = requestAnimationFrame(tick);
      if (document.hidden || now - lastFrame < 1000 / 30) return;
      lastFrame = now;
      const p = latest.current;
      own.rotation.y = p.active ? -p.steering * 0.16 : 0;
      lead.visible = p.demo;
      sign.visible = p.demo;
      if (p.demo && p.active) {
        lead.position.x = 4.4 + Math.sin(now / 2800) * 0.35;
        lead.rotation.y = -0.12 + Math.sin(now / 3000) * 0.04;
      }
      for (const wheel of own.userData.frontWheels as THREE.Group[])
        wheel.rotation.y = p.active ? -p.steering * 0.3 : 0;
      renderer.render(scene, camera);
    };
    animation = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animation);
      observer.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      texture.dispose();
      ownAsset.dispose();
      leadAsset.dispose();
      reflection.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="scene" aria-label="Illustrative rear chase 3D scene">
      <div ref={host} className="scene-canvas" />
      {unavailable && (
        <div className="scene-fallback">
          3D preview unavailable on this browser.
          <br />
          Telemetry and gauges remain available.
        </div>
      )}
      <div className="scene-badges">
        <span>{props.demo ? "DEMO SCENE" : "ILLUSTRATIVE COURSE"}</span>
        {props.startSeen && (
          <span className="start-chip">✓ START DETECTED</span>
        )}
      </div>
      <button
        className="expand-scene"
        onClick={props.onEnlarge}
        aria-label={props.enlarged ? "Restore scene" : "Enlarge scene"}
      >
        {props.enlarged ? "↙" : "↗"}
      </button>
      <div className="scene-caption">
        <strong>
          {props.demo
            ? "SYNTHETIC COURSE / SIMULATED CARS"
            : "COSMETIC POSE / NO VEHICLE DETECTOR"}
        </strong>
        <span>
          {props.demo
            ? "Offline demo · sign-sighting lap simulation"
            : "Steering is a command, not measured drift angle"}
        </span>
      </div>
    </div>
  );
}

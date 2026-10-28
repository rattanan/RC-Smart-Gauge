import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Original procedural drift coupe. No downloaded model, trademark or image plane. */
export function createDriftCoupe(color = 0xf3f6f7) {
  const car = new THREE.Group();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const keep = <T extends THREE.BufferGeometry>(geometry: T) => {
    geometries.add(geometry);
    return geometry;
  };
  const material = (options: THREE.MeshPhysicalMaterialParameters) => {
    const m = new THREE.MeshPhysicalMaterial(options);
    materials.add(m);
    return m;
  };
  const paint = material({
    color,
    metalness: 0.28,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
  });
  const glass = material({
    color: 0x15202b,
    metalness: 0.35,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const black = material({ color: 0x111820, metalness: 0.35, roughness: 0.36 });
  const seam = material({ color: 0x26323c, metalness: 0.1, roughness: 0.7 });
  const rubber = material({ color: 0x15191d, metalness: 0, roughness: 0.86 });
  const chrome = material({ color: 0x7b8790, metalness: 0.95, roughness: 0.2 });
  const rim = material({ color: 0x242b33, metalness: 0.85, roughness: 0.25 });
  const cyan = material({ color: 0x00c7dc, metalness: 0.3, roughness: 0.24 });
  const red = material({
    color: 0xf3243e,
    emissive: 0xff0928,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });
  const whiteLED = material({
    color: 0xedf7ff,
    emissive: 0xb9dfff,
    emissiveIntensity: 1.1,
  });
  const brake = material({ color: 0x444d54, metalness: 0.8, roughness: 0.48 });
  const caliper = material({
    color: 0xc91f2d,
    metalness: 0.25,
    roughness: 0.5,
  });
  const mesh = (
    geometry: THREE.BufferGeometry,
    m: THREE.Material,
    parent: THREE.Object3D = car,
  ) => {
    const result = new THREE.Mesh(geometry, m);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  };
  const boxCache = new Map<string, THREE.BufferGeometry>();
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    r = 0.025,
    parent: THREE.Object3D = car,
  ) {
    const key = [w, h, d, r].join("/");
    let geo = boxCache.get(key);
    if (!geo) {
      geo = keep(
        new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3)),
      );
      boxCache.set(key, geo);
    }
    const result = mesh(geo, m, parent);
    result.position.set(x, y, z);
    return result;
  }
  function panel(
    points: number[][],
    m: THREE.Material,
    parent: THREE.Object3D = car,
  ) {
    const g = keep(new THREE.BufferGeometry());
    const vertices: number[] = [];
    for (let i = 1; i < points.length - 1; i++)
      vertices.push(...points[0], ...points[i], ...points[i + 1]);
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    const result = mesh(g, m, parent);
    result.material.side = THREE.DoubleSide;
    return result;
  }
  function tube(
    points: number[][],
    radius: number,
    m: THREE.Material,
    parent: THREE.Object3D = car,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...(p as [number, number, number]))),
    );
    return mesh(
      keep(
        new THREE.TubeGeometry(
          curve,
          Math.max(12, points.length * 8),
          radius,
          6,
          false,
        ),
      ),
      m,
      parent,
    );
  }
  const axles = [-1.43, 1.46];
  const wheelY = 0.515;
  function widthAt(z: number) {
    const fenders =
      0.155 * Math.exp(-Math.pow((z + 1.43) / 0.62, 2)) +
      0.17 * Math.exp(-Math.pow((z - 1.46) / 0.68, 2));
    return (
      1.09 +
      fenders -
      0.15 * Math.exp(-Math.pow((Math.abs(z) - 2.48) / 0.19, 2))
    );
  }
  function topAt(z: number) {
    return (
      1.035 -
      0.18 * Math.exp(-Math.pow((Math.abs(z) - 2.48) / 0.23, 2)) +
      0.025 * Math.exp(-Math.pow((z - 1.45) / 0.6, 2))
    );
  }
  // Superellipse loft gives a continuous curved shell; wheel holes are cut from its side faces.
  const shell: number[] = [];
  const zSteps = 150,
    ringSteps = 64;
  const ring = (zi: number, ri: number) => {
    const z = -2.48 + (zi / zSteps) * 4.96,
      a = (ri / ringSteps) * Math.PI * 2;
    const x =
      Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.34 * widthAt(z);
    const fraction =
      0.5 + 0.5 * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.5;
    return [x, 0.27 + fraction * (topAt(z) - 0.27), z];
  };
  const inArch = (a: number[], b: number[], c: number[]) => {
    const x = (a[0] + b[0] + c[0]) / 3,
      y = (a[1] + b[1] + c[1]) / 3,
      z = (a[2] + b[2] + c[2]) / 3;
    return (
      Math.abs(x) > 0.78 * widthAt(z) &&
      axles.some((axle) => (z - axle) ** 2 + (y - wheelY) ** 2 < 0.56 ** 2)
    );
  };
  for (let zi = 0; zi < zSteps; zi++)
    for (let ri = 0; ri < ringSteps; ri++) {
      const a = ring(zi, ri),
        b = ring(zi + 1, ri),
        c = ring(zi + 1, ri + 1),
        d = ring(zi, ri + 1);
      if (!inArch(a, b, c)) shell.push(...a, ...b, ...c);
      if (!inArch(a, c, d)) shell.push(...a, ...c, ...d);
    }
  const bodyGeometry = keep(new THREE.BufferGeometry());
  bodyGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(shell, 3),
  );
  bodyGeometry.computeVertexNormals();
  // Merge shared positions so neighboring triangles have continuous specular normals.
  const normals = bodyGeometry.attributes.normal;
  const positions = bodyGeometry.attributes.position;
  const averages = new Map<string, THREE.Vector3>();
  const vertexKey = (i: number) =>
    [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map((n) => n.toFixed(5))
      .join(",");
  for (let i = 0; i < positions.count; i++) {
    const key = vertexKey(i);
    const normal = averages.get(key) ?? new THREE.Vector3();
    normal.add(
      new THREE.Vector3(normals.getX(i), normals.getY(i), normals.getZ(i)),
    );
    averages.set(key, normal);
  }
  for (let i = 0; i < positions.count; i++) {
    const normal = averages.get(vertexKey(i))!.normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  mesh(bodyGeometry, paint);
  const end = (z: number) =>
    Array.from({ length: ringSteps }, (_, i) => ring(z < 0 ? 0 : zSteps, i));
  panel(end(-1), paint);
  panel(end(1).reverse(), paint);
  box(0, 0.28, 0, 1.94, 0.16, 4.42, black, 0.07);
  // Curved glass panels and painted roof. Front points toward negative Z.
  function glassPanel(
    z0: number,
    y0: number,
    w0: number,
    z1: number,
    y1: number,
    w1: number,
    m: THREE.Material,
  ) {
    const verts: number[] = [];
    const p = (i: number, j: number) => {
      const u = -1 + (i / 24) * 2,
        t = j / 16;
      const w = w0 + (w1 - w0) * t;
      return [
        u * w,
        y0 + (y1 - y0) * t + 0.025 * (1 - u * u),
        z0 + (z1 - z0) * t,
      ];
    };
    for (let i = 0; i < 24; i++)
      for (let j = 0; j < 16; j++) {
        const a = p(i, j),
          b = p(i + 1, j),
          c = p(i + 1, j + 1),
          d = p(i, j + 1);
        verts.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    const result = mesh(g, m);
    result.material.side = THREE.DoubleSide;
    return result;
  }
  glassPanel(-1.15, 1.0, 0.98, -0.49, 1.66, 0.78, glass);
  glassPanel(0.6, 1.67, 0.8, 1.46, 1.035, 1.01, glass);
  glassPanel(-0.51, 1.68, 0.81, 0.63, 1.69, 0.83, paint);
  for (const side of [-1, 1]) {
    panel(
      [
        [side * 0.98, 1.015, -1.1],
        [side * 0.78, 1.65, -0.48],
        [side * 0.81, 1.66, 0.59],
        [side * 1.02, 1.045, 1.38],
      ],
      glass,
    );
    // A and C pillars, side glazing frames and a restrained B pillar.
    tube(
      [
        [side * 1.025, 1.0, -1.17],
        [side * 0.88, 1.34, -0.83],
        [side * 0.8, 1.68, -0.5],
      ],
      0.043,
      paint,
    );
    panel(
      [
        [side * 0.8, 1.68, 0.55],
        [side * 0.88, 1.61, 0.77],
        [side * 1.08, 1.035, 1.51],
        [side * 1.02, 1.04, 1.24],
      ],
      paint,
    );
    tube(
      [
        [side * 0.805, 1.69, -0.49],
        [side * 0.82, 1.72, 0.08],
        [side * 0.83, 1.7, 0.62],
      ],
      0.038,
      paint,
    );
    tube(
      [
        [side * 0.99, 1.015, -1.1],
        [side * 1.09, 1.03, 0.1],
        [side * 1.03, 1.04, 1.35],
      ],
      0.024,
      paint,
    );
    tube(
      [
        [side * 0.82, 1.64, 0.27],
        [side * 1.065, 1.035, 0.43],
      ],
      0.024,
      black,
    );
    const doorZ = [-0.89, -0.78, 0.73, 0.91, 0.83, -0.72, -0.89];
    const doorY = [0.99, 0.42, 0.4, 0.51, 0.96, 0.98, 0.99];
    tube(
      doorZ.map((z, i) => [side * (widthAt(z) + 0.007), doorY[i], z]),
      0.008,
      seam,
    );
    box(side * 1.23, 0.91, 0.73, 0.018, 0.045, 0.24, black, 0.01);
    // Side skirt and cyan accent follow the low body line.
    box(side * 1.115, 0.31, 0.06, 0.14, 0.16, 1.85, paint, 0.035);
    box(side * 1.19, 0.345, 0.08, 0.018, 0.026, 1.7, cyan, 0.006);
    const mirror = box(
      side * 1.16,
      1.13,
      -0.77,
      0.32,
      0.14,
      0.25,
      paint,
      0.055,
    );
    mirror.rotation.y = side * 0.2;
    box(side * 1.19, 1.13, -0.64, 0.24, 0.095, 0.025, glass, 0.02);
    for (const axle of axles) {
      const lip = mesh(
        keep(new THREE.TorusGeometry(0.56, 0.035, 8, 56, Math.PI)),
        paint,
      );
      lip.rotation.y = Math.PI / 2;
      lip.position.set(side * (widthAt(axle) + 0.008), wheelY, axle);
    }
  }
  const tireProfile = [
    new THREE.Vector2(0.31, -0.22),
    new THREE.Vector2(0.45, -0.22),
    new THREE.Vector2(0.53, -0.16),
    new THREE.Vector2(0.55, -0.1),
    new THREE.Vector2(0.55, 0.1),
    new THREE.Vector2(0.53, 0.16),
    new THREE.Vector2(0.45, 0.22),
    new THREE.Vector2(0.31, 0.22),
  ];
  const tireGeometry = keep(new THREE.LatheGeometry(tireProfile, 48));
  tireGeometry.rotateZ(Math.PI / 2);
  const discGeometry = keep(new THREE.CylinderGeometry(0.3, 0.3, 0.032, 40));
  discGeometry.rotateZ(Math.PI / 2);
  const spokeGeometry = keep(
    new RoundedBoxGeometry(0.035, 0.035, 0.33, 2, 0.007),
  );
  const hubGeometry = keep(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16));
  hubGeometry.rotateZ(Math.PI / 2);
  const nutGeometry = keep(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 6));
  nutGeometry.rotateZ(Math.PI / 2);
  const rimRingGeometry = keep(new THREE.TorusGeometry(0.352, 0.02, 8, 48));
  rimRingGeometry.rotateY(Math.PI / 2);
  const innerRingGeometry = keep(new THREE.TorusGeometry(0.322, 0.012, 6, 48));
  innerRingGeometry.rotateY(Math.PI / 2);
  const treadGeometry = keep(new THREE.TorusGeometry(0.547, 0.0035, 3, 48));
  treadGeometry.rotateY(Math.PI / 2);
  const fronts: THREE.Group[] = [];
  for (const side of [-1, 1])
    for (const axle of axles) {
      const wheel = new THREE.Group();
      wheel.position.set(side * 1.1, wheelY, axle);
      wheel.scale.setScalar(0.92);
      wheel.rotation.z = -side * 0.035;
      car.add(wheel);
      if (axle < 0) fronts.push(wheel);
      mesh(tireGeometry, rubber, wheel);
      for (const offset of [-0.11, 0, 0.11])
        mesh(treadGeometry, seam, wheel).position.x = offset;
      const outward = side * 0.225;
      mesh(discGeometry, brake, wheel).position.x = side * 0.16;
      box(side * 0.18, 0.1, -0.2, 0.065, 0.25, 0.12, caliper, 0.03, wheel);
      mesh(rimRingGeometry, chrome, wheel).position.x = outward;
      mesh(innerRingGeometry, rim, wheel).position.x = outward - 0.005 * side;
      mesh(hubGeometry, rim, wheel).position.x = outward;
      for (let i = 0; i < 5; i++)
        for (const pair of [-0.07, 0.07]) {
          const angle = (i * Math.PI * 2) / 5 + pair;
          const spoke = mesh(spokeGeometry, rim, wheel);
          spoke.position.set(
            outward,
            Math.sin(angle) * 0.19,
            Math.cos(angle) * 0.19,
          );
          spoke.rotation.x = -angle;
        }
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5;
        mesh(nutGeometry, chrome, wheel).position.set(
          outward + side * 0.04,
          Math.sin(angle) * 0.057,
          Math.cos(angle) * 0.057,
        );
      }
    }
  car.userData.frontWheels = fronts;
  // Layered rear lights, trim, plate, diffuser and double-wall exhaust tips.
  box(0, 0.56, 2.44, 2.18, 0.31, 0.1, paint, 0.08);
  box(0, 0.285, 2.43, 1.85, 0.15, 0.22, black, 0.04);
  for (const side of [-1, 1]) {
    box(side * 0.73, 0.83, 2.4, 0.72, 0.2, 0.08, black, 0.06);
    box(side * 0.73, 0.83, 2.45, 0.58, 0.055, 0.025, red, 0.018);
    box(side * 0.73, 0.77, 2.449, 0.55, 0.02, 0.025, red, 0.008);
    box(side * 1.09, 0.44, 2.35, 0.09, 0.2, 0.1, black, 0.03);
    for (const x of [0.3, 0.65])
      box(side * x, 0.23, 2.48, 0.035, 0.15, 0.29, black, 0.005);
  }
  const exhaustGeometry = keep(
    new THREE.CylinderGeometry(0.1, 0.095, 0.27, 24, 1, true),
  );
  exhaustGeometry.rotateX(Math.PI / 2);
  const exhaustHoleGeometry = keep(new THREE.CircleGeometry(0.076, 24));
  const exhaustRimGeometry = keep(new THREE.TorusGeometry(0.09, 0.012, 8, 24));
  for (const x of [-0.62, -0.37]) {
    mesh(exhaustGeometry, chrome).position.set(x, 0.29, 2.52);
    mesh(exhaustHoleGeometry, black).position.set(x, 0.29, 2.64);
    mesh(exhaustRimGeometry, chrome).position.set(x, 0.29, 2.66);
  }
  const plateCanvas = document.createElement("canvas");
  plateCanvas.width = 384;
  plateCanvas.height = 128;
  const context = plateCanvas.getContext("2d")!;
  context.fillStyle = "#10232f";
  context.fillRect(0, 0, 384, 128);
  context.fillStyle = "#8bbac6";
  context.font = "bold 46px Arial";
  context.textAlign = "center";
  context.fillText("RC SMART", 192, 84);
  const plateTexture = new THREE.CanvasTexture(plateCanvas);
  plateTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(plateTexture);
  const plateMaterial = new THREE.MeshStandardMaterial({
    map: plateTexture,
    roughness: 0.5,
  });
  materials.add(plateMaterial);
  mesh(keep(new THREE.PlaneGeometry(0.64, 0.21)), plateMaterial).position.set(
    0,
    0.59,
    2.5,
  );
  // Airfoil-style wing with end plates, mounted below the roof line.
  for (const side of [-1, 1]) {
    const mount = box(side * 0.78, 1.18, 1.94, 0.045, 0.42, 0.14, black, 0.008);
    mount.rotation.x = -0.13;
    box(side * 1.31, 1.46, 1.94, 0.035, 0.16, 0.47, black, 0.012);
  }
  const wing = box(0, 1.4, 1.95, 2.65, 0.065, 0.45, black, 0.022);
  wing.rotation.x = 0.08;
  box(0, 1.045, 1.91, 2.15, 0.035, 0.53, paint, 0.016);
  // Front fascia and subtle panel gaps, visible when the cosmetic pose turns.
  box(0, 0.43, -2.44, 1.25, 0.27, 0.07, black, 0.025);
  box(0, 0.4, -2.49, 0.84, 0.14, 0.012, chrome, 0.005);
  for (const side of [-1, 1]) {
    const housing = box(
      side * 0.73,
      0.86,
      -2.38,
      0.71,
      0.17,
      0.08,
      glass,
      0.045,
    );
    housing.rotation.y = -side * 0.1;
    box(side * 0.73, 0.85, -2.425, 0.57, 0.035, 0.025, whiteLED, 0.01);
    box(side * 0.91, 0.44, -2.38, 0.31, 0.2, 0.08, black, 0.025);
    tube(
      [
        [side * 0.87, 0.985, -2.14],
        [side * 0.85, 1.04, -1.85],
        [side * 0.77, 1.04, -1.13],
      ],
      0.007,
      seam,
    );
  }
  return {
    group: car,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

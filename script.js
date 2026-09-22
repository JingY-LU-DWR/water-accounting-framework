import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const SPACE_MAX = 10;
const SPACE_CENTER = new THREE.Vector3(5, 5, 5);

const options = {
  A: {
    name: "Maintain",
    temporal: 3,
    spatial: 5,
    hydrological: 4,
    description: "Continuity / current capability",
    color: "#6f8fa8",
    costLabel: ["$2M"],
    investment: {
      lines: ["Estimated Investment:", "$2M"]
    }
  },
  B: {
    name: "Enhance",
    temporal: 4,
    spatial: 7,
    hydrological: 6,
    description: "Improve the current system",
    color: "#4a7ea5",
    costLabel: ["$3.6M"],
    investment: {
      lines: ["Estimated Investment:", "$3.6M"]
    }
  },
  X: {
    name: "Faster Delivery",
    temporal: 10,
    spatial: 6,
    hydrological: 2,
    hydrologicalDisplay: "2*",
    note: "* Working value; confirm hydrological score.",
    description: "Prioritize timeliness",
    color: "#567f89",
    costLabel: ["$2.5M/yr"],
    investment: {
      lines: ["Estimated Investment:", "$2.5M/year"],
      supplemental: "Alternative funding model: $1.0M/year incremental to A, B, or C. This incremental funding model is not a separate fifth option and is not automatically added to the standalone $2.5M/year estimate."
    }
  },
  C: {
    name: "Modernize",
    temporal: 5,
    spatial: 7,
    hydrological: 10,
    description: "Build future capability",
    color: "#1d5d85",
    costLabel: ["$5.9M/yr × 5 yr", "then $3.6M/yr"],
    investment: {
      lines: ["Estimated Investment:", "Years 1–5: $5.9M/year", "Year 6+: $3.6M/year"]
    }
  }
};

const metrics = [
  {
    key: "temporal",
    short: "T",
    label: "Temporal Flexibility",
    question: "When / at what time step can we account?",
    range: "lower temporal flexibility → weekly → monthly → quarterly → annual"
  },
  {
    key: "spatial",
    short: "S",
    label: "Spatial Flexibility",
    question: "Where can we account?",
    range: "local → service area → water district → basin → HUC8 → region → statewide"
  },
  {
    key: "hydrological",
    short: "H",
    label: "Hydrological Integration",
    question: "What can we account for?",
    range: "single component → land + surface water → full hydrologic cycle"
  }
];

const planeDefinitions = {
  xy: {
    label: "XY Plane",
    subtitle: "Spatial × Temporal",
    position: new THREE.Vector3(5, 5, 0),
    rotation: new THREE.Euler(0, 0, 0)
  },
  xz: {
    label: "XZ Plane",
    subtitle: "Spatial × Hydrological",
    position: new THREE.Vector3(5, 0, 5),
    rotation: new THREE.Euler(-Math.PI / 2, 0, 0)
  },
  yz: {
    label: "YZ Plane",
    subtitle: "Temporal × Hydrological",
    position: new THREE.Vector3(0, 5, 5),
    rotation: new THREE.Euler(0, Math.PI / 2, 0)
  }
};

const cameraViews = {
  reset: {
    label: "Reset View",
    position: new THREE.Vector3(16, 14, 18),
    target: SPACE_CENTER.clone()
  },
  top: {
    label: "Top",
    position: new THREE.Vector3(5, 5, 23),
    target: SPACE_CENTER.clone()
  },
  front: {
    label: "Front",
    position: new THREE.Vector3(5, 23, 5),
    target: SPACE_CENTER.clone()
  },
  side: {
    label: "Side",
    position: new THREE.Vector3(23, 5, 5),
    target: SPACE_CENTER.clone()
  }
};

const state = {
  selectedKey: "A",
  hoveredKey: null,
  visibleOptions: new Set(),
  activePlane: "xy",
  planesVisible: true,
  activeView: "reset",
  viewTransition: null,
  diagnostics: null
};

const refs = {
  container: document.getElementById("scene-container"),
  optionControls: document.getElementById("option-controls"),
  selectedName: document.getElementById("selected-name"),
  selectedDescription: document.getElementById("selected-description"),
  selectedValues: document.getElementById("selected-values"),
  selectedNote: document.getElementById("selected-note"),
  selectedInvestment: document.getElementById("selected-investment"),
  profileBars: document.getElementById("profile-bars"),
  planeStatus: document.getElementById("plane-status"),
  planeButtons: Array.from(document.querySelectorAll("[data-plane]")),
  planeToggleButtons: Array.from(document.querySelectorAll("[data-planes-toggle]")),
  viewButtons: Array.from(document.querySelectorAll("[data-view]"))
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f7fafc");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
refs.container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.minDistance = 8;
controls.maxDistance = 40;
controls.target.copy(cameraViews.reset.target);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactiveMeshes = [];
const optionMeshes = new Map();
const optionControls = new Map();
const planeGroups = new Map();
const guideLines = [];
const tempVector = new THREE.Vector3();

const sceneRoot = new THREE.Group();
scene.add(sceneRoot);

const resizeObserver = new ResizeObserver(() => {
  resizeRenderer();
});

const axisMaterial = new THREE.LineBasicMaterial({ color: "#6d879c", transparent: true, opacity: 0.95 });
const boundaryMaterial = new THREE.LineBasicMaterial({ color: "#c6d4df", transparent: true, opacity: 0.9 });
const guideMaterial = new THREE.LineDashedMaterial({
  color: "#2d6f9f",
  dashSize: 0.28,
  gapSize: 0.18,
  transparent: true,
  opacity: 0.75
});

function init() {
  try {
    state.diagnostics = {
      threeAvailable: typeof THREE !== "undefined",
      orbitControlsAvailable: typeof OrbitControls === "function"
    };

    applyCameraView("reset", false);
    buildScene();
    buildOptionControls();
    bindUi();
    selectOption(state.selectedKey);
    resizeRenderer();
    resizeObserver.observe(refs.container);
    animate();
  } catch (error) {
    displaySceneError(error);
    throw error;
  }
}

function buildScene() {
  scene.add(new THREE.AmbientLight("#ffffff", 1.25));

  const keyLight = new THREE.DirectionalLight("#ffffff", 0.9);
  keyLight.position.set(12, 18, 10);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight("#d9ebfb", 0.55);
  fillLight.position.set(-10, 8, 18);
  scene.add(fillLight);

  sceneRoot.add(createBoundaryBox());
  sceneRoot.add(createAxes());
  createReferencePlanes();
  createOptionMarkers();
  createSelectionGuides();
}

function createBoundaryBox() {
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(SPACE_MAX, SPACE_MAX, SPACE_MAX));
  const lines = new THREE.LineSegments(geometry, boundaryMaterial);
  lines.position.copy(SPACE_CENTER);
  return lines;
}

function createAxes() {
  const group = new THREE.Group();

  [
    {
      name: "Spatial Flexibility",
      color: "#547796",
      start: new THREE.Vector3(0, 0, 0),
      end: new THREE.Vector3(SPACE_MAX + 0.7, 0, 0),
      labelPosition: new THREE.Vector3(SPACE_MAX + 1.5, 0, 0),
      directionEnd: new THREE.Vector3(SPACE_MAX + 1.1, -0.7, 0),
      directionLabel: ""
    },
    {
      name: "Temporal Flexibility",
      color: "#4e7a9f",
      start: new THREE.Vector3(0, 0, 0),
      end: new THREE.Vector3(0, SPACE_MAX + 0.7, 0),
      labelPosition: new THREE.Vector3(0, SPACE_MAX + 1.6, 0),
      directionEnd: new THREE.Vector3(-1.25, SPACE_MAX + 1.1, 0),
      directionLabel: ""
    },
    {
      name: "Hydrological Integration",
      color: "#356b94",
      start: new THREE.Vector3(0, 0, 0),
      end: new THREE.Vector3(0, 0, SPACE_MAX + 0.7),
      labelPosition: new THREE.Vector3(0, 0, SPACE_MAX + 1.7),
      directionEnd: new THREE.Vector3(0.9, 0, SPACE_MAX + 1.1),
      directionLabel: ""
    }
  ].forEach((axis) => {
    const points = [axis.start, axis.end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, axisMaterial.clone());
    line.material.color = new THREE.Color(axis.color);
    group.add(line);

    const arrow = new THREE.ArrowHelper(
      axis.end.clone().sub(axis.start).normalize(),
      axis.end.clone().sub(axis.end.clone().sub(axis.start).normalize().multiplyScalar(0.001)),
      0.001,
      axis.color,
      0.35,
      0.18
    );
    group.add(arrow);

    group.add(createTextSprite(axis.name, {
      position: axis.labelPosition,
      background: "rgba(255,255,255,0.92)",
      border: "rgba(84,119,150,0.22)",
      color: "#12496f",
      scale: 2.55
    }));

    group.add(createTextSprite(axis.directionLabel, {
      position: axis.directionEnd,
      background: "rgba(255,255,255,0.86)",
      border: "rgba(113,142,165,0.18)",
      color: "#5c748a",
      scale: 1.45
    }));
  });

  [0, 5, 10].forEach((tick) => {
    group.add(createTickLabel(new THREE.Vector3(tick, -0.55, 0), String(tick)));
    group.add(createTickLabel(new THREE.Vector3(-0.65, tick, 0), String(tick)));
    group.add(createTickLabel(new THREE.Vector3(0.55, 0, tick), String(tick)));
  });

  return group;
}

function createTickLabel(position, text) {
  return createTextSprite(text, {
    position,
    background: "rgba(255,255,255,0.82)",
    border: "rgba(130,152,170,0.18)",
    color: "#70879c",
    scale: 0.78,
    paddingX: 14,
    paddingY: 10
  });
}

function createReferencePlanes() {
  Object.entries(planeDefinitions).forEach(([planeKey, definition]) => {
    const group = new THREE.Group();
    group.name = planeKey;
    group.position.copy(definition.position);
    group.rotation.copy(definition.rotation);

    const planeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SPACE_MAX, SPACE_MAX),
      new THREE.MeshBasicMaterial({
        color: "#8fb4cf",
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    group.add(planeMesh);

    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-5, -5, 0),
        new THREE.Vector3(5, -5, 0),
        new THREE.Vector3(5, 5, 0),
        new THREE.Vector3(-5, 5, 0)
      ]),
      new THREE.LineBasicMaterial({ color: "#7f9bb0", transparent: true, opacity: 0.45 })
    );
    group.add(border);

    group.add(createPlaneGrid());

    const label = createTextSprite([definition.label, definition.subtitle], {
      position: new THREE.Vector3(4.2, 4.3, 0.01),
      background: "rgba(255,255,255,0.9)",
      border: "rgba(108,139,164,0.18)",
      color: "#17324d",
      scale: 1.55,
      anchorY: 0.55
    });
    group.add(label);

    sceneRoot.add(group);
    planeGroups.set(planeKey, {
      group,
      mesh: planeMesh,
      border,
      label
    });
  });

  updatePlaneState();
}

function createPlaneGrid() {
  const positions = [];
  for (let step = 1; step < SPACE_MAX; step += 1) {
    const offset = step - 5;
    positions.push(-5, offset, 0, 5, offset, 0);
    positions.push(offset, -5, 0, offset, 5, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: "#b2c6d8", transparent: true, opacity: 0.42 })
  );
}

function createOptionMarkers() {
  const sphereGeometry = new THREE.SphereGeometry(0.28, 28, 28);
  const haloGeometry = new THREE.SphereGeometry(0.42, 28, 28);

  Object.entries(options).forEach(([key, option]) => {
    const color = new THREE.Color(option.color);
    const group = new THREE.Group();
    group.position.set(option.spatial, option.temporal, option.hydrological);
    group.userData.optionKey = key;

    const halo = new THREE.Mesh(
      haloGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );

    const sphere = new THREE.Mesh(
      sphereGeometry,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.06,
        emissive: new THREE.Color(color).multiplyScalar(0.18),
        emissiveIntensity: 0.08
      })
    );
    sphere.userData.optionKey = key;

    const codeLabel = createTextSprite(key, {
      position: new THREE.Vector3(0, 0.02, 0.33),
      background: "rgba(255,255,255,0.98)",
      border: "rgba(86,124,152,0.26)",
      color: "#17324d",
      scale: 0.8,
      anchorY: 0.5,
      depthTest: false
    });

    const nameLabel = createTextSprite(option.name, {
      position: new THREE.Vector3(0, 0.78, 0),
      background: "rgba(255,255,255,0.92)",
      border: "rgba(108,139,164,0.18)",
      color: "#12496f",
      scale: 1.12,
      anchorY: 0.5,
      depthTest: false
    });

    const costLabel = createTextSprite(option.costLabel, {
      position: new THREE.Vector3(0.95, -0.35, 0.1),
      background: "rgba(255,255,255,0.94)",
      border: "rgba(108,139,164,0.18)",
      color: "#35546d",
      scale: option.costLabel.length > 1 ? 0.74 : 0.68,
      anchorY: 0.5,
      depthTest: false
    });

    group.add(halo, sphere, codeLabel, nameLabel, costLabel);
    sceneRoot.add(group);

    interactiveMeshes.push(sphere);
    optionMeshes.set(key, {
      group,
      sphere,
      halo,
      codeLabel,
      nameLabel,
      costLabel
    });
  });
}

function createSelectionGuides() {
  for (let index = 0; index < 3; index += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3()
    ]);
    const line = new THREE.Line(geometry, guideMaterial.clone());
    line.computeLineDistances();
    sceneRoot.add(line);
    guideLines.push(line);
  }
}

function buildOptionControls() {
  Object.entries(options).forEach(([key, option]) => {
    const container = document.createElement("div");
    container.className = "option-button";
    container.dataset.option = key;

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "option-toggle";
    toggleButton.dataset.optionToggle = key;
    toggleButton.setAttribute("aria-label", `Show or hide ${option.name}`);
    toggleButton.setAttribute("aria-pressed", "false");
    toggleButton.innerHTML = '<span class="option-check" aria-hidden="true"></span>';

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "option-select";
    selectButton.dataset.optionSelect = key;
    selectButton.setAttribute("aria-pressed", "false");
    selectButton.innerHTML = `
      <span class="option-code">${key}</span>
      <span class="option-label">
        <strong>${option.name}</strong>
        <span>${option.description}</span>
      </span>
      <span class="option-meta">T ${option.temporal} · S ${option.spatial} · H ${getDisplayValue(key, "hydrological")}</span>
    `;

    toggleButton.addEventListener("click", () => toggleOptionVisibility(key));
    selectButton.addEventListener("click", () => selectOption(key, true));

    container.append(toggleButton, selectButton);
    refs.optionControls.appendChild(container);
    optionControls.set(key, {
      container,
      toggleButton,
      selectButton
    });
  });
}

function bindUi() {
  refs.viewButtons.forEach((button) => {
    button.addEventListener("click", () => applyCameraView(button.dataset.view));
  });

  refs.planeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.planesVisible = true;
      state.activePlane = button.dataset.plane;
      updatePlaneState();
    });
  });

  refs.planeToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.planesVisible = button.dataset.planesToggle === "show";
      updatePlaneState();
    });
  });

  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerleave", () => {
    state.hoveredKey = null;
    refs.container.style.cursor = "grab";
    updateOptionVisualState();
  });
  renderer.domElement.addEventListener("click", handleSceneClick);

  window.addEventListener("resize", resizeRenderer);
}

function displaySceneError(error) {
  refs.container.classList.add("is-error");
  refs.container.innerHTML = `
    <div class="scene-error">
      <strong>Unable to initialize the 3D scene.</strong><br>
      ${error?.message ?? String(error)}
    </div>
  `;
  refs.planeStatus.textContent = "Plane focus: unavailable — see scene error message";
}

function applyCameraView(viewKey, animateView = true) {
  const view = cameraViews[viewKey] ?? cameraViews.reset;
  state.activeView = viewKey;
  updateViewButtonState();

  if (!animateView) {
    camera.position.copy(view.position);
    controls.target.copy(view.target);
    controls.update();
    return;
  }

  state.viewTransition = {
    startedAt: performance.now(),
    duration: 520,
    fromPosition: camera.position.clone(),
    toPosition: view.position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: view.target.clone()
  };
}

function updateViewButtonState() {
  refs.viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.activeView);
  });
}

function updatePlaneState() {
  planeGroups.forEach((plane, planeKey) => {
    plane.group.visible = state.planesVisible;

    if (!state.planesVisible) {
      return;
    }

    const isAll = state.activePlane === "all";
    const isFocused = isAll || state.activePlane === planeKey;

    plane.mesh.material.opacity = isFocused ? (isAll ? 0.1 : 0.18) : 0.04;
    plane.border.material.opacity = isFocused ? 0.56 : 0.18;
    plane.label.material.opacity = isFocused ? 1 : 0.45;
  });

  refs.planeButtons.forEach((button) => {
    button.classList.toggle("is-active", state.activePlane === button.dataset.plane && state.planesVisible);
  });

  refs.planeToggleButtons.forEach((button) => {
    const shouldHighlight = (button.dataset.planesToggle === "show" && state.planesVisible) ||
      (button.dataset.planesToggle === "hide" && !state.planesVisible);
    button.classList.toggle("is-toggled", shouldHighlight);
  });

  if (!state.planesVisible) {
    refs.planeStatus.textContent = "Plane focus: hidden — data points remain in the full 3D scene";
    return;
  }

  if (state.activePlane === "all") {
    refs.planeStatus.textContent = "Plane focus: All planes — XY, XZ, and YZ shown together";
    return;
  }

  const plane = planeDefinitions[state.activePlane];
  refs.planeStatus.textContent = `Plane focus: ${plane.label} — ${plane.subtitle}`;
}

function handlePointerMove(event) {
  const hit = getIntersectedOption(event);
  state.hoveredKey = hit ? hit.userData.optionKey : null;
  refs.container.style.cursor = hit ? "pointer" : "grab";
  updateOptionVisualState();
}

function handleSceneClick(event) {
  const hit = getIntersectedOption(event);
  if (!hit) {
    return;
  }

  selectOption(hit.userData.optionKey, true);
}

function getIntersectedOption(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const visibleMeshes = interactiveMeshes.filter((mesh) => optionMeshes.get(mesh.userData.optionKey)?.group.visible);
  const hits = raycaster.intersectObjects(visibleMeshes, false);
  return hits[0]?.object ?? null;
}

function updateOptionVisualState() {
  optionMeshes.forEach((entry, key) => {
    const isVisible = state.visibleOptions.has(key);
    const isSelected = key === state.selectedKey;
    const isHovered = key === state.hoveredKey;
    const scale = isSelected ? 1.36 : isHovered ? 1.18 : 1;
    const haloOpacity = isSelected ? 0.28 : isHovered ? 0.16 : 0;
    const emissiveIntensity = isSelected ? 0.34 : isHovered ? 0.18 : 0.08;

    entry.group.visible = isVisible;
    entry.group.scale.setScalar(scale);
    entry.halo.material.opacity = haloOpacity;
    entry.sphere.material.emissiveIntensity = emissiveIntensity;
    entry.nameLabel.material.opacity = isSelected || isHovered ? 1 : 0.88;
    entry.codeLabel.material.opacity = isSelected ? 1 : 0.94;
    entry.costLabel.material.opacity = 0.96;
  });

  optionControls.forEach((control, key) => {
    const isVisible = state.visibleOptions.has(key);
    const isActive = key === state.selectedKey;
    control.container.classList.toggle("is-visible", isVisible);
    control.container.classList.toggle("is-active", isActive);
    control.toggleButton.classList.toggle("is-active", isVisible);
    control.toggleButton.setAttribute("aria-pressed", isVisible ? "true" : "false");
    control.selectButton.classList.toggle("is-active", isActive);
    control.selectButton.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function toggleOptionVisibility(optionKey) {
  if (state.visibleOptions.has(optionKey)) {
    state.visibleOptions.delete(optionKey);
  } else {
    state.visibleOptions.add(optionKey);
  }

  updateProjectionGuides();
  updateOptionVisualState();
}

function selectOption(optionKey, ensureVisible = false) {
  state.selectedKey = optionKey;
  if (ensureVisible) {
    state.visibleOptions.add(optionKey);
  }
  updateProjectionGuides();
  updateSelectedPanel();
  updateOptionVisualState();
}

function updateProjectionGuides() {
  const option = options[state.selectedKey];
  const point = new THREE.Vector3(option.spatial, option.temporal, option.hydrological);
  const showGuides = state.visibleOptions.has(state.selectedKey);

  const targets = [
    new THREE.Vector3(option.spatial, option.temporal, 0),
    new THREE.Vector3(option.spatial, 0, option.hydrological),
    new THREE.Vector3(0, option.temporal, option.hydrological)
  ];

  guideLines.forEach((line, index) => {
    const positions = line.geometry.attributes.position.array;
    positions[0] = point.x;
    positions[1] = point.y;
    positions[2] = point.z;
    positions[3] = targets[index].x;
    positions[4] = targets[index].y;
    positions[5] = targets[index].z;
    line.geometry.attributes.position.needsUpdate = true;
    line.computeLineDistances();
    line.visible = showGuides;
  });
}

function updateSelectedPanel() {
  const option = options[state.selectedKey];

  refs.selectedName.textContent = `${state.selectedKey} — ${option.name}`;
  refs.selectedDescription.textContent = option.description;

  refs.selectedValues.innerHTML = "";
  [
    ["Temporal Flexibility", `${option.temporal} / 10`],
    ["Spatial Flexibility", `${option.spatial} / 10`],
    ["Hydrological Integration", `${getDisplayValue(state.selectedKey, "hydrological")} / 10`],
    ["3D coordinates", `(${option.spatial}, ${option.temporal}, ${option.hydrological})`]
  ].forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    refs.selectedValues.append(dt, dd);
  });

  if (option.note) {
    refs.selectedNote.hidden = false;
    refs.selectedNote.textContent = option.note;
  } else {
    refs.selectedNote.hidden = true;
    refs.selectedNote.textContent = "";
  }

  if (refs.selectedInvestment) {
    refs.selectedInvestment.hidden = false;
    const investment = option.investment;
    refs.selectedInvestment.innerHTML = `
      <h4>Estimated Investment</h4>
      ${investment.lines.map((line, index) => index === 0
        ? `<p class="investment-line investment-lead">${line}</p>`
        : `<p class="investment-line">${line}</p>`).join("")}
      ${investment.supplemental ? `<p class="investment-note">${investment.supplemental}</p>` : ""}
    `;
  }

  refs.profileBars.replaceChildren();
  metrics.forEach((metric) => {
    const value = option[metric.key];
    const displayValue = getDisplayValue(state.selectedKey, metric.key);
    const card = document.createElement("article");
    card.className = "profile-bar";
    card.innerHTML = `
      <div class="profile-bar-header">
        <h4><span class="metric-code">${metric.short}</span> ${metric.label}</h4>
        <span class="metric-value">${displayValue} / 10</span>
      </div>
      <p class="metric-question">${metric.question}</p>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill" style="width: ${(value / SPACE_MAX) * 100}%"></div>
      </div>
      <div class="metric-ticks"><span>0</span><span>10</span></div>
      <p class="metric-range">${metric.range}</p>
    `;
    refs.profileBars.appendChild(card);
  });
}

function getDisplayValue(optionKey, metricKey) {
  const option = options[optionKey];
  if (metricKey === "hydrological" && option.hydrologicalDisplay) {
    return option.hydrologicalDisplay;
  }
  return option[metricKey];
}

function resizeRenderer() {
  const width = refs.container.clientWidth;
  const height = refs.container.clientHeight;

  if (!width || !height) {
    return;
  }

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateViewTransition() {
  if (!state.viewTransition) {
    return;
  }

  const elapsed = performance.now() - state.viewTransition.startedAt;
  const progress = Math.min(elapsed / state.viewTransition.duration, 1);
  const eased = 1 - Math.pow(1 - progress, 3);

  camera.position.lerpVectors(state.viewTransition.fromPosition, state.viewTransition.toPosition, eased);
  controls.target.lerpVectors(state.viewTransition.fromTarget, state.viewTransition.toTarget, eased);

  if (progress >= 1) {
    state.viewTransition = null;
  }
}

function animate() {
  requestAnimationFrame(animate);
  updateViewTransition();
  controls.update();
  renderer.render(scene, camera);
}

function createTextSprite(textOrLines, {
  position = new THREE.Vector3(),
  background = "rgba(255,255,255,0.88)",
  border = "rgba(108,139,164,0.15)",
  color = "#17324d",
  scale = 1,
  paddingX = 24,
  paddingY = 16,
  anchorY = 0.5,
  depthTest = false
} = {}) {
  const lines = Array.isArray(textOrLines) ? textOrLines : [textOrLines];
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = 34;
  const lineHeight = 44;

  context.font = `600 ${fontSize}px Segoe UI`;
  const widest = lines.reduce((max, line) => Math.max(max, context.measureText(line).width), 0);
  const width = Math.ceil(widest + paddingX * 2);
  const height = Math.ceil(lines.length * lineHeight + paddingY * 2);

  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);
  context.fillStyle = background;
  context.strokeStyle = border;
  context.lineWidth = 2;
  roundRect(context, 1, 1, width - 2, height - 2, 18);
  context.fill();
  context.stroke();

  context.font = `600 ${fontSize}px Segoe UI`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;

  lines.forEach((line, index) => {
    const y = paddingY + lineHeight / 2 + index * lineHeight;
    context.fillText(line, width / 2, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((width / 170) * scale, (height / 170) * scale, 1);
  sprite.position.copy(position);
  sprite.center.set(0.5, anchorY);
  return sprite;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

init();

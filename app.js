const particleCount = 9000; // Initial number of particles
const G = 10; // Gravitational constant (increased for stronger gravity)
const M_star = 8000; // Mass of the central protostar (increased for stronger gravity)
const dt = 0.1; // Time step (decreased for better accuracy)
const collisionDistance = 7.0; // Increased collision distance for merging

let activeParticleCount = particleCount; // Track the number of active particles

// Create the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Black background

// Create the camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 0, 800); // Set the camera back to see the entire cloud
camera.lookAt(0, 0, 0);

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create the 2D Renderer for the info panel
const cssRenderer = new THREE.CSS2DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.top = '0px';
cssRenderer.domElement.style.pointerEvents = 'none'; // Prevents interference with WebGL events
document.body.appendChild(cssRenderer.domElement);

// Create the particle material using a custom shader
const particleShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    color: { value: new THREE.Color(0xffffff) },
    pointTexture: { value: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png') }
  },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z); // Adjust point size
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D pointTexture;
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, 1.0);
      gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
      if (gl_FragColor.a < 0.1) discard; // Remove transparent edges
    }
  `,
  blending: THREE.AdditiveBlending,
  depthTest: false,
  transparent: true,
  vertexColors: true
});

// Create an HTML element to display particle counts
const infoDiv = document.createElement('div');
infoDiv.style.position = 'absolute';
infoDiv.style.top = '10px';
infoDiv.style.left = '10px';
infoDiv.style.color = 'white';
infoDiv.style.padding = '10px';
infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
infoDiv.style.borderRadius = '5px';
infoDiv.innerHTML = `
  <p>Total Particles: <span id="totalParticles">${activeParticleCount}</span></p>
`;
document.body.appendChild(infoDiv);

// Function to create uniformly distributed random points in a sphere
function getRandomPointInSphere(maxRadius) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u; // Angle in xy-plane
  const phi = Math.acos(2 * v - 1); // Angle from z-axis
  const r = Math.cbrt(Math.random()) * maxRadius; // Cube root for uniform volume distribution

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);

  return { x, y, z };
}

// Set initial positions and velocities for particles
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3); // To store particle velocities
const sizes = new Float32Array(particleCount); // To store particle sizes
const mergedCount = new Int32Array(particleCount); // To keep track of how many particles have merged

const maxRadius = 200; // Maximum radius for the particle cloud

// Simulate the collapse of 5% of particles to form the protostar
const protostarParticleCount = Math.floor(particleCount * 0.05);
const diskParticleCount = particleCount - protostarParticleCount;

for (let i = 0; i < particleCount; i++) {
  if (i < protostarParticleCount) {
    // Particles collapsing into the protostar at the origin
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    // No initial velocity
    velocities[i * 3] = 0;
    velocities[i * 3 + 1] = 0;
    velocities[i * 3 + 2] = 0;

    mergedCount[i] = 1; // These particles represent the protostar
    sizes[i] = 3.0; // Initial size
  } else {
    const { x, y, z } = getRandomPointInSphere(maxRadius);

    // Remaining particles form the accretion disk
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Calculate the distance from the origin (r) in the xy-plane
    const r = Math.sqrt(x * x + y * y); // Distance in the xy-plane

    // Avoid division by zero for particles near the origin
    if (r > 0) {
      // Calculate the velocity needed for a stable orbit (Keplerian motion)
      const velocity = Math.sqrt((G * M_star) / r); // Orbital speed based on distance from the center

      // Set the tangential velocity for orbit around the z-axis
      velocities[i * 3] = -y * velocity / r; // x-velocity
      velocities[i * 3 + 1] = x * velocity / r; // y-velocity

      // Introduce small random z-velocity for disk thickness
      velocities[i * 3 + 2] = (Math.random() - 0.5) * velocity * 0.0001; // Adjust the multiplier for thickness
    } else {
      // Particles at the center don't move
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    }

    mergedCount[i] = 1; // Each particle initially represents one unit mass
    sizes[i] = 0.5; // Initial size
  }
}

// Assign positions, velocities, and sizes to geometry
const particles = new THREE.BufferGeometry();
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particles.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
particles.setAttribute('color', new THREE.BufferAttribute(new Float32Array(particleCount * 3).fill(1.0), 3)); // White color

// Create Points object for the particle system
const particleSystem = new THREE.Points(particles, particleShaderMaterial);
scene.add(particleSystem);

// Create the protostar mesh at the origin
const protostarGeometry = new THREE.SphereGeometry(5, 32, 32);
const protostarMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow color
const protostar = new THREE.Mesh(protostarGeometry, protostarMaterial);
scene.add(protostar);

// Handle window resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.setSize(window.innerWidth, window.innerHeight); // Adjust 2D renderer size
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Function to apply gravity, check for collisions, and update positions
function applyGravityAndUpdatePositions() {
  const positions = particleSystem.geometry.attributes.position.array;
  const velocities = particleSystem.geometry.attributes.velocity.array;
  const sizes = particleSystem.geometry.attributes.size.array;

  // Create an array to track which particles are merged
  const merged = new Array(particleCount).fill(false);
  let currentParticleCount = 0; // Count of active particles

  for (let i = protostarParticleCount; i < particleCount; i++) {
    if (merged[i]) continue; // Skip merged particles

    const x1 = positions[i * 3];
    const y1 = positions[i * 3 + 1];
    const z1 = positions[i * 3 + 2];

    for (let j = i + 1; j < particleCount; j++) {
      if (merged[j]) continue; // Skip merged particles

      const x2 = positions[j * 3];
      const y2 = positions[j * 3 + 1];
      const z2 = positions[j * 3 + 2];

      // Check distance between particles
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dz = z2 - z1;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // If particles are close enough, merge them
      if (distance < collisionDistance) {
        // Merge particles: average positions and velocities
        positions[i * 3] = (x1 + x2) / 2;
        positions[i * 3 + 1] = (y1 + y2) / 2;
        positions[i * 3 + 2] = (z1 + z2) / 2;

        // Merge velocities
        velocities[i * 3] = (velocities[i * 3] + velocities[j * 3]) / 2;
        velocities[i * 3 + 1] = (velocities[i * 3 + 1] + velocities[j * 3 + 1]) / 2;
        velocities[i * 3 + 2] = (velocities[i * 3 + 2] + velocities[j * 3 + 2]) / 2;

        // Update merged count
        mergedCount[i] += mergedCount[j];

        // Mark particle j as merged and decrease active particle count
        merged[j] = true;
        activeParticleCount--;
      }
    }

    // Calculate gravity from central protostar
    const distanceToCenter = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
    if (distanceToCenter > 0) {
      const force = -(G * M_star) / (distanceToCenter * distanceToCenter);
      velocities[i * 3] += (x1 / distanceToCenter) * force * dt;
      velocities[i * 3 + 1] += (y1 / distanceToCenter) * force * dt;
      velocities[i * 3 + 2] += (z1 / distanceToCenter) * force * dt;
    }

    // Update positions based on velocities
    positions[i * 3] += velocities[i * 3] * dt;
    positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
    positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

    // Update sizes based on merged count
    sizes[i] = Math.min(5.0 * Math.log2(mergedCount[i] + 1), 2000); // Adjust size scaling

    currentParticleCount++; // Count active particles
  }

  // Hide merged particles from the simulation
  for (let i = 0; i < particleCount; i++) {
    if (merged[i]) {
      // Hide merged particle by moving it out of view
      positions[i * 3] = positions[i * 3 + 1] = positions[i * 3 + 2] = 10000; // Move it out of view
      sizes[i] = 0; // Set size to 0
    }
  }

  // Mark the geometry attributes as needing an update
  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.geometry.attributes.size.needsUpdate = true;

  // Update the 2D overlay with the current counts
  document.getElementById('totalParticles').innerText = currentParticleCount;

  // Update global active particle count
  activeParticleCount = currentParticleCount;
}

// Function to animate particles
function animateParticles() {
  applyGravityAndUpdatePositions();
}

// Function to render the scene
function animate() {
  requestAnimationFrame(animate);

  // Update particles
  animateParticles();

  // Update the camera controls for smooth interactions
  controls.update();

  // Render the 3D scene
  renderer.render(scene, camera);

  // Render the 2D info panel
  cssRenderer.render(scene, camera);
}

// Add OrbitControls to move the camera
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smoother movement
controls.dampingFactor = 0.05;
controls.minDistance = 100;
controls.maxDistance = 1600;

animate();

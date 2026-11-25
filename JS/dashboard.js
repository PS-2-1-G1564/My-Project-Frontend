
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// =====================================
// 1. CREATE THE 3D SCENE
// =====================================

const canvas = document.getElementById("crystal-canvas");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.position.z = 7;

// =====================================
// 2. CREATE THE RENDERER
// =====================================

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// =====================================
// 3. CREATE CRYSTAL STRUCTURE
// =====================================

const crystalGroup = new THREE.Group();

const nodes = [];
const positions = [];

const spacing = 1.25;
const size = 3;

// Create crystal lattice nodes

for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {

            const position = new THREE.Vector3(
                (x - 1) * spacing,
                (y - 1) * spacing,
                (z - 1) * spacing
            );

            positions.push(position);

            const geometry = new THREE.SphereGeometry(
                0.09,
                20,
                20
            );

            


const material = new THREE.MeshStandardMaterial({
    color: 0x27c8ff,
    emissive: 0x008cff,
    emissiveIntensity: 1.2,
    metalness: 0.65,
    roughness: 0.15
});


            const sphere = new THREE.Mesh(
                geometry,
                material
            );

            sphere.position.copy(position);

            crystalGroup.add(sphere);

// Create a soft glowing halo around each crystal node

const glowCanvas = document.createElement("canvas");
glowCanvas.width = 128;
glowCanvas.height = 128;

const context = glowCanvas.getContext("2d");

const gradient = context.createRadialGradient(
    64, 64, 2,
    64, 64, 64
);

gradient.addColorStop(0, "rgba(0, 210, 255, 0.8)");
gradient.addColorStop(0.25, "rgba(0, 150, 255, 0.35)");
gradient.addColorStop(1, "rgba(0, 100, 255, 0)");

context.fillStyle = gradient;
context.fillRect(0, 0, 128, 128);

const glowTexture = new THREE.CanvasTexture(glowCanvas);

const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const glow = new THREE.Sprite(glowMaterial);
glow.scale.set(0.65, 0.65, 0.65);
glow.position.copy(position);

crystalGroup.add(glow);


            nodes.push(sphere);
        }
    }
}

// =====================================
// 4. CONNECT CRYSTAL NODES
// =====================================

const connections = [];

positions.forEach((position, index) => {

    positions.forEach((otherPosition, otherIndex) => {

        if (otherIndex <= index) return;

        const distance = position.distanceTo(otherPosition);

        if (Math.abs(distance - spacing) < 0.01) {

            const points = [
                position,
                otherPosition
            ];

            const geometry = new THREE.BufferGeometry()
                .setFromPoints(points);

            
const material = new THREE.LineBasicMaterial({
    color: 0x00d9ff,
    transparent: true,
    opacity: 0.85
});




            const line = new THREE.Line(
                geometry,
                material
            );

            crystalGroup.add(line);
            connections.push(line);
        }
    });
});

scene.add(crystalGroup);

//Make the cryatal structure larger
crystalGroup.scale.set(1.6,1.6,1.6);
//position it slightly towards the right 
crystalGroup.position.set(3.2,0,0);

// =====================================
// 5. ADD LIGHTING
// =====================================

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    1.8
);

scene.add(ambientLight);

const blueLight = new THREE.PointLight(
    0x42bfff,
    25
);

blueLight.position.set(4, 4, 5);
scene.add(blueLight);

// =====================================
// 6. CREATE BACKGROUND PARTICLES
// =====================================

const particleCount = 180;
const particlePositions = new Float32Array(
    particleCount * 3
);

for (let i = 0; i < particleCount; i++) {

    particlePositions[i * 3] = (Math.random() - 0.5) * 18;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
}

const particleGeometry = new THREE.BufferGeometry();

particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(particlePositions, 3)
);




const particleMaterial = new THREE.PointsMaterial({
    color: 0x00cfff,
    size: 0.055,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
});


const particles = new THREE.Points(
    particleGeometry,
    particleMaterial
);

scene.add(particles);

// =====================================
// 7. ANIMATE THE 3D SCENE
// =====================================

function animate() {

    requestAnimationFrame(animate);

    // Slow crystal rotation
    crystalGroup.rotation.y += 0.0025;
    crystalGroup.rotation.x += 0.0008;

    // Very subtle particle movement
    particles.rotation.y += 0.0004;
    particles.rotation.x += 0.0001;
    

    renderer.render(scene, camera);
}

animate();

// =====================================
// 8. RESPONSIVE SCREEN
// =====================================

window.addEventListener("resize", () => {

    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );
});





import * as THREE from 'three';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

// --- Configuration ---
const PARTICLE_COUNT = 15000;
const PARTICLE_SIZE = 0.15;
const INTERACTION_RADIUS = 3;

// --- State ---
let currentShapeIndex = 0;
let isPinching = false;
let pinchCooldown = false;
let handCenter = new THREE.Vector3(0, 0, 0);
let handOpenness = 1.0; 
let time = 0;
const shapes = ['Sphere', 'Heart', 'Saturn', 'Torus', 'Galaxy'];

// --- Three.js Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.03);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 15;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- Particle System ---
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const targetPositions = new Float32Array(PARTICLE_COUNT * 3);

const color1 = new THREE.Color(0x00ffff);
const color2 = new THREE.Color(0xff00ff);
const colorFist = new THREE.Color(0xff2200);

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 50;
    positions[i3+1] = (Math.random() - 0.5) * 50;
    positions[i3+2] = (Math.random() - 0.5) * 50;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// --- Shape Math ---
function getShapePosition(type, i, total) {
    const p = new THREE.Vector3();
    const n = i / total; 
    const theta = n * Math.PI * 2 * 50; 
    const phi = Math.acos(2 * Math.random() - 1);

    switch(type) {
        case 'Sphere':
            const r = 6;
            p.x = r * Math.sin(phi) * Math.cos(theta);
            p.y = r * Math.sin(phi) * Math.sin(theta);
            p.z = r * Math.cos(phi);
            break;
        case 'Heart':
            const t = n * Math.PI * 2 * 4;
            p.x = 16 * Math.pow(Math.sin(t), 3);
            p.y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            p.z = (Math.random() - 0.5) * 4;
            p.multiplyScalar(0.35).applyAxisAngle(new THREE.Vector3(1,0,0), Math.PI);
            break;
        case 'Saturn':
            if (Math.random() > 0.3) {
                const rS = 4;
                p.x = rS * Math.sin(phi) * Math.cos(theta);
                p.y = rS * Math.sin(phi) * Math.sin(theta);
                p.z = rS * Math.cos(phi);
            } else {
                const rRing = 5 + Math.random() * 4;
                const angle = Math.random() * Math.PI * 2;
                p.x = rRing * Math.cos(angle);
                p.z = rRing * Math.sin(angle);
                p.y = (Math.random() - 0.5) * 0.2;
                p.applyAxisAngle(new THREE.Vector3(1,0,0), 0.5);
            }
            break;
        case 'Torus':
            const R = 6, tube = 2;
            const u = Math.random() * Math.PI * 2, v = Math.random() * Math.PI * 2;
            p.x = (R + tube * Math.cos(v)) * Math.cos(u);
            p.y = (R + tube * Math.cos(v)) * Math.sin(u);
            p.z = tube * Math.sin(v);
            break;
        case 'Galaxy':
            const arms = 5, radius = Math.pow(Math.random(), 2) * 10;
            const armAngle = (i % arms) * ((Math.PI * 2) / arms);
            const spin = i * 0.1;
            p.x = radius * Math.cos(spin + armAngle);
            p.y = (Math.random() - 0.5) * (10 - radius) * 0.2;
            p.z = radius * Math.sin(spin + armAngle);
            break;
    }
    return p;
}

function setShape(shapeType) {
    document.getElementById('shape-name').innerText = shapeType;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const vec = getShapePosition(shapeType, i, PARTICLE_COUNT);
        targetPositions[i*3] = vec.x;
        targetPositions[i*3+1] = vec.y;
        targetPositions[i*3+2] = vec.z;
    }
}

setShape(shapes[0]);

// --- MediaPipe Logic ---
const videoElement = document.getElementById('video-feed');
const statusText = document.getElementById('status-text');

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        statusText.innerText = "Hand Detected";
        statusText.style.color = "#00ff88";
        const landmarks = results.multiHandLandmarks[0];

        const x = (landmarks[9].x - 0.5) * -20;
        const y = -(landmarks[9].y - 0.5) * 15;
        handCenter.lerp(new THREE.Vector3(x, y, 0), 0.1);

        const dOpen = Math.hypot(landmarks[0].x - landmarks[12].x, landmarks[0].y - landmarks[12].y);
        handOpenness = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(dOpen, 0.2, 0.5, 0, 1), 0, 1);

        const dPinch = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
        if (dPinch < 0.05 && !pinchCooldown) {
            currentShapeIndex = (currentShapeIndex + 1) % shapes.length;
            setShape(shapes[currentShapeIndex]);
            pinchCooldown = true;
            setTimeout(() => { pinchCooldown = false; }, 1000);
        }
    } else {
        statusText.innerText = "Looking for hand...";
        statusText.style.color = "#ffaa00";
        handOpenness = THREE.MathUtils.lerp(handOpenness, 1.0, 0.05);
    }
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
hands.onResults(onResults);

const cameraFeed = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});
cameraFeed.start();

// --- Animation Loop ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    time += clock.getDelta();

    const pArr = geometry.attributes.position.array;
    const cArr = geometry.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // Morph
        pArr[i3] += (targetPositions[i3] - pArr[i3]) * 0.05;
        pArr[i3+1] += (targetPositions[i3+1] - pArr[i3+1]) * 0.05;
        pArr[i3+2] += (targetPositions[i3+2] - pArr[i3+2]) * 0.05;

        // Interaction
        const dx = pArr[i3] - handCenter.x, dy = pArr[i3+1] - handCenter.y, dz = pArr[i3+2] - handCenter.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (dist < INTERACTION_RADIUS * 3) {
            if (handOpenness < 0.3) { // Fist
                pArr[i3] -= dx * 0.1; pArr[i3+1] -= dy * 0.1; pArr[i3+2] -= dz * 0.1;
            } else { // Open
                const force = (INTERACTION_RADIUS - dist) / INTERACTION_RADIUS;
                if (force > 0) { pArr[i3] += dx * force * 0.05; pArr[i3+1] += dy * force * 0.05; }
            }
        }

        // Color
        const grad = i / PARTICLE_COUNT;
        const r = color1.r + (color2.r - color1.r) * grad;
        const g = color1.g + (color2.g - color1.g) * grad;
        const b = color1.b + (color2.b - color1.b) * grad;

        cArr[i3] = THREE.MathUtils.lerp(colorFist.r, r, handOpenness);
        cArr[i3+1] = THREE.MathUtils.lerp(colorFist.g, g, handOpenness);
        cArr[i3+2] = THREE.MathUtils.lerp(colorFist.b, b, handOpenness);
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    particles.rotation.y += 0.002;
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
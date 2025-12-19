import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

const App = () => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const statusRef = useRef(null);
  const shapeNameRef = useRef(null);

  useEffect(() => {
    // --- Configuration ---
    const PARTICLE_COUNT = 15000;
    const shapes = ['Sphere', 'Heart', 'Saturn', 'Torus', 'Galaxy'];
    let currentShapeIndex = 0;
    let handOpenness = 1.0;
    let handCenter = new THREE.Vector3(0, 0, 0);
    let pinchCooldown = false;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    // --- Particles ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const targetPositions = new Float32Array(PARTICLE_COUNT * 3);

    const color1 = new THREE.Color(0x00ffff);
    const color2 = new THREE.Color(0xff00ff);
    const colorFist = new THREE.Color(0xff2200);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particles = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 0.12, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false
    }));
    scene.add(particles);

    // --- Shape Logic ---
    const setShape = (type) => {
      shapeNameRef.current.innerText = type;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const n = i / PARTICLE_COUNT;
        const theta = n * Math.PI * 2 * 50;
        const phi = Math.acos(2 * Math.random() - 1);
        let x, y, z;

        if (type === 'Sphere') {
          x = 6 * Math.sin(phi) * Math.cos(theta);
          y = 6 * Math.sin(phi) * Math.sin(theta);
          z = 6 * Math.cos(phi);
        } else if (type === 'Torus') {
          const R = 6, tube = 2;
          const u = Math.random() * Math.PI * 2, v = Math.random() * Math.PI * 2;
          x = (R + tube * Math.cos(v)) * Math.cos(u);
          y = (R + tube * Math.cos(v)) * Math.sin(u);
          z = tube * Math.sin(v);
        } else {
          // Default Galaxy Fallback
          const radius = Math.pow(Math.random(), 2) * 10;
          x = radius * Math.cos(i * 0.1);
          y = (Math.random() - 0.5) * 2;
          z = radius * Math.sin(i * 0.1);
        }
        targetPositions[i * 3] = x;
        targetPositions[i * 3 + 1] = y;
        targetPositions[i * 3 + 2] = z;
      }
    };
    setShape(shapes[0]);

    // --- MediaPipe ---
    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    
    hands.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        statusRef.current.innerText = "Hand Detected";
        const lm = results.multiHandLandmarks[0];
        handCenter.lerp(new THREE.Vector3((lm[9].x - 0.5) * -20, -(lm[9].y - 0.5) * 15, 0), 0.1);
        
        const dOpen = Math.hypot(lm[0].x - lm[12].x, lm[0].y - lm[12].y);
        handOpenness = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(dOpen, 0.2, 0.5, 0, 1), 0, 1);

        const dPinch = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        if (dPinch < 0.05 && !pinchCooldown) {
          currentShapeIndex = (currentShapeIndex + 1) % shapes.length;
          setShape(shapes[currentShapeIndex]);
          pinchCooldown = true;
          setTimeout(() => pinchCooldown = false, 1000);
        }
      } else {
        statusRef.current.innerText = "Looking for hand...";
        handOpenness = 1.0;
      }
    });

    const cam = new Camera(videoRef.current, {
      onFrame: async () => { await hands.send({image: videoRef.current}); },
      width: 640, height: 480
    });
    cam.start();

    // --- Animation ---
    const animate = () => {
      const pArr = geometry.attributes.position.array;
      const cArr = geometry.attributes.color.array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        pArr[i3] += (targetPositions[i3] - pArr[i3]) * 0.05;
        pArr[i3+1] += (targetPositions[i3+1] - pArr[i3+1]) * 0.05;
        pArr[i3+2] += (targetPositions[i3+2] - pArr[i3+2]) * 0.05;

        // Color Lerp
        const r = THREE.MathUtils.lerp(colorFist.r, color1.r, handOpenness);
        cArr[i3] = r; cArr[i3+1] = color1.g; cArr[i3+2] = color1.b;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      particles.rotation.y += 0.002;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => renderer.dispose();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', zIndex: 10, fontFamily: 'sans-serif' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>PARTICLE MORPHER</h1>
        <div ref={statusRef} style={{ color: '#00ff88' }}>Initializing...</div>
        <p>Shape: <span ref={shapeNameRef}>Sphere</span></p>
      </div>
      <video ref={videoRef} style={{ position: 'absolute', bottom: 20, left: 20, width: 200, borderRadius: 10, transform: 'scaleX(-1)', border: '2px solid #444' }} />
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default App;
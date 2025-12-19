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
    const PARTICLE_COUNT = 15000;
    const shapes = ['Sphere', 'Heart', 'Saturn', 'Torus', 'Galaxy'];
    let currentShapeIndex = 0;
    let handOpenness = 1.0;
    let handCenter = new THREE.Vector3(0, 0, 0);
    let pinchCooldown = false;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const targetPositions = new Float32Array(PARTICLE_COUNT * 3);

    const color1 = new THREE.Color(0x00ffff); // Cyan
    const color2 = new THREE.Color(0xff00ff); // Magenta
    const colorFist = new THREE.Color(0xff2200); // Red

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

    // --- Fixed Shape Math ---
    const setShape = (type) => {
      shapeNameRef.current.innerText = type;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const n = i / PARTICLE_COUNT;
        let x, y, z;

        if (type === 'Sphere') {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          x = 6 * Math.sin(phi) * Math.cos(theta);
          y = 6 * Math.sin(phi) * Math.sin(theta);
          z = 6 * Math.cos(phi);
        } 
        else if (type === 'Heart') {
          const t = Math.random() * Math.PI * 2;
          x = 16 * Math.pow(Math.sin(t), 3);
          y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
          z = (Math.random() - 0.5) * 5;
          x *= 0.45; y *= 0.45; // Scaling
        } 
        else if (type === 'Saturn') {
          if (i % 3 === 0) { // Ring
            const r = 7 + Math.random() * 3;
            const a = Math.random() * Math.PI * 2;
            x = r * Math.cos(a);
            y = (Math.random() - 0.5) * 0.5;
            z = r * Math.sin(a);
            const tilt = 0.5;
            const tz = z;
            z = tz * Math.cos(tilt) - y * Math.sin(tilt);
            y = tz * Math.sin(tilt) + y * Math.cos(tilt);
          } else { // Planet
            const r = 4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta);
            z = r * Math.cos(phi);
          }
        } 
        else if (type === 'Torus') {
          const R = 6, tube = 2;
          const u = Math.random() * Math.PI * 2;
          const v = Math.random() * Math.PI * 2;
          x = (R + tube * Math.cos(v)) * Math.cos(u);
          y = (R + tube * Math.cos(v)) * Math.sin(u);
          z = tube * Math.sin(v);
        } 
        else if (type === 'Galaxy') {
          const angle = n * Math.PI * 10;
          const radius = n * 10;
          x = Math.cos(angle) * radius + (Math.random() - 0.5);
          y = (Math.random() - 0.5) * 2;
          z = Math.sin(angle) * radius + (Math.random() - 0.5);
        }

        targetPositions[i3] = x;
        targetPositions[i3 + 1] = y;
        targetPositions[i3 + 2] = z;
      }
    };
    setShape(shapes[0]);

    // --- MediaPipe Interaction ---
    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    
    hands.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        statusRef.current.innerText = "Hand Detected";
        const lm = results.multiHandLandmarks[0];
        // Note: 9 is Middle Finger MCP (center of palm)
        handCenter.lerp(new THREE.Vector3((lm[9].x - 0.5) * -25, -(lm[9].y - 0.5) * 18, 0), 0.2);
        
        const dOpen = Math.hypot(lm[0].x - lm[12].x, lm[0].y - lm[12].y);
        handOpenness = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(dOpen, 0.2, 0.45, 0, 1), 0, 1);

        const dPinch = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        if (dPinch < 0.04 && !pinchCooldown) {
          currentShapeIndex = (currentShapeIndex + 1) % shapes.length;
          setShape(shapes[currentShapeIndex]);
          pinchCooldown = true;
          setTimeout(() => pinchCooldown = false, 1000);
        }
      } else {
        statusRef.current.innerText = "Looking for hand...";
        handOpenness = 1.0;
        handCenter.lerp(new THREE.Vector3(0,0,0), 0.05);
      }
    });

    const cam = new Camera(videoRef.current, {
      onFrame: async () => { await hands.send({image: videoRef.current}); },
      width: 640, height: 480
    });
    cam.start();

    // --- Animation Loop with Black Hole Logic ---
    const animate = () => {
      const pArr = geometry.attributes.position.array;
      const cArr = geometry.attributes.color.array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // 1. Move to Shape Target
        pArr[i3] += (targetPositions[i3] - pArr[i3]) * 0.05;
        pArr[i3+1] += (targetPositions[i3+1] - pArr[i3+1]) * 0.05;
        pArr[i3+2] += (targetPositions[i3+2] - pArr[i3+2]) * 0.05;

        // 2. Black Hole Logic (Attraction when fist is closed)
        if (handOpenness < 0.3) {
          const dx = pArr[i3] - handCenter.x;
          const dy = pArr[i3+1] - handCenter.y;
          const dz = pArr[i3+2] - handCenter.z;
          
          // Pull particles toward hand center
          pArr[i3] -= dx * 0.15;
          pArr[i3+1] -= dy * 0.15;
          pArr[i3+2] -= dz * 0.15;
        }

        // 3. Dynamic Colors
        const grad = i / PARTICLE_COUNT;
        const baseR = THREE.MathUtils.lerp(color1.r, color2.r, grad);
        const baseG = THREE.MathUtils.lerp(color1.g, color2.g, grad);
        const baseB = THREE.MathUtils.lerp(color1.b, color2.b, grad);

        cArr[i3] = THREE.MathUtils.lerp(colorFist.r, baseR, handOpenness);
        cArr[i3+1] = THREE.MathUtils.lerp(colorFist.g, baseG, handOpenness);
        cArr[i3+2] = THREE.MathUtils.lerp(colorFist.b, baseB, handOpenness);
      }
      
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      particles.rotation.y += 0.003;
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      renderer.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 30, left: 30, color: 'white', zIndex: 10, fontFamily: 'monospace' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '3px' }}>NEURAL MORPHER</h1>
        <div ref={statusRef} style={{ color: '#00ff88', marginTop: '5px' }}>Initializing...</div>
        <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '5px' }}>
          <div>PINCH: Next Shape</div>
          <div>FIST: Black Hole</div>
          <p style={{ margin: '10px 0 0 0' }}>Active: <span ref={shapeNameRef} style={{ color: '#ffeb3b' }}>Sphere</span></p>
        </div>
      </div>
      <video ref={videoRef} style={{ position: 'absolute', bottom: 20, left: 20, width: 180, borderRadius: '12px', transform: 'scaleX(-1)', border: '2px solid rgba(255,255,255,0.2)' }} />
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default App;
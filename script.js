/* ================================================================
   VITAVERSE — Scroll-Driven 3D Watch Engine
   Three.js + GSAP ScrollTrigger + Lenis + SplitType
   ================================================================ */
(function () {
  'use strict';

  /* ================================================================
     GLOBALS
  ================================================================ */
  var lenis, camera, renderer, scene, watchGroup, particleSys, ringGroup;
  var clock = new THREE.Clock();
  var mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  var scrollProgress = 0;
  var currentScene = 'hero';
  var targetPos = { x: 0, y: 0, z: 0 };
  var targetRot = { x: 0, y: 0, z: 0 };
  var targetCam = { z: 5 };

  /* Scene state definitions — position/rotation/camera per section */
  var sceneStates = {
    hero:        { pos:[0,0,0],      rot:[0,0,0],       cam:5,    tilt:.06, speed:.4,  particleColor:0xd4af37, glowIntensity:1   },
    problem1:    { pos:[-1.2,0,0],   rot:[.2,.4,0],     cam:5.2,  tilt:.04, speed:.2,  particleColor:0xb03030, glowIntensity:.3  },
    problem2:    { pos:[-1.4,-.2,0], rot:[.25,.5,.05],  cam:5.4,  tilt:.04, speed:.2,  particleColor:0xb03030, glowIntensity:.4  },
    problem3:    { pos:[-1.6,.2,0],  rot:[.1,.3,-.05],  cam:5.6,  tilt:.04, speed:.2,  particleColor:0x802020, glowIntensity:.5  },
    reveal1:     { pos:[0,0,0],      rot:[0,Math.PI,0], cam:3.5,  tilt:.05, speed:.3,  particleColor:0xd4af37, glowIntensity:1.5 },
    reveal2:     { pos:[1.5,0,0],    rot:[0,Math.PI*1.2,0],cam:4.5,tilt:.05,speed:.3, particleColor:0xd4af37, glowIntensity:1.2 },
    intel1:      { pos:[1.2,0,0],    rot:[Math.PI/2,0,0], cam:4.2, tilt:.07, speed:.6,  particleColor:0xd4af37, glowIntensity:1.2 },
    intel2:      { pos:[1.4,-.1,0],  rot:[Math.PI/2,0,.2],cam:4.4, tilt:.07, speed:.6,  particleColor:0xd4af37, glowIntensity:1.0 },
    performance: { pos:[0,0,0],      rot:[.1,Math.PI/2,.05],cam:3.0,tilt:.05,speed:.5,  particleColor:0xd4af37, glowIntensity:.8  },
    design1:     { pos:[1.5,-.3,0],  rot:[-.1,-.5,.05], cam:4.5,  tilt:.04, speed:.35, particleColor:0xd4af37, glowIntensity:.9  },
    design2:     { pos:[1.2,0,0],    rot:[-.2,-.8,.1],  cam:4.0,  tilt:.04, speed:.35, particleColor:0xd4af37, glowIntensity:1.0 },
    ecosystem:   { pos:[-1.8,0,0],   rot:[.05,.4,0],    cam:5,    tilt:.04, speed:.3,  particleColor:0xd4af37, glowIntensity:.6  },
    privacy:     { pos:[0,0,0],      rot:[0,0,0],       cam:5.5,  tilt:.03, speed:.15, particleColor:0x40a070, glowIntensity:.7  },
    cta:         { pos:[0,0,0],      rot:[0,Math.PI*2,0],cam:4.2, tilt:.06, speed:.4,  particleColor:0xd4af37, glowIntensity:2   },
  };

  /* ================================================================
     1. PRELOADER
  ================================================================ */
  function runPreloader(cb) {
    var tl = gsap.timeline({ onComplete: cb });
    tl.to('.pl-bar', { scaleX: 1, duration: 2, ease: 'power4.inOut' })
      .to('.pl-inner', { opacity: 0, duration: .5, ease: 'power2.in' }, '+=.2')
      .to('#preloader', { yPercent: -100, duration: 1.2, ease: 'power4.inOut' })
      .set('#preloader', { display: 'none' });
  }

  /* ================================================================
     2. LENIS SMOOTH SCROLL
  ================================================================ */
  function initLenis() {
    lenis = new Lenis({ lerp: 0.05, smoothWheel: true, wheelMultiplier: 0.6 });
    lenis.on('scroll', function(e) {
      scrollProgress = e.progress;
      ScrollTrigger.update();
    });
    gsap.ticker.add(function(t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ================================================================
     3. CUSTOM CURSOR
  ================================================================ */
  function initCursor() {
    var cur = document.getElementById('cursor');
    var fol = document.getElementById('cursorFollower');
    if (!cur || matchMedia('(hover:none)').matches) return;

    var cx = 0, cy = 0, fx = 0, fy = 0;
    document.addEventListener('mousemove', function(e) {
      cx = e.clientX; cy = e.clientY;
      mouse.targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;

      gsap.set(cur, { x: cx, y: cy, xPercent:-50, yPercent:-50 });

      // Mouse glow
      var mg = document.getElementById('mouseGlow');
      if (mg) gsap.set(mg, { x: cx, y: cy, xPercent:-50, yPercent:-50 });
    });

    // Follower lerp
    gsap.ticker.add(function() {
      fx += (cx - fx) * 0.12;
      fy += (cy - fy) * 0.12;
      gsap.set(fol, { x: fx, y: fy, xPercent:-50, yPercent:-50 });
    });

    // Hover state
    document.querySelectorAll('a, button, .pillar-card, .ai-card, .band-card').forEach(function(el) {
      el.addEventListener('mouseenter', function() { document.body.classList.add('cursor--hover'); });
      el.addEventListener('mouseleave', function() { document.body.classList.remove('cursor--hover'); });
    });
  }

  /* ================================================================
     4. THREE.JS — 3D WATCH SCENE (persistent full-screen canvas)
  ================================================================ */
  function initThreeJS() {
    var canvas = document.getElementById('watch-canvas');
    var W = window.innerWidth, H = window.innerHeight;

    /* Renderer */
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* Scene */
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.08);

    /* Camera */
    camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0, 5);

    /* Lights */
    var ambient = new THREE.AmbientLight(0xd4af37, 0.08);
    scene.add(ambient);

    var keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(3, 5, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    var goldLight = new THREE.PointLight(0xd4af37, 1.5, 12);
    goldLight.position.set(0, 0, 3);
    scene.add(goldLight);

    var rimLight = new THREE.PointLight(0xd4af37, 0.8, 10);
    rimLight.position.set(-3, -2, 2);
    scene.add(rimLight);

    /* Build WHOOP-style watch group */
    buildWatch();

    /* Ambient particles */
    buildParticles();

    /* Orbit rings */
    buildRings();

    /* Start render loop */
    renderLoop();

    /* Handle resize */
    window.addEventListener('resize', function() {
      W = window.innerWidth; H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });
  }

  /* ================================================================
     BUILD WATCH — WHOOP-style luxury wearable geometry
  ================================================================ */
  function buildWatch() {
    watchGroup = new THREE.Group();

    /* --- Main body (rounded rectangular tracker) --- */
    var bodyGeo = new THREE.BoxGeometry(0.88, 1.15, 0.22, 4, 4, 4);
    // Chamfer effect via vertex displacement
    var pos = bodyGeo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var r = 0.07;
      // Round corners
      x = Math.sign(x) * Math.min(Math.abs(x), 0.44 - r) + Math.sign(x) * r;
      y = Math.sign(y) * Math.min(Math.abs(y), 0.575 - r) + Math.sign(y) * r;
      pos.setXYZ(i, x, y, z);
    }
    bodyGeo.computeVertexNormals();

    var bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.25,
      metalness: 0.85,
      envMapIntensity: 1.2,
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    watchGroup.add(body);

    /* --- Gold edge frame --- */
    var frameGeo = new THREE.BoxGeometry(0.96, 1.22, 0.14);
    var frameMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.08,
      metalness: 1.0,
      envMapIntensity: 2.5,
    });
    var frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.01;
    watchGroup.add(frame);

    /* --- Face screen --- */
    var faceGeo = new THREE.PlaneGeometry(0.74, 0.95);
    var faceMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      roughness: 0.04,
      metalness: 0.5,
      emissive: 0xd4af37,
      emissiveIntensity: 0.12,
    });
    var face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = 0.11;
    watchGroup.add(face);

    /* --- Gold sensor dots (bottom) --- */
    [-0.12, 0, 0.12].forEach(function(dx) {
      var dotGeo = new THREE.CircleGeometry(0.025, 16);
      var dotMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.1, metalness: 1 });
      var dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(dx, -0.48, 0.1);
      watchGroup.add(dot);
    });

    /* --- Top band --- */
    var bandMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.45,
      metalness: 0.25,
    });
    var bandTopGeo = new THREE.BoxGeometry(0.72, 1.55, 0.18);
    var bandTop = new THREE.Mesh(bandTopGeo, bandMat);
    bandTop.position.set(0, 1.38, -0.02);
    watchGroup.add(bandTop);

    /* --- Bottom band --- */
    var bandBot = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 1.35, 0.18),
      bandMat.clone()
    );
    bandBot.position.set(0, -1.3, -0.02);
    watchGroup.add(bandBot);

    /* --- Band texture lines (grooved silicone feel) --- */
    var grooveMat = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 });
    [-0.55, -0.35, -0.15, 0.05, 0.25, 0.45].forEach(function(yOff) {
      var pts = [new THREE.Vector3(-0.32, yOff + 1.38, 0.08), new THREE.Vector3(0.32, yOff + 1.38, 0.08)];
      var geoG = new THREE.BufferGeometry().setFromPoints(pts);
      watchGroup.add(new THREE.Line(geoG, grooveMat));
    });
    [-0.45, -0.25, -0.05, 0.15, 0.35].forEach(function(yOff) {
      var pts = [new THREE.Vector3(-0.32, yOff - 1.3, 0.08), new THREE.Vector3(0.32, yOff - 1.3, 0.08)];
      var geoG = new THREE.BufferGeometry().setFromPoints(pts);
      watchGroup.add(new THREE.Line(geoG, grooveMat));
    });

    /* --- Gold clasp ring (bottom) --- */
    var claspGeo = new THREE.TorusGeometry(0.12, 0.018, 8, 24);
    var claspMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.05, metalness: 1 });
    var clasp = new THREE.Mesh(claspGeo, claspMat);
    clasp.position.set(0, -1.9, 0);
    clasp.rotation.x = Math.PI / 2;
    watchGroup.add(clasp);

    /* --- UI elements on face (minimal lines) --- */
    var lineMat = new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.5 });

    // Heart rate line
    var hrPoints = [];
    var hrData = [0, 0, 0.05, 0.18, 0.3, 0.08, -0.12, 0.25, 0.4, 0.1, 0.05, 0, 0];
    hrData.forEach(function(v, i) {
      hrPoints.push(new THREE.Vector3(-0.22 + i * 0.037, v * 0.5, 0.115));
    });
    var hrGeo = new THREE.BufferGeometry().setFromPoints(hrPoints);
    var hrLine = new THREE.Line(hrGeo, lineMat);
    watchGroup.add(hrLine);

    // Metric bars
    [-.15, -.05, .05, .15].forEach(function(bx, i) {
      var h = .05 + i * .04;
      var barGeo = new THREE.BoxGeometry(0.018, h, 0.002);
      var barMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.4 });
      var bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(bx, -0.15, 0.115);
      watchGroup.add(bar);
    });

    // Score circle outline
    var circleGeo = new THREE.RingGeometry(0.08, 0.09, 48);
    var circleMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    var circle = new THREE.Mesh(circleGeo, circleMat);
    circle.position.set(0.14, 0.22, 0.115);
    watchGroup.add(circle);

    watchGroup.position.set(0, 0, 0);
    scene.add(watchGroup);
  }

  /* ================================================================
     BUILD PARTICLES — gold dust field
  ================================================================ */
  function buildParticles() {
    var count = 300;
    var geo = new THREE.BufferGeometry();
    var positions = new Float32Array(count * 3);
    var scales = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      scales[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    var mat = new THREE.PointsMaterial({
      color: 0xd4af37,
      size: 0.018,
      transparent: true,
      opacity: 0.45,
      sizeAttenuation: true,
    });
    particleSys = new THREE.Points(geo, mat);
    scene.add(particleSys);
  }

  /* ================================================================
     BUILD RINGS — gold wireframe orbit rings
  ================================================================ */
  function buildRings() {
    ringGroup = new THREE.Group();
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });

    [2.5, 3.2, 4.0].forEach(function(r, i) {
      var geo = new THREE.TorusGeometry(r, 0.004, 8, 80);
      var ring = new THREE.Mesh(geo, ringMat.clone());
      ring.rotation.x = Math.PI / (2.2 + i * 0.4);
      ring.rotation.y = i * 0.3;
      ringGroup.add(ring);
    });
    scene.add(ringGroup);
  }

  /* ================================================================
     SCROLL-DRIVEN STATE MACHINE
  ================================================================ */
  function setupScrollStates() {
    var scenes = document.querySelectorAll('.scene[data-scene]');

    scenes.forEach(function(el) {
      var sceneName = el.dataset.scene;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter:     function() { setWatchState(sceneName); },
        onEnterBack: function() { setWatchState(sceneName); },
      });
    });

    // Specific deeper animations
    setupRevealZoom();
    setupIntelligenceHologram();
    setupPrivacyShield();
    setupCTAMajestic();
  }

  function setWatchState(name) {
    if (currentScene === name) return;
    currentScene = name;
    var s = sceneStates[name] || sceneStates.hero;

    // Animate targetPos
    gsap.to(targetPos, {
      x: s.pos[0], y: s.pos[1], z: s.pos[2],
      duration: 2.2, ease: 'power4.out',
    });
    gsap.to(targetRot, {
      x: s.rot[0], y: s.rot[1], z: s.rot[2],
      duration: 2.2, ease: 'power4.out',
    });
    gsap.to(targetCam, {
      z: s.cam,
      duration: 2.5, ease: 'power4.out',
    });
    // Particle color
    if (particleSys) {
      gsap.to(particleSys.material.color, {
        r: ((s.particleColor >> 16) & 0xFF) / 255,
        g: ((s.particleColor >> 8)  & 0xFF) / 255,
        b: (s.particleColor         & 0xFF) / 255,
        duration: 1.5,
      });
    }
    // Ring opacity
    if (ringGroup) {
      ringGroup.children.forEach(function(r) {
        gsap.to(r.material, { opacity: 0.08 * s.glowIntensity, duration: 1.5 });
      });
    }
  }

  /* Product Reveal — dramatic zoom in */
  function setupRevealZoom() {
    ScrollTrigger.create({
      trigger: '#scene-reveal',
      start: 'top top',
      end: 'bottom top',
      scrub: 1,
      onUpdate: function(self) {
        var p = self.progress;
        // Camera zooms toward watch
        gsap.set(targetCam, { z: 5 - p * 1.8 });
        // Ring expansion
        if (ringGroup) {
          ringGroup.children.forEach(function(r, i) {
            r.scale.setScalar(1 + p * 0.3 * (i + 1));
            r.material.opacity = 0.08 + p * 0.12;
          });
        }
      },
    });
  }

  /* Intelligence — orbit halo speed */
  function setupIntelligenceHologram() {
    ScrollTrigger.create({
      trigger: '#intelligence',
      start: 'top 60%',
      end: 'bottom 40%',
      onEnter: function() {
        gsap.to(ringGroup.children[0].material, { opacity: 0.18, duration: 1 });
        gsap.to(ringGroup.children[1].material, { opacity: 0.22, duration: 1 });
      },
      onLeave: function() {
        gsap.to(ringGroup.children[0].material, { opacity: 0.08, duration: 1 });
        gsap.to(ringGroup.children[1].material, { opacity: 0.08, duration: 1 });
      },
      onEnterBack: function() {
        gsap.to(ringGroup.children[0].material, { opacity: 0.18, duration: 1 });
      },
    });
  }

  /* Privacy — shield pulse */
  function setupPrivacyShield() {
    ScrollTrigger.create({
      trigger: '#scene-privacy',
      start: 'top 60%',
      end: 'bottom 40%',
      onEnter: function() {
        gsap.to(ringGroup.scale, { x: 1.15, y: 1.15, z: 1.15, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      },
      onLeave: function() {
        gsap.killTweensOf(ringGroup.scale);
        gsap.to(ringGroup.scale, { x: 1, y: 1, z: 1, duration: 1 });
      },
    });
  }

  /* CTA — majestic zoom out */
  function setupCTAMajestic() {
    ScrollTrigger.create({
      trigger: '#cta',
      start: 'top 60%',
      onEnter: function() {
        gsap.to(targetCam, { z: 4.2, duration: 3, ease: 'power4.out' });
        gsap.to(particleSys.material, { opacity: 0.7, duration: 2 });
        ringGroup.children.forEach(function(r) {
          gsap.to(r.material, { opacity: 0.18, duration: 2 });
        });
      },
    });
  }

  /* ================================================================
     RENDER LOOP — smooth lerp, mouse parallax
  ================================================================ */
  function renderLoop() {
    requestAnimationFrame(renderLoop);
    var delta = clock.getDelta();
    var elapsed = clock.getElapsedTime();

    // Smooth mouse
    mouse.x += (mouse.targetX - mouse.x) * 0.04;
    mouse.y += (mouse.targetY - mouse.y) * 0.04;

    var s = sceneStates[currentScene] || sceneStates.hero;

    // Watch position lerp
    watchGroup.position.x += (targetPos.x - watchGroup.position.x) * 0.04;
    watchGroup.position.y += (targetPos.y - watchGroup.position.y) * 0.04;
    watchGroup.position.z += (targetPos.z - watchGroup.position.z) * 0.04;

    // Watch rotation lerp + mouse parallax + idle sway + CONTINUOUS SCROLL
    var idleY = Math.sin(elapsed * s.speed) * 0.15;
    var idleX = Math.cos(elapsed * s.speed * 0.7) * 0.05;
    var scrollRotOffset = scrollProgress * Math.PI * 2;
    
    watchGroup.rotation.x += (targetRot.x + idleX + mouse.y * s.tilt - watchGroup.rotation.x) * 0.035;
    watchGroup.rotation.y += (targetRot.y + scrollRotOffset + idleY + mouse.x * s.tilt * 1.5 - watchGroup.rotation.y) * 0.035;
    watchGroup.rotation.z += (targetRot.z - watchGroup.rotation.z) * 0.035;

    // Camera z lerp
    camera.position.z += (targetCam.z - camera.position.z) * 0.025;
    // Subtle camera drift
    camera.position.x += (-mouse.x * 0.15 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 0.1 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    // Particle drift
    if (particleSys) {
      particleSys.rotation.y += 0.00025;
      particleSys.rotation.x += 0.00008;
    }

    // Ring counter-rotation
    if (ringGroup) {
      ringGroup.children[0].rotation.z += 0.0012;
      ringGroup.children[1].rotation.z -= 0.0018;
      ringGroup.children[2].rotation.y += 0.0008;
    }

    renderer.render(scene, camera);
  }

  /* ================================================================
     5. SPLIT TEXT REVEALS
  ================================================================ */
  function initSplits() {
    document.querySelectorAll('[data-split]').forEach(function(el) {
      var s = new SplitType(el, { types: 'chars' });
      gsap.fromTo(s.chars,
        { opacity: 0, y: 70 },
        {
          opacity: 1, y: 0, duration: 1.5, stagger: 0.018, ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 84%', toggleActions: 'play none none reverse' },
        }
      );
    });
  }

  /* ================================================================
     6. FADE-UP ELEMENTS
  ================================================================ */
  function initFades() {
    document.querySelectorAll('.fade-up').forEach(function(el) {
      var delay = parseFloat(el.dataset.delay || 0) / 1000;
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1.4, delay: delay, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
      });
    });
  }

  /* ================================================================
     7. ANIMATED COUNTERS
  ================================================================ */
  function initCounters() {
    document.querySelectorAll('[data-count]').forEach(function(el) {
      var target = parseFloat(el.dataset.count);
      var isFloat = el.dataset.float === 'true';
      var suffix = el.dataset.suffix || '';
      var obj = { val: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: function() {
          gsap.to(obj, {
            val: target, duration: 2.8, ease: 'power4.out',
            onUpdate: function() {
              el.textContent = (isFloat ? obj.val.toFixed(1) : Math.round(obj.val)) + suffix;
            },
          });
        },
      });
    });
  }

  /* ================================================================
     8. MAGNETIC BUTTONS
  ================================================================ */
  function initMagnetic() {
    document.querySelectorAll('.magnetic').forEach(function(btn) {
      btn.addEventListener('mousemove', function(e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width  / 2) * 0.22;
        var y = (e.clientY - r.top  - r.height / 2) * 0.22;
        gsap.to(btn, { x: x, y: y, duration: .3, ease: 'power2.out' });
      });
      btn.addEventListener('mouseleave', function() {
        gsap.to(btn, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  /* ================================================================
     9. APP MOCKUP FLOAT
  ================================================================ */
  function initFloat() {
    var img = document.querySelector('.app-img');
    if (img) gsap.to(img, { y: -14, duration: 3.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }

  /* ================================================================
     BOOT
  ================================================================ */
  window.addEventListener('DOMContentLoaded', function() {
    gsap.registerPlugin(ScrollTrigger);

    runPreloader(function() {
      /* Init Three.js first so canvas is ready */
      initThreeJS();

      /* Init scroll */
      initLenis();

      /* UI */
      initCursor();
      initSplits();
      initFades();
      initCounters();
      initMagnetic();
      initFloat();

      /* Scroll-driven 3D states */
      setupScrollStates();

      ScrollTrigger.refresh();
    });
  });
})();

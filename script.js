/* ================================================================
   VITAVERSE — Scroll-Driven 3D Watch Engine
   Three.js + GSAP ScrollTrigger + Lenis + Post-Processing
   Ultra-Luxury "WHOOP x Rolex" Silver/Gold Model
   ================================================================ */
(function () {
  'use strict';

  var lenis, camera, renderer, scene, watchGroup, particleSys, ringGroup, holoGroup, shadowPlane;
  var composer, bloomPass;
  var watchParts = {}; 
  var clock = new THREE.Clock();
  var mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  var scrollProgress = 0;
  var currentScene = 'hero';
  var targetPos = { x: 0, y: 0, z: 0 };
  var targetRot = { x: 0, y: 0, z: 0 };
  var targetCam = { z: 5 };

  var audioCtx = null;
  var isSoundEnabled = false;
  var ambientOsc, ambientGain;

  /* GSAP SCENE STATES (Includes Macro Zoom Moments) */
  var sceneStates = {
    hero:        { pos:[0,0,0],      rot:[0,0,0],       cam:4.5,  tilt:.06, speed:.4,  glow:1.0, explode:0 },
    problem1:    { pos:[-1.2,0,0],   rot:[.2,.4,0],     cam:5.0,  tilt:.04, speed:.2,  glow:.3,  explode:0 },
    problem2:    { pos:[-1.4,-.2,0], rot:[.25,.5,.05],  cam:5.2,  tilt:.04, speed:.2,  glow:.4,  explode:0 },
    problem3:    { pos:[-1.6,.2,0],  rot:[.1,.3,-.05],  cam:5.4,  tilt:.04, speed:.2,  glow:.5,  explode:0 },
    reveal1:     { pos:[0,0,0],      rot:[0,Math.PI,0], cam:1.8,  tilt:.08, speed:.2,  glow:1.8, explode:0 }, // MACRO ZOOM
    reveal2:     { pos:[1.2,0,0],    rot:[0,Math.PI*1.1,0],cam:4.0,tilt:.05,speed:.3, glow:1.2, explode:1 }, // EXPLODE
    intel1:      { pos:[1.2,0,0],    rot:[Math.PI/2,0,0], cam:4.2, tilt:.07, speed:.6,  glow:1.2, explode:0 },
    intel2:      { pos:[1.4,-.1,0],  rot:[Math.PI/2,0,.2],cam:4.4, tilt:.07, speed:.6,  glow:1.0, explode:0 },
    performance: { pos:[0,0,0],      rot:[.1,Math.PI/2,.05],cam:2.8,tilt:.05,speed:.5, glow:.8,  explode:0 },
    design1:     { pos:[1.0,-.2,0],  rot:[-.1,-.5,.05], cam:1.6,  tilt:.06, speed:.1,  glow:1.5, explode:0 }, // MACRO ZOOM ON TEXTURE
    design2:     { pos:[1.2,0,0],    rot:[-.2,-.8,.1],  cam:3.8,  tilt:.04, speed:.35, glow:1.0, explode:0 },
    ecosystem:   { pos:[-1.6,0,0],   rot:[.05,.4,0],    cam:4.8,  tilt:.04, speed:.3,  glow:.6,  explode:0 },
    privacy:     { pos:[0,0,0],      rot:[0,0,0],       cam:5.0,  tilt:.03, speed:.15, glow:.7,  explode:0 },
    cta:         { pos:[0,0,0],      rot:[0,Math.PI*2,0],cam:4.2, tilt:.06, speed:.4,  glow:2.0, explode:0 },
  };

  /* ================================================================
     1. PRELOADER & SCROLL
  ================================================================ */
  function runPreloader(cb) {
    gsap.timeline({ onComplete: cb })
      .to('.pl-bar', { scaleX: 1, duration: 2, ease: 'power4.inOut' })
      .to('.pl-inner', { opacity: 0, duration: .5, ease: 'power2.in' }, '+=.2')
      .to('#preloader', { yPercent: -100, duration: 1.2, ease: 'power4.inOut' })
      .set('#preloader', { display: 'none' });
  }

  function initLenis() {
    lenis = new Lenis({ lerp: 0.05, smoothWheel: true, wheelMultiplier: 0.6 });
    lenis.on('scroll', function(e) { scrollProgress = e.progress; ScrollTrigger.update(); });
    gsap.ticker.add(function(t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ================================================================
     2. AUDIO & CURSOR
  ================================================================ */
  function initCursor() {
    var cur = document.getElementById('cursor'), fol = document.getElementById('cursorRing');
    if (!cur || matchMedia('(hover:none)').matches) return;
    var cx = 0, cy = 0, fx = 0, fy = 0;
    document.addEventListener('mousemove', function(e) {
      cx = e.clientX; cy = e.clientY;
      mouse.targetX = (cx / window.innerWidth - 0.5) * 2;
      mouse.targetY = (cy / window.innerHeight - 0.5) * 2;
      gsap.set(cur, { x: cx, y: cy, xPercent:-50, yPercent:-50 });
      var mg = document.getElementById('mouseGlow');
      if (mg) gsap.set(mg, { x: cx, y: cy, xPercent:-50, yPercent:-50 });
    });
    gsap.ticker.add(function() {
      fx += (cx - fx) * 0.12; fy += (cy - fy) * 0.12;
      if (fol) gsap.set(fol, { x: fx, y: fy, xPercent:-50, yPercent:-50 });
    });
    document.querySelectorAll('a, button, .pillar-card, .ai-card, .band-card').forEach(function(el) {
      el.addEventListener('mouseenter', function() { document.body.classList.add('cursor--hover'); playHoverSound(); });
      el.addEventListener('mouseleave', function() { document.body.classList.remove('cursor--hover'); });
    });
  }

  function initSoundEngine() {
      var btn = document.getElementById('soundToggle');
      if(!btn) return;
      var lbl = btn.querySelector('.st-lbl');
      btn.addEventListener('click', function() {
          if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); setupAmbientSound(); }
          if (audioCtx.state === 'suspended') audioCtx.resume();
          isSoundEnabled = !isSoundEnabled;
          if (isSoundEnabled) {
              btn.classList.add('is-active'); lbl.textContent = 'Sound On';
              gsap.to(ambientGain.gain, { value: 0.15, duration: 2 });
          } else {
              btn.classList.remove('is-active'); lbl.textContent = 'Sound Off';
              gsap.to(ambientGain.gain, { value: 0, duration: 1 });
          }
      });
  }

  function setupAmbientSound() {
      ambientOsc = audioCtx.createOscillator(); ambientGain = audioCtx.createGain();
      ambientOsc.type = 'sine'; ambientOsc.frequency.setValueAtTime(45, audioCtx.currentTime);
      ambientGain.gain.setValueAtTime(0, audioCtx.currentTime);
      ambientOsc.connect(ambientGain); ambientGain.connect(audioCtx.destination); ambientOsc.start();
  }

  function playHoverSound() {
      if (!isSoundEnabled || !audioCtx) return;
      var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  }

  function playTransitionSound(type) {
      if (!isSoundEnabled || !audioCtx) return;
      var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      if (type === 'heavy') {
          osc.type = 'triangle'; osc.frequency.setValueAtTime(80, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.8);
          gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
          osc.start(); osc.stop(audioCtx.currentTime + 0.8);
      } else {
          osc.type = 'sine'; osc.frequency.setValueAtTime(400, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
          osc.start(); osc.stop(audioCtx.currentTime + 0.4);
      }
      osc.connect(gain); gain.connect(audioCtx.destination);
  }

  /* ================================================================
     3. PROCEDURAL TEXTURES (Studio HDRI & Leather Bump)
  ================================================================ */
  function createStudioEnvironment() {
      var envCanvas = document.createElement('canvas');
      envCanvas.width = 1024; envCanvas.height = 512;
      var ctx = envCanvas.getContext('2d');
      ctx.fillStyle = '#050505'; ctx.fillRect(0,0,1024,512); // Deep black
      // Sharp luxury studio lights
      ctx.fillStyle = '#ffffff';
      ctx.filter = 'blur(4px)';
      ctx.fillRect(100, 150, 200, 50); // Key light reflection
      ctx.fillRect(700, 200, 100, 150); // Rim light reflection
      ctx.fillStyle = '#d4af37'; // Gold bounce
      ctx.fillRect(400, 300, 150, 40);
      var tex = new THREE.CanvasTexture(envCanvas);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return tex;
  }

  function createLeatherBumpMap() {
      var c = document.createElement('canvas');
      c.width = 512; c.height = 512;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#888'; ctx.fillRect(0,0,512,512);
      // Noise grain
      for(var i=0; i<40000; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? '#999' : '#777';
          ctx.fillRect(Math.random()*512, Math.random()*512, 2, 2);
      }
      // Stitching line
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(40, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(472, 0); ctx.lineTo(472, 512); ctx.stroke();
      
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      return tex;
  }

  function createLogoTexture() {
      var c = document.createElement('canvas');
      c.width = 512; c.height = 128;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,512,128);
      ctx.fillStyle = '#fff'; ctx.font = '60px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.letterSpacing = "10px";
      ctx.fillText('VITAVERSE', 256, 64);
      return new THREE.CanvasTexture(c);
  }

  function createShadowTexture() {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var ctx = c.getContext('2d');
      var grad = ctx.createRadialGradient(128,128,0, 128,128,128);
      grad.addColorStop(0, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,256,256);
      return new THREE.CanvasTexture(c);
  }

  /* ================================================================
     4. THREE.JS INITIALIZATION
  ================================================================ */
  function initThreeJS() {
    var canvas = document.getElementById('watch-canvas');
    var W = window.innerWidth, H = window.innerHeight;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.05);

    camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 5);

    // Environment map for real chrome/silver reflections
    var pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromEquirectangular(createStudioEnvironment()).texture;

    // Cinematic Lighting
    var ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);
    var keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);
    var goldLight = new THREE.PointLight(0xd4af37, 2.5, 15);
    goldLight.position.set(-2, 0, 3);
    scene.add(goldLight);
    var rimLight = new THREE.SpotLight(0xffffff, 5, 20, Math.PI/4, 1.0, 1);
    rimLight.position.set(0, 3, -4);
    rimLight.lookAt(0,0,0);
    scene.add(rimLight);

    watchParts.lights = { key: keyLight, rim: rimLight, gold: goldLight };

    // Post-Processing
    var renderScene = new THREE.RenderPass(scene, camera);
    renderScene.clearColor = new THREE.Color(0x000000); renderScene.clearAlpha = 0;
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 1.0, 0.3, 0.75);
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    buildWatch();
    buildHolograms();
    buildParticles();
    buildRings();

    renderLoop();

    window.addEventListener('resize', function() {
      W = window.innerWidth; H = window.innerHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H); composer.setSize(W, H);
    });
  }

  /* ================================================================
     5. BUILD ULTRA-LUXURY WATCH
  ================================================================ */
  function bendGeo(baseGeo, offsetY, offsetZ) {
      var geo = baseGeo.clone();
      var pos = geo.attributes.position;
      var radius = 2.0; // Wrist curvature radius
      for (var i = 0; i < pos.count; i++) {
          var x = pos.getX(i);
          var y = pos.getY(i) + offsetY;
          var z = pos.getZ(i) + offsetZ;
          var angle = y / radius;
          var newY = Math.sin(angle) * radius;
          var newZ = (Math.cos(angle) * radius - radius) + z;
          pos.setXYZ(i, x, newY - offsetY, newZ - offsetZ);
      }
      geo.computeVertexNormals();
      return geo;
  }

  function buildWatch() {
    watchGroup = new THREE.Group();

    // 1. Brushed Silver Titanium
    var matTitanium = new THREE.MeshPhysicalMaterial({
      color: 0xeeeeee, metalness: 1.0, roughness: 0.25, 
      clearcoat: 0.5, clearcoatRoughness: 0.1,
    });
    // 2. Subtle Gold Details
    var matGold = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37, metalness: 1.0, roughness: 0.1,
      clearcoat: 1.0,
    });
    // 3. Curved Sapphire Glass
    var matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x050505, metalness: 0.9, roughness: 0.05,
      transmission: 0.8, thickness: 0.5, ior: 1.5,
      clearcoat: 1.0,
    });
    // 4. Dark Brown Premium Leather
    var matLeather = new THREE.MeshStandardMaterial({
      color: 0x3e2723, roughness: 0.85, metalness: 0.1,
      bumpMap: createLeatherBumpMap(), bumpScale: 0.02
    });
    // 5. Diamonds
    var matDiamond = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 1.0, roughness: 0.0,
      transmission: 1.0, ior: 2.4, clearcoat: 1.0
    });

    // --- Chassis (Silver Titanium, sleek curve) ---
    var chassisBaseGeo = new THREE.BoxGeometry(0.85, 1.3, 0.15, 16, 32, 4);
    var pos = chassisBaseGeo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        var r = 0.15;
        x = Math.sign(x) * Math.min(Math.abs(x), 0.425 - r) + Math.sign(x) * r;
        y = Math.sign(y) * Math.min(Math.abs(y), 0.65 - r) + Math.sign(y) * r;
        pos.setXYZ(i, x, y, z);
    }
    var chassisGeo = bendGeo(chassisBaseGeo, 0, 0);
    var chassis = new THREE.Mesh(chassisGeo, matTitanium);
    watchParts.chassis = chassis;
    watchGroup.add(chassis);

    // --- Curved Sapphire Glass Top ---
    var glassBaseGeo = new THREE.BoxGeometry(0.75, 1.2, 0.05, 16, 32, 4);
    var gPos = glassBaseGeo.attributes.position;
    for(var k=0; k<gPos.count; k++) {
        var gx = gPos.getX(k), gy = gPos.getY(k), gz = gPos.getZ(k);
        if(gz > 0) gPos.setZ(k, gz + 0.02); // Slight extra dome
    }
    var glassGeo = bendGeo(glassBaseGeo, 0, 0.08);
    var glass = new THREE.Mesh(glassGeo, matGlass);
    glass.position.set(0, 0, 0.08);
    watchParts.glass = glass;
    watchGroup.add(glass);

    // --- Internal Screen & Biometric Ring Glow ---
    var uiGroup = new THREE.Group();
    
    var screenBaseGeo = bendGeo(new THREE.PlaneGeometry(0.72, 1.15, 8, 16), 0, 0.07);
    var screenBase = new THREE.Mesh(screenBaseGeo, new THREE.MeshBasicMaterial({color: 0x000000}));
    screenBase.position.z = 0.07;
    uiGroup.add(screenBase);

    var glowRingGeo = bendGeo(new THREE.RingGeometry(0.12, 0.15, 32), 0.2, 0.072);
    var glowRing = new THREE.Mesh(
        glowRingGeo,
        new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })
    );
    glowRing.position.set(0, 0.2, 0.072);
    watchParts.glowRing = glowRing;
    uiGroup.add(glowRing);

    var hrPoints = [];
    for(var j=0; j<40; j++) hrPoints.push(new THREE.Vector3(-0.3 + j*0.015, 0, 0));
    var hrLineBaseGeo = new THREE.BufferGeometry().setFromPoints(hrPoints);
    var hrLineGeo = bendGeo(hrLineBaseGeo, -0.2, 0.072);
    var hrLine = new THREE.Line(hrLineGeo, new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.8 }));
    hrLine.position.set(0, -0.2, 0.072);
    watchParts.hrLine = hrLine;
    uiGroup.add(hrLine);
    
    watchParts.ui = uiGroup;
    watchGroup.add(uiGroup);

    // --- Subtle Gold Side Trims (15% Gold) ---
    var trimBaseGeo = new THREE.BoxGeometry(0.88, 0.8, 0.02, 16, 16, 2);
    var trimGeo = bendGeo(trimBaseGeo, 0, 0);
    var trim = new THREE.Mesh(trimGeo, matGold);
    watchParts.trim = trim;
    watchGroup.add(trim);

    // --- Micro Diamonds ---
    var dGroup = new THREE.Group();
    var dGeo = new THREE.SphereGeometry(0.012, 8, 8);
    [[-0.43, 0.38], [0.43, 0.38], [-0.43, -0.38], [0.43, -0.38]].forEach(function(pos) {
        var d = new THREE.Mesh(dGeo, matDiamond);
        // Position globally first to calculate bend
        var globY = pos[1];
        var globZ = 0.01;
        var angle = globY / 2.0;
        var bentY = Math.sin(angle) * 2.0;
        var bentZ = (Math.cos(angle) * 2.0 - 2.0) + globZ;
        d.position.set(pos[0], bentY, bentZ);
        dGroup.add(d);
    });
    watchParts.diamonds = dGroup;
    watchGroup.add(dGroup);

    // --- Hidden Internal Sensors (Bottom) ---
    var botGroup = new THREE.Group();
    var sensorCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 32), new THREE.MeshStandardMaterial({color: 0x000000, emissive: 0x00ffaa, emissiveIntensity: 2}));
    sensorCenter.rotation.x = Math.PI/2; 
    
    var sensorRing = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.12, 32), matGold);
    
    // Apply bend offset to bot group components manually
    var botY = 0, botZ = -0.08;
    var botAngle = botY / 2.0;
    var bY = Math.sin(botAngle) * 2.0;
    var bZ = (Math.cos(botAngle) * 2.0 - 2.0) + botZ;
    
    sensorCenter.position.set(0, bY, bZ);
    sensorRing.position.set(0, bY, bZ);
    botGroup.add(sensorCenter); botGroup.add(sensorRing);
    
    // Engraved Logo 
    var logoMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.1),
        new THREE.MeshStandardMaterial({color: 0x888888, metalness: 1, roughness: 0.4, alphaMap: createLogoTexture(), transparent: true, depthWrite: false})
    );
    logoMesh.rotation.y = Math.PI;
    var logoY = -0.3, logoZ = -0.076;
    var logoAngle = logoY / 2.0;
    logoMesh.position.set(0, Math.sin(logoAngle)*2.0, (Math.cos(logoAngle)*2.0 - 2.0) + logoZ);
    botGroup.add(logoMesh);

    watchParts.sensors = botGroup;
    watchGroup.add(botGroup);

    // --- Premium Dark Brown Leather Straps (WHOOP Hybrid shape) ---
    var strapBaseGeo = new THREE.BoxGeometry(0.65, 1.6, 0.1, 8, 32, 2);
    
    var topStrapGeo = bendGeo(strapBaseGeo, 1.45, 0);
    var topStrap = new THREE.Mesh(topStrapGeo, matLeather);
    topStrap.position.set(0, 1.45, 0);
    watchParts.topStrap = topStrap;
    watchGroup.add(topStrap);

    var botStrapGeo = bendGeo(strapBaseGeo, -1.45, 0);
    var botStrap = new THREE.Mesh(botStrapGeo, matLeather);
    botStrap.position.set(0, -1.45, 0);
    // Align texture properly for bottom strap
    botStrap.material = matLeather.clone();
    botStrap.material.bumpMap = createLeatherBumpMap();
    botStrap.material.bumpMap.rotation = Math.PI;
    watchParts.botStrap = botStrap;
    watchGroup.add(botStrap);

    scene.add(watchGroup);

    // --- Ground Shadow (Invisible Plane) ---
    shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 3),
        new THREE.MeshBasicMaterial({ map: createShadowTexture(), transparent: true, opacity: 0.6, depthWrite: false })
    );
    shadowPlane.rotation.x = -Math.PI/2;
    shadowPlane.position.set(0, -1.8, -1);
    scene.add(shadowPlane);
  }

  function buildHolograms() {
    holoGroup = new THREE.Group();
    var matHolo = new THREE.MeshStandardMaterial({
        color: 0x000000, emissive: 0xd4af37, emissiveIntensity: 1.5,
        transparent: true, opacity: 0, wireframe: true, side: THREE.DoubleSide
    });
    var holoCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.5, 32, 4, true), matHolo);
    holoCyl.rotation.x = Math.PI / 2;
    holoGroup.add(holoCyl);
    for(var i=0; i<3; i++) {
        var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), matHolo.clone());
        p.position.set(Math.cos(i*Math.PI*2/3)*1.8, Math.sin(i*Math.PI*2/3)*1.8, 0);
        holoGroup.add(p);
    }
    watchGroup.add(holoGroup);
  }

  function buildParticles() {
    var count = 300, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      pos[i*3] = (Math.random()-0.5)*20; pos[i*3+1] = (Math.random()-0.5)*15; pos[i*3+2] = (Math.random()-0.5)*10 - 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    particleSys = new THREE.Points(geo, new THREE.PointsMaterial({color: 0xffffff, size: 0.02, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending}));
    scene.add(particleSys);
  }

  function buildRings() {
    ringGroup = new THREE.Group();
    var ringMat = new THREE.MeshStandardMaterial({color: 0x000000, emissive: 0xd4af37, emissiveIntensity: 0.8, wireframe: true, transparent: true, opacity: 0.05});
    [2.5, 3.2, 4.0].forEach(function(r, i) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 12, 100), ringMat.clone());
      ring.rotation.x = Math.PI/(2.2+i*0.4); ring.rotation.y = i*0.3;
      ringGroup.add(ring);
    });
    scene.add(ringGroup);
  }

  /* ================================================================
     6. SCROLL STATES
  ================================================================ */
  function setupScrollStates() {
    document.querySelectorAll('.scene[data-scene]').forEach(function(el) {
      ScrollTrigger.create({
        trigger: el, start: 'top 60%', end: 'bottom 40%',
        onEnter: function() { setWatchState(el.dataset.scene); },
        onEnterBack: function() { setWatchState(el.dataset.scene); },
      });
    });

    // Reveal Macro Zoom scrub
    ScrollTrigger.create({
      trigger: '#scene-reveal', start: 'top top', end: 'bottom top', scrub: 1,
      onUpdate: function(self) {
        if(ringGroup) ringGroup.children.forEach(function(r,i) { r.scale.setScalar(1+self.progress*0.3*(i+1)); });
      }
    });

    // Intelligence Halo
    ScrollTrigger.create({
      trigger: '#intelligence', start: 'top 60%', end: 'bottom 40%',
      onEnter: function() { gsap.to(ringGroup.children[0].material, {opacity:0.3, duration:1}); },
      onLeave: function() { gsap.to(ringGroup.children[0].material, {opacity:0.05, duration:1}); },
      onEnterBack: function() { gsap.to(ringGroup.children[0].material, {opacity:0.3, duration:1}); },
    });

    // Privacy pulse
    ScrollTrigger.create({
      trigger: '#scene-privacy', start: 'top 60%', end: 'bottom 40%',
      onEnter: function() { gsap.to(ringGroup.scale, {x:1.15, y:1.15, z:1.15, duration:1.5, yoyo:true, repeat:-1, ease:'sine.inOut'}); },
      onLeave: function() { gsap.killTweensOf(ringGroup.scale); gsap.to(ringGroup.scale, {x:1, y:1, z:1, duration:1}); },
    });
  }

  function setWatchState(name) {
    if (currentScene === name) return;
    currentScene = name;
    var s = sceneStates[name] || sceneStates.hero;

    gsap.to(targetPos, { x: s.pos[0], y: s.pos[1], z: s.pos[2], duration: 2.2, ease: 'power4.out' });
    gsap.to(targetRot, { x: s.rot[0], y: s.rot[1], z: s.rot[2], duration: 2.2, ease: 'power4.out' });
    gsap.to(targetCam, { z: s.cam, duration: 2.5, ease: 'power4.out' });
    
    if(bloomPass) gsap.to(bloomPass, { strength: s.glow * 0.8, duration: 1.5 });
    
    // Transformation Moment: Open the top glass and project holograms, but keep body intact
    var exp = s.explode === 1;
    
    // Chassis and straps NEVER disconnect. They form a solid continuous loop.
    gsap.to(watchParts.topStrap.position, { y: 1.45, z: 0, duration: 2, ease: 'power3.out' });
    gsap.to(watchParts.botStrap.position, { y: -1.45, z: 0, duration: 2, ease: 'power3.out' });
    gsap.to(watchParts.chassis.position, { z: 0, duration: 2, ease: 'power3.out' });
    gsap.to(watchParts.trim.position, { z: 0, duration: 2, ease: 'power3.out' });
    gsap.to(watchParts.diamonds.position, { z: 0, duration: 2, ease: 'power3.out' });
    gsap.to(watchParts.sensors.position, { z: 0, duration: 2, ease: 'power3.out' });

    // Only glass and UI project outwards for the AI reveal
    gsap.to(watchParts.glass.position, { z: exp ? 0.25 : 0.08, duration: 2, ease: 'power3.out' });
    gsap.to(watchParts.ui.position, { z: exp ? 0.3 : 0, duration: 2, ease: 'power3.out' });

    playTransitionSound(exp ? 'heavy' : 'light');

    var showHolo = (name === 'intel1' || name === 'intel2' || name === 'performance');
    holoGroup.children.forEach(function(c) { gsap.to(c.material, { opacity: showHolo ? 0.8 : 0, duration: 1.5 }); });
  }

  /* ================================================================
     7. RENDER LOOP
  ================================================================ */
  function renderLoop() {
    requestAnimationFrame(renderLoop);
    var elapsed = clock.getElapsedTime();

    mouse.x += (mouse.targetX - mouse.x) * 0.04;
    mouse.y += (mouse.targetY - mouse.y) * 0.04;

    var s = sceneStates[currentScene] || sceneStates.hero;

    // Contact shadow position tracks watch
    if(shadowPlane) {
        shadowPlane.position.x = watchGroup.position.x;
        shadowPlane.material.opacity = 0.6 - (watchGroup.position.y * 0.2); // fade as it moves up
    }

    watchGroup.position.x += (targetPos.x - watchGroup.position.x) * 0.04;
    watchGroup.position.y += (targetPos.y - watchGroup.position.y) * 0.04;
    watchGroup.position.z += (targetPos.z - watchGroup.position.z) * 0.04;

    var idleY = Math.sin(elapsed * s.speed) * 0.15;
    var idleX = Math.cos(elapsed * s.speed * 0.7) * 0.05;
    var scrollRotOffset = scrollProgress * Math.PI * 2;
    
    watchGroup.rotation.x += (targetRot.x + idleX + mouse.y * s.tilt - watchGroup.rotation.x) * 0.035;
    watchGroup.rotation.y += (targetRot.y + scrollRotOffset + idleY + mouse.x * s.tilt * 1.5 - watchGroup.rotation.y) * 0.035;
    watchGroup.rotation.z += (targetRot.z - watchGroup.rotation.z) * 0.035;

    // Micro Light Movement (Rotate environment lights slightly)
    if(watchParts.lights) {
        watchParts.lights.key.position.x = 2 + Math.sin(elapsed * 0.2);
        watchParts.lights.gold.position.y = Math.cos(elapsed * 0.3);
    }

    // Dynamic EKG & Biometric Ring
    if(watchParts.glowRing) {
        watchParts.glowRing.scale.setScalar(1 + Math.sin(elapsed * 2) * 0.05); // breathing glow
    }
    if (watchParts.hrLine) {
        var posArr = watchParts.hrLine.geometry.attributes.position.array;
        var t = elapsed * 3.0; 
        for(var i=0; i<40; i++) {
            var x = -0.3 + i*0.015;
            var pulse = Math.sin(i * 0.5 - t) * Math.exp(-Math.pow(i - (t*10 % 40), 2) * 0.05);
            var baseline = Math.sin(x * 10 + t) * 0.01; 
            posArr[i*3 + 1] = baseline + pulse * 0.15;
        }
        watchParts.hrLine.geometry.attributes.position.needsUpdate = true;
    }

    if(holoGroup) {
      holoGroup.rotation.y -= 0.005;
      holoGroup.children.forEach(function(c, i) { if(i > 0) c.lookAt(camera.position); });
    }

    camera.position.z += (targetCam.z - camera.position.z) * 0.025;
    camera.position.x += (-mouse.x * 0.15 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 0.1 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    if (particleSys) {
      particleSys.rotation.y += 0.00025; particleSys.rotation.x += 0.00008;
    }
    if (ringGroup) {
      ringGroup.children[0].rotation.z += 0.0012; ringGroup.children[1].rotation.z -= 0.0018; ringGroup.children[2].rotation.y += 0.0008;
    }

    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  /* ================================================================
     8. UI INTERACTIONS
  ================================================================ */
  function initSplits() {
    document.querySelectorAll('[data-split]').forEach(function(el) {
      var s = new SplitType(el, { types: 'chars' });
      gsap.fromTo(s.chars, { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 1.5, stagger: 0.018, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 84%', toggleActions: 'play none none reverse' } });
    });
  }
  function initFades() {
    document.querySelectorAll('.fade-up').forEach(function(el) {
      gsap.to(el, { opacity: 1, y: 0, duration: 1.4, delay: (parseFloat(el.dataset.delay||0)/1000), ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } });
    });
  }
  function initCounters() {
    document.querySelectorAll('[data-count]').forEach(function(el) {
      var obj = { val: 0 }, target = parseFloat(el.dataset.count), isF = el.dataset.float === 'true', suf = el.dataset.suffix || '';
      ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: function() {
          gsap.to(obj, { val: target, duration: 2.8, ease: 'power4.out', onUpdate: function() { el.textContent = (isF ? obj.val.toFixed(1) : Math.round(obj.val)) + suf; } });
      } });
    });
  }
  function initMagnetic() {
    document.querySelectorAll('.magnetic').forEach(function(btn) {
      btn.addEventListener('mousemove', function(e) {
        var r = btn.getBoundingClientRect(); gsap.to(btn, { x: (e.clientX-r.left-r.width/2)*0.22, y: (e.clientY-r.top-r.height/2)*0.22, duration: .3, ease: 'power2.out' });
      });
      btn.addEventListener('mouseleave', function() { gsap.to(btn, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1, 0.4)' }); });
    });
  }
  function initFloat() {
    var img = document.querySelector('.app-img');
    if (img) gsap.to(img, { y: -14, duration: 3.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }

  window.addEventListener('DOMContentLoaded', function() {
    gsap.registerPlugin(ScrollTrigger);
    runPreloader(function() {
      initThreeJS(); initLenis(); initCursor(); initSoundEngine();
      initSplits(); initFades(); initCounters(); initMagnetic(); initFloat();
      setupScrollStates(); ScrollTrigger.refresh();
    });
  });
})();

// ─────────────────────────────────────────────────────────────
//  EiFF Hero — Three.js Wire-mesh Wave Background
//  Pearly-white wire mesh, slow undulating animation
// ─────────────────────────────────────────────────────────────
(function () {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.min.js';
    script.onload = initWave;
    document.head.appendChild(script);

    function initWave() {
        const container = document.getElementById('wave-canvas-container');
        if (!container) return;

        const W = container.offsetWidth;
        const H = container.offsetHeight;

        // ── Scene / Camera / Renderer ──────────────────────────────
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
        camera.position.set(0, 6, 16);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(W, H);
        renderer.setClearColor(0x000000, 0);           // transparent bg
        container.appendChild(renderer.domElement);

        // ── Geometry — wide, fine-grid plane ───────────────────────
        const SEGS_X = 80;
        const SEGS_Z = 40;
        const geo = new THREE.PlaneGeometry(40, 20, SEGS_X, SEGS_Z);
        geo.rotateX(-Math.PI / 2);                     // lay flat

        // Store original Y positions
        const posArr = geo.attributes.position;
        const originY = new Float32Array(posArr.count);
        for (let i = 0; i < posArr.count; i++) originY[i] = posArr.getY(i);

        // ── Material — pearl-grey wireframe ───────────────────────
        const mat = new THREE.MeshBasicMaterial({
            color: 0xbbccdd,
            wireframe: true,
            transparent: true,
            opacity: 0.35,
        });

        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);

        // ── Resize handler ────────────────────────────────────────
        const ro = new ResizeObserver(() => {
            const w = container.offsetWidth;
            const h = container.offsetHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
        ro.observe(container);

        // ── Animation loop ────────────────────────────────────────
        let t = 0;
        function animate() {
            requestAnimationFrame(animate);
            t += 0.006;                                  // slow — half-speed feel

            for (let i = 0; i < posArr.count; i++) {
                const x = posArr.getX(i);
                const z = posArr.getZ(i);
                // layered sine waves — organic, not uniform
                const y = originY[i]
                    + Math.sin(x * 0.35 + t) * 0.55
                    + Math.sin(z * 0.45 + t * 0.8) * 0.4
                    + Math.sin((x + z) * 0.2 + t * 0.6) * 0.25;
                posArr.setY(i, y);
            }
            posArr.needsUpdate = true;
            geo.computeVertexNormals();

            renderer.render(scene, camera);
        }
        animate();
    }
})();

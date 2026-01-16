// FILE: script.js

(() => {
    'use strict';

    /* -------------------------------------------------------------------------
       DOM REFERENCES
       ------------------------------------------------------------------------- */
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const brightnessSlider = document.getElementById('brightness');
    const contrastSlider = document.getElementById('contrast');
    const saturationSlider = document.getElementById('saturation');

    const bwButton = document.getElementById('toggle-bw');
    const cineButton = document.getElementById('toggle-cinematic');
    const grainButton = document.getElementById('toggle-grain');

    const switchCameraButton = document.getElementById('switch-camera');
    const shutterButton = document.getElementById('shutter-button');
    const resetButton = document.getElementById('reset-controls');

    const statusLabel = document.getElementById('camera-status');
    const downloadLink = document.getElementById('download-link');

    /* -------------------------------------------------------------------------
       STATE MANAGEMENT
       ------------------------------------------------------------------------- */
    let currentStream = null;
    let animationFrameId = null;
    let usingFrontCamera = false;

    const state = {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        bw: false,
        cinematic: false,
        grain: false
    };

    /* -------------------------------------------------------------------------
       CAMERA INITIALIZATION & CLEANUP
       ------------------------------------------------------------------------- */
    async function startCamera() {
        stopCamera();

        const constraints = {
            video: {
                facingMode: usingFrontCamera ? 'user' : 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = currentStream;
            await video.play();

            resizeCanvas();
            renderLoop();

            statusLabel.textContent = usingFrontCamera ? 'FRONT CAM' : 'REAR CAM';
        } catch (err) {
            console.error('Camera initialization failed:', err);
            statusLabel.textContent = 'CAMERA ERROR';
        }
    }

    function stopCamera() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    /* -------------------------------------------------------------------------
       CANVAS & RENDERING
       ------------------------------------------------------------------------- */
    function resizeCanvas() {
        const { videoWidth, videoHeight } = video;
        if (!videoWidth || !videoHeight) return;

        canvas.width = videoWidth;
        canvas.height = videoHeight;
    }

    function renderLoop() {
        if (!video.videoWidth || !video.videoHeight) {
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        processFrame();

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    /* -------------------------------------------------------------------------
       IMAGE PROCESSING PIPELINE
       ------------------------------------------------------------------------- */
    function processFrame() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const brightness = state.brightness;
        const contrast = (state.contrast + 100) / 100;
        const saturation = (state.saturation + 100) / 100;

        const useBW = state.bw;
        const useCine = state.cinematic;
        const useGrain = state.grain;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Brightness
            r += brightness;
            g += brightness;
            b += brightness;

            // Contrast
            r = ((r - 128) * contrast) + 128;
            g = ((g - 128) * contrast) + 128;
            b = ((b - 128) * contrast) + 128;

            // Saturation
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = gray + (r - gray) * saturation;
            g = gray + (g - gray) * saturation;
            b = gray + (b - gray) * saturation;

            // Black & White
            if (useBW) {
                r = g = b = gray;
            }

            // Cinematic Look (teal/orange bias)
            if (useCine) {
                r *= 1.05;
                g *= 1.0;
                b *= 0.95;
            }

            // Film Grain
            if (useGrain) {
                const grain = (Math.random() - 0.5) * 12;
                r += grain;
                g += grain;
                b += grain;
            }

            data[i]     = clamp(r);
            data[i + 1] = clamp(g);
            data[i + 2] = clamp(b);
        }

        ctx.putImageData(imageData, 0, 0);
    }

    function clamp(value) {
        return Math.max(0, Math.min(255, value));
    }

    /* -------------------------------------------------------------------------
       CAPTURE HANDLING
       ------------------------------------------------------------------------- */
    function captureImage() {
        try {
            const dataURL = canvas.toDataURL('image/jpeg', 0.95);
            downloadLink.href = dataURL;
            downloadLink.download = `capture_${Date.now()}.jpg`;
            downloadLink.click();
        } catch (err) {
            console.error('Image capture failed:', err);
        }
    }

    /* -------------------------------------------------------------------------
       UI EVENT HANDLERS
       ------------------------------------------------------------------------- */
    brightnessSlider.addEventListener('input', () => {
        state.brightness = parseInt(brightnessSlider.value, 10);
    });

    contrastSlider.addEventListener('input', () => {
        state.contrast = parseInt(contrastSlider.value, 10);
    });

    saturationSlider.addEventListener('input', () => {
        state.saturation = parseInt(saturationSlider.value, 10);
    });

    bwButton.addEventListener('click', () => {
        state.bw = !state.bw;
        bwButton.classList.toggle('active', state.bw);
    });

    cineButton.addEventListener('click', () => {
        state.cinematic = !state.cinematic;
        cineButton.classList.toggle('active', state.cinematic);
    });

    grainButton.addEventListener('click', () => {
        state.grain = !state.grain;
        grainButton.classList.toggle('active', state.grain);
    });

    switchCameraButton.addEventListener('click', async () => {
        usingFrontCamera = !usingFrontCamera;
        await startCamera();
    });

    shutterButton.addEventListener('click', captureImage);

    resetButton.addEventListener('click', () => {
        state.brightness = 0;
        state.contrast = 0;
        state.saturation = 0;
        state.bw = false;
        state.cinematic = false;
        state.grain = false;

        brightnessSlider.value = 0;
        contrastSlider.value = 0;
        saturationSlider.value = 0;

        bwButton.classList.remove('active');
        cineButton.classList.remove('active');
        grainButton.classList.remove('active');
    });

    /* -------------------------------------------------------------------------
       LIFECYCLE MANAGEMENT
       ------------------------------------------------------------------------- */
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pagehide', stopCamera);
    window.addEventListener('beforeunload', stopCamera);

    /* -------------------------------------------------------------------------
       START APPLICATION
       ------------------------------------------------------------------------- */
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        startCamera();
    } else {
        statusLabel.textContent = 'UNSUPPORTED';
    }
})();

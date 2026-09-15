import {
    DEFAULT_ADAPTIVE_ALPHA,
    DEFAULT_ALPHA_GAIN,
    DEFAULT_DENOISE_BACKEND,
    DEFAULT_EDGE_DENOISE_STRENGTH,
    DEFAULT_HIGH_QUALITY_CLEANUP,
    DEFAULT_RESIDUAL_CLEANUP_STRENGTH,
    DEFAULT_SAMPLE_COUNT,
    DEFAULT_VIDEO_BITRATE,
    VIDEO_DENOISE_BACKENDS,
    detectGeminiVideoWatermark,
    inspectGeminiVideoFile,
    removeGeminiVideoWatermark
} from './video/videoExport.js';
import { isReferenceGeminiVideoSize } from './video/videoWatermarkCatalog.js';
import {
    getAutomaticVideoPresetConfig,
    getRelocatedReviewPresetConfig
} from './video/videoPresetPolicy.js';
import { resolveAllenkFdncnnRuntimeProfile } from './video/videoDenoiseRuntimePolicy.js';
import {
    applyVideoAdaptiveAlphaDebugOverride,
    applyVideoBitrateDebugOverride
} from './video/videoDebugControlOverrides.js';
import {
    consumeDebugFileHandoff,
    getDebugFileKind,
    pickDebugUploadFile,
    saveDebugFileHandoff
} from './shared/debugFileHandoff.js';
import { createAllenkFdncnnOnnxRuntime } from './core/allenkFdncnnOnnxRuntime.js';

const $ = (id) => document.getElementById(id);
const VIDEO_COPY = Object.freeze({
    en: {
        modelLoad: 'Could not load the AI model ({status}).',
        webgpu: 'Starting WebGPU AI cleanup…',
        aiLoading: 'Loading the local AI model. The first run can take a little longer…',
        progressMetadata: 'Reading video',
        progressSample: 'Sampling {sampled}/{count}',
        progressSampling: 'Sampling frames',
        progressScore: 'Matching visible mark',
        progressDone: 'Detection complete',
        progressDetecting: 'Detecting',
        samplingStatus: 'Sampling frames to detect the visible mark: {sampled}/{count}',
        samplingStatusSimple: 'Sampling frames to detect the visible mark…',
        matchingStatus: 'Matching mark candidates. The page will remain responsive…',
        unknown: 'Unknown',
        play: 'Play',
        pause: 'Pause',
        playbackBlocked: 'Playback was blocked by the browser. Please press play again.',
        presetTitle: 'AI automatic cleanup',
        presetStandard: 'The local AI model is set to process a supported Gemini/Veo mark.',
        presetRelocated: 'The local review preset is ready for a detected mark outside its usual position.',
        metadataWaiting: 'Waiting for a video.',
        metadataSize: 'Dimensions',
        metadataDuration: 'Duration',
        metadataFrameRate: 'Frame rate',
        metadataBitrate: 'Video bitrate',
        metadataSpec: 'Mark profile',
        metadataReference: '1920 × 1080 confirmed',
        metadataExperimental: 'Aspect-ratio estimate',
        detectionWaiting: 'Detect a mark or process directly.',
        detectionCandidate: 'Candidate',
        detectionPosition: 'Position',
        detectionSize: 'Size',
        detectionScore: 'Average score',
        detectionVotes: 'Votes',
        detectionStatus: 'Status',
        readyToExport: 'Ready to export',
        lowConfidence: 'Low confidence',
        chooseSupported: 'Choose an image or video file. Videos are processed here; images return to the image workspace.',
        ready: 'Ready',
        readingMetadata: 'Reading video metadata…',
        videoLoaded: 'Video loaded. Process it to run the local AI cleanup.',
        videoReadFailed: 'Could not read this video.',
        openingImage: 'Opening the image workspace…',
        openingImageFailed: 'Could not open the image workspace. Please choose the image again.',
        detecting: 'Detecting',
        detectingCorner: 'Sampling frames to detect the visible mark…',
        detectionSuccess: 'Detection complete. AI cleanup will run during export.',
        detectionLowConfidence: 'Detection confidence is low. You can still try an AI export.',
        detectionFailed: 'Detection failed',
        start: 'Starting',
        processingLocal: 'Processing video locally. Keep this page open until it finishes.',
        checkingCandidates: 'Detecting visible mark candidates…',
        exporting: 'Exporting {frames}',
        processing: 'Processing',
        exportingStatus: 'Exporting the video: {frames} processed.',
        complete: 'Complete',
        audioKept: 'Audio kept: {codec}, {packets} packets.',
        audioNotKept: 'Audio was not retained: {reason}.',
        aiComplete: 'AI cleanup complete',
        cleanupComplete: 'Cleanup complete',
        completedStatus: '{cleanup} — {frames} frames processed. {audio}',
        exportFailed: 'Export failed',
        waitingVideo: 'Waiting for a video',
        autoSelected: 'Automatic preset selected: {label}.',
        reviewPreset: 'Review preset applied: Canvas footprint polish, 12 Mbps, low-confidence export enabled. Use it for manual review only.',
        handoffFailed: 'Could not retrieve the selected video. Please choose it again.',
        webCodecsUnavailable: 'This browser does not support WebCodecs. Please use a recent Chrome or Edge browser.',
        noFrames: 'Processing'
    },
    vi: {
        modelLoad: 'Không thể tải mô hình AI ({status}).',
        webgpu: 'Đang khởi động dọn logo AI bằng WebGPU…',
        aiLoading: 'Đang tải mô hình AI cục bộ. Lần chạy đầu có thể mất thêm thời gian…',
        progressMetadata: 'Đang đọc video',
        progressSample: 'Đang lấy mẫu {sampled}/{count}',
        progressSampling: 'Đang lấy khung mẫu',
        progressScore: 'Đang khớp dấu hiển thị',
        progressDone: 'Đã nhận diện xong',
        progressDetecting: 'Đang nhận diện',
        samplingStatus: 'Đang lấy khung để nhận diện dấu hiển thị: {sampled}/{count}',
        samplingStatusSimple: 'Đang lấy khung để nhận diện dấu hiển thị…',
        matchingStatus: 'Đang so khớp các vị trí dấu. Trang vẫn hoạt động bình thường…',
        unknown: 'Không rõ',
        play: 'Phát',
        pause: 'Tạm dừng',
        playbackBlocked: 'Trình duyệt đã chặn phát video. Hãy bấm phát lại.',
        presetTitle: 'Dọn logo tự động bằng AI',
        presetStandard: 'Mô hình AI cục bộ đã sẵn sàng xử lý dấu Gemini/Veo được hỗ trợ.',
        presetRelocated: 'Cấu hình rà soát cục bộ sẵn sàng cho dấu được phát hiện ngoài vị trí thông thường.',
        metadataWaiting: 'Đang chờ video.',
        metadataSize: 'Kích thước',
        metadataDuration: 'Thời lượng',
        metadataFrameRate: 'Tốc độ khung hình',
        metadataBitrate: 'Bitrate video',
        metadataSpec: 'Hồ sơ dấu',
        metadataReference: 'Đã xác nhận 1920 × 1080',
        metadataExperimental: 'Ước lượng theo tỷ lệ',
        detectionWaiting: 'Nhận diện dấu hoặc xử lý trực tiếp.',
        detectionCandidate: 'Đối tượng',
        detectionPosition: 'Vị trí',
        detectionSize: 'Kích thước',
        detectionScore: 'Điểm trung bình',
        detectionVotes: 'Số phiếu',
        detectionStatus: 'Trạng thái',
        readyToExport: 'Sẵn sàng xuất',
        lowConfidence: 'Độ tin cậy thấp',
        chooseSupported: 'Hãy chọn ảnh hoặc video. Video được xử lý tại đây; ảnh sẽ quay về trang xử lý ảnh.',
        ready: 'Sẵn sàng',
        readingMetadata: 'Đang đọc thông tin video…',
        videoLoaded: 'Đã tải video. Hãy xử lý để chạy dọn logo AI cục bộ.',
        videoReadFailed: 'Không thể đọc video này.',
        openingImage: 'Đang mở trang xử lý ảnh…',
        openingImageFailed: 'Không thể mở trang xử lý ảnh. Hãy chọn ảnh lại.',
        detecting: 'Đang nhận diện',
        detectingCorner: 'Đang lấy khung để nhận diện dấu hiển thị…',
        detectionSuccess: 'Đã nhận diện xong. AI sẽ dọn logo khi xuất video.',
        detectionLowConfidence: 'Độ tin cậy nhận diện thấp. Bạn vẫn có thể thử xuất bằng AI.',
        detectionFailed: 'Nhận diện thất bại',
        start: 'Bắt đầu',
        processingLocal: 'Đang xử lý video cục bộ. Hãy giữ trang này mở đến khi hoàn tất.',
        checkingCandidates: 'Đang nhận diện các vị trí dấu…',
        exporting: 'Đang xuất {frames}',
        processing: 'Đang xử lý',
        exportingStatus: 'Đang xuất video: đã xử lý {frames}.',
        complete: 'Hoàn tất',
        audioKept: 'Đã giữ âm thanh: {codec}, {packets} gói.',
        audioNotKept: 'Không giữ được âm thanh: {reason}.',
        aiComplete: 'AI đã dọn logo xong',
        cleanupComplete: 'Đã dọn logo xong',
        completedStatus: '{cleanup} — đã xử lý {frames} khung. {audio}',
        exportFailed: 'Xuất video thất bại',
        waitingVideo: 'Đang chờ video',
        autoSelected: 'Đã chọn cấu hình tự động: {label}.',
        reviewPreset: 'Đã áp dụng cấu hình rà soát: Canvas footprint polish, 12 Mbps và cho phép xuất độ tin cậy thấp. Chỉ dùng để rà soát thủ công.',
        handoffFailed: 'Không thể lấy video đã chọn. Hãy chọn lại.',
        webCodecsUnavailable: 'Trình duyệt này không hỗ trợ WebCodecs. Hãy dùng Chrome hoặc Edge bản mới.',
        noFrames: 'Đang xử lý'
    }
});

function t(key, values = {}) {
    const locale = typeof window.__gaxVideoLocale === 'function' && window.__gaxVideoLocale() === 'vi' ? 'vi' : 'en';
    const message = VIDEO_COPY[locale][key] || VIDEO_COPY.en[key] || key;
    return message.replace(/\{(\w+)\}/g, (token, name) => values[name] ?? token);
}
const ALLENK_FDNCNN_WASM_PATHS = Object.freeze({
    mjs: './onnxruntime/ort-wasm-simd-threaded.js',
    wasm: './onnxruntime/ort-wasm-simd-threaded.wasm'
});
const ALLENK_FDNCNN_WEBGPU_WASM_PATHS = Object.freeze({
    mjs: './onnxruntime/ort-wasm-simd-threaded.asyncify.mjs',
    wasm: './onnxruntime/ort-wasm-simd-threaded.asyncify.wasm'
});

const state = {
    file: null,
    originalUrl: null,
    processedUrl: null,
    metadata: null,
    detection: null,
    running: false,
    jobId: 0,
    syncingPlayback: false
};

const allenkFdncnnRuntimePromises = new Map();

const els = {
    dropzone: $('dropzone'),
    fileInput: $('fileInput'),
    comparePlayer: $('comparePlayer'),
    afterBadge: $('afterBadge'),
    playPauseBtn: $('playPauseBtn'),
    scrubber: $('scrubber'),
    timeLabel: $('timeLabel'),
    originalVideo: $('originalVideo'),
    processedVideo: $('processedVideo'),
    originalEmpty: $('originalEmpty'),
    processedEmpty: $('processedEmpty'),
    metadata: $('metadata'),
    detection: $('detection'),
    progressBar: $('progressBar'),
    progressText: $('progressText'),
    status: $('status'),
    alphaGain: $('alphaGain'),
    alphaGainValue: $('alphaGainValue'),
    adaptiveAlpha: $('adaptiveAlpha'),
    highQualityCleanup: $('highQualityCleanup'),
    denoiseBackend: $('denoiseBackend'),
    edgeDenoiseStrength: $('edgeDenoiseStrength'),
    edgeDenoiseStrengthValue: $('edgeDenoiseStrengthValue'),
    residualCleanup: $('residualCleanup'),
    residualCleanupValue: $('residualCleanupValue'),
    videoBitrateMbps: $('videoBitrateMbps'),
    sampleCount: $('sampleCount'),
    allowLowConfidence: $('allowLowConfidence'),
    autoPresetSummary: $('autoPresetSummary'),
    processBtn: $('processBtn'),
    detectBtn: $('detectBtn'),
    downloadBtn: $('downloadBtn'),
    resetBtn: $('resetBtn'),
    relocatedReviewPresetBtn: $('relocatedReviewPresetBtn')
};

function setStatus(message, tone = 'info') {
    els.status.textContent = message || '';
    els.status.dataset.tone = tone;
}

function isLikelyJavascriptMime(contentType) {
    const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
    return mime === 'application/javascript'
        || mime === 'text/javascript'
        || mime === 'application/ecmascript'
        || mime === 'text/ecmascript'
        || mime.endsWith('+javascript');
}

async function preflightWebGpuRuntimeAssets(paths) {
    try {
        const response = await fetch(paths.mjs, { cache: 'no-store' });
        if (!response.ok) {
            return {
                ok: false,
                reason: `WebGPU runtime module unavailable: ${response.status}`
            };
        }
        const contentType = response.headers.get('content-type') || '';
        if (!isLikelyJavascriptMime(contentType)) {
            return {
                ok: false,
                reason: `WebGPU runtime module is served as ${contentType || 'unknown MIME'}`
            };
        }
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            reason: error?.message || String(error)
        };
    }
}

async function loadAllenkFdncnnRuntime(runtimeProfile = resolveAllenkFdncnnRuntimeProfile()) {
    const profile = runtimeProfile || resolveAllenkFdncnnRuntimeProfile();
    if (!allenkFdncnnRuntimePromises.has(profile.id)) {
        const runtimePromise = (async () => {
            const response = await fetch(profile.modelUrl);
            if (!response.ok) {
                throw new Error(t('modelLoad', { status: response.status }));
            }
            const modelBytes = new Uint8Array(await response.arrayBuffer());
            if (navigator.gpu && window.__gwrDisableWebGpuDenoise !== true) {
                try {
                    const preflight = await preflightWebGpuRuntimeAssets(ALLENK_FDNCNN_WEBGPU_WASM_PATHS);
                    if (!preflight.ok) {
                        console.warn('WebGPU AI runtime skipped:', preflight.reason);
                        throw new Error(preflight.reason);
                    }
                    setStatus(t('webgpu'));
                    const webgpuOrt = await import('onnxruntime-web/webgpu');
                    return await createAllenkFdncnnOnnxRuntime({
                        ort: webgpuOrt,
                        modelBytes,
                        executionProvider: 'webgpu',
                        wasmPaths: ALLENK_FDNCNN_WEBGPU_WASM_PATHS,
                        inputName: 'fdncnn_input',
                        outputName: 'fdncnn_output',
                        inputShape: profile.inputShape,
                        outputShape: profile.outputShape
                    });
                } catch (error) {
                    console.warn('WebGPU AI runtime unavailable, falling back to WASM:', error);
                }
            }
            return createAllenkFdncnnOnnxRuntime({
                modelBytes,
                executionProvider: 'wasm',
                wasmPaths: ALLENK_FDNCNN_WASM_PATHS,
                inputName: 'fdncnn_input',
                outputName: 'fdncnn_output',
                inputShape: profile.inputShape,
                outputShape: profile.outputShape
            });
        })();
        allenkFdncnnRuntimePromises.set(profile.id, runtimePromise);
        runtimePromise.catch(() => {
            if (allenkFdncnnRuntimePromises.get(profile.id) === runtimePromise) {
                allenkFdncnnRuntimePromises.delete(profile.id);
            }
        });
    }
    return allenkFdncnnRuntimePromises.get(profile.id);
}

async function resolveExportDenoiseRuntime(denoiseBackend, runtimeProfile = resolveAllenkFdncnnRuntimeProfile()) {
    if (denoiseBackend !== VIDEO_DENOISE_BACKENDS.ALLENK_FDNCNN_BROWSER_SPIKE) {
        return null;
    }
    setStatus(t('aiLoading'));
    return loadAllenkFdncnnRuntime(runtimeProfile);
}

function getAllenkFdncnnTemporalReuseConfig(runtime) {
    if (!runtime || runtime.executionProvider !== 'wasm') {
        return null;
    }
    const hasThreadedWasm = Boolean(crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined');
    return {
        maxFrames: hasThreadedWasm ? 1 : 2,
        threshold: hasThreadedWasm ? 4.5 : 6.5
    };
}

function resolveDetectionAllenkFdncnnSigma(detection) {
    if (Number.isFinite(window.__gwrVideoOverrideAllenkFdncnnSigma)) {
        return Math.max(0, Math.min(150, window.__gwrVideoOverrideAllenkFdncnnSigma));
    }
    if (detection?.watermarkKind === 'veo-text') {
        return detection.template?.cleanup?.runtimeFdncnnSigma ?? 75;
    }
    return 75;
}

function resolveDetectionAllenkFdncnnPadding(detection, runtimeProfile) {
    if (Number.isFinite(window.__gwrVideoOverrideAllenkFdncnnPadding)) {
        return Math.max(0, Math.round(window.__gwrVideoOverrideAllenkFdncnnPadding));
    }
    if (detection?.watermarkKind === 'veo-text' && Number.isFinite(detection.template?.cleanup?.allenkFdncnnPadding)) {
        return detection.template.cleanup.allenkFdncnnPadding;
    }
    return runtimeProfile.padding;
}

function setProgress(progress, label) {
    const pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress * 100))) : 0;
    els.progressBar.style.width = `${pct}%`;
    els.progressText.textContent = label || `${pct}%`;
}

function yieldToBrowserFrame() {
    return new Promise((resolve) => {
        const finish = () => setTimeout(resolve, 0);
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(finish);
        } else {
            finish();
        }
    });
}

function createDetectionProgressHandler(jobId, { start = 0, span = 1 } = {}) {
    return ({ progress = 0, step = 'detect', sampledFrames = 0, sampleCount = 0 } = {}) => {
        if (jobId !== state.jobId) return;
        const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
        const labelByStep = {
            metadata: t('progressMetadata'),
            sample: sampleCount > 0
                ? t('progressSample', { sampled: sampledFrames, count: sampleCount })
                : t('progressSampling'),
            score: t('progressScore'),
            done: t('progressDone')
        };
        setProgress(start + safeProgress * span, labelByStep[step] || t('progressDetecting'));
        if (step === 'sample') {
            setStatus(sampleCount > 0
                ? t('samplingStatus', { sampled: sampledFrames, count: sampleCount })
                : t('samplingStatusSimple'));
        } else if (step === 'score') {
            setStatus(t('matchingStatus'));
        }
    };
}

function formatSeconds(value) {
    if (!Number.isFinite(value)) return t('unknown');
    return `${value.toFixed(2)}s`;
}

function formatBitrate(value) {
    if (!Number.isFinite(value)) return t('unknown');
    return `${(value / 1000 / 1000).toFixed(2)} Mbps`;
}

function formatPlaybackTime(value) {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const totalSeconds = Math.floor(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateButtons() {
    const hasFile = Boolean(state.file);
    els.detectBtn.disabled = !hasFile || state.running;
    els.processBtn.disabled = !hasFile || state.running;
    const canDownload = Boolean(state.processedUrl) && !state.running;
    els.downloadBtn.setAttribute('aria-disabled', canDownload ? 'false' : 'true');
    els.downloadBtn.tabIndex = canDownload ? 0 : -1;
    els.resetBtn.disabled = state.running;
    updatePlaybackControls();
}

function hasPlayableOriginal() {
    return Boolean(state.originalUrl) && Number.isFinite(els.originalVideo.duration);
}

function hasPlayableProcessed() {
    return Boolean(state.processedUrl);
}

function updatePlaybackControls() {
    const canPlay = Boolean(state.originalUrl);
    els.playPauseBtn.disabled = !canPlay;
    els.scrubber.disabled = !canPlay;
    els.playPauseBtn.dataset.playing = els.originalVideo.paused ? 'false' : 'true';
    els.playPauseBtn.setAttribute('aria-label', els.originalVideo.paused ? t('play') : t('pause'));

    const duration = Number.isFinite(els.originalVideo.duration) ? els.originalVideo.duration : 0;
    const currentTime = Number.isFinite(els.originalVideo.currentTime) ? els.originalVideo.currentTime : 0;
    if (duration > 0 && !els.scrubber.matches(':active')) {
        els.scrubber.value = String(Math.round((currentTime / duration) * 1000));
    }
    els.timeLabel.textContent = duration > 0
        ? `${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(duration)}`
        : formatPlaybackTime(currentTime);
}

function updateCompareMode() {
    const hasAfter = hasPlayableProcessed();
    els.afterBadge.hidden = !hasAfter;
    els.processedEmpty.hidden = hasAfter;
}

function updateComparisonOrientation(metadata = state.metadata) {
    if (!metadata) {
        delete els.comparePlayer.dataset.orientation;
        return;
    }
    els.comparePlayer.dataset.orientation = metadata.height > metadata.width
        ? 'portrait'
        : 'landscape';
}

function reportVideoDetection(detection, metadata = state.metadata) {
    if (!detection || !metadata) return;
    const best = detection.summary?.best || {};
    console.info('[gax-video] detection', {
        dimensions: `${metadata.width}x${metadata.height}`,
        orientation: metadata.height > metadata.width ? 'portrait' : 'landscape',
        candidate: best.candidateId || detection.candidate?.id || detection.template?.id || 'unknown',
        position: detection.position,
        confidence: best.meanConfidence ?? best.meanNcc ?? null,
        isConfident: detection.isConfident
    });
}

function syncProcessedToOriginal({ force = false } = {}) {
    if (!hasPlayableProcessed() || state.syncingPlayback) return;
    const targetTime = Number(els.originalVideo.currentTime) || 0;
    if (!force && Math.abs((Number(els.processedVideo.currentTime) || 0) - targetTime) < 0.08) return;

    state.syncingPlayback = true;
    try {
        els.processedVideo.currentTime = targetTime;
    } catch (error) {
        console.warn('sync processed video failed:', error);
    } finally {
        state.syncingPlayback = false;
    }
}

async function playComparison() {
    if (!state.originalUrl) return;
    syncProcessedToOriginal({ force: true });
    try {
        await els.originalVideo.play();
        if (hasPlayableProcessed()) {
            await els.processedVideo.play().catch((error) => {
                console.warn('processed video play failed:', error);
            });
        }
    } catch (error) {
        console.warn('original video play failed:', error);
        setStatus(t('playbackBlocked'), 'warn');
    } finally {
        updatePlaybackControls();
    }
}

function pauseComparison() {
    els.originalVideo.pause();
    els.processedVideo.pause();
    updatePlaybackControls();
}

function togglePlayback() {
    if (els.originalVideo.paused) {
        playComparison();
    } else {
        pauseComparison();
    }
}

function seekComparison(value) {
    const duration = Number(els.originalVideo.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const currentTime = (Number(value) / 1000) * duration;
    els.originalVideo.currentTime = currentTime;
    syncProcessedToOriginal({ force: true });
    updatePlaybackControls();
}

function renderAutoPresetSummary(preset = null) {
    if (!els.autoPresetSummary) return;
    if (!preset) {
        els.autoPresetSummary.innerHTML = `
            <strong>${t('presetTitle')}</strong>
            <span>${t('presetStandard')}</span>
        `;
        return;
    }

    const presetDescription = preset.id === 'relocated-review'
        ? t('presetRelocated')
        : t('presetStandard');
    els.autoPresetSummary.innerHTML = `
        <strong>${t('presetTitle')}</strong>
        <span>${presetDescription}</span>
    `;
}

function renderMetadata(metadata) {
    if (!metadata) {
        els.metadata.innerHTML = `<p class="muted">${t('metadataWaiting')}</p>`;
        return;
    }
    const reference = isReferenceGeminiVideoSize(metadata.width, metadata.height);
    els.metadata.innerHTML = `
        <dl>
            <div><dt>${t('metadataSize')}</dt><dd>${metadata.width} x ${metadata.height}</dd></div>
            <div><dt>${t('metadataDuration')}</dt><dd>${formatSeconds(metadata.duration)}</dd></div>
            <div><dt>${t('metadataFrameRate')}</dt><dd>${metadata.frameRate.toFixed(2)} fps</dd></div>
            <div><dt>${t('metadataBitrate')}</dt><dd>${formatBitrate(metadata.averageBitrate)}</dd></div>
            <div><dt>${t('metadataSpec')}</dt><dd>${reference ? t('metadataReference') : t('metadataExperimental')}</dd></div>
        </dl>
    `;
}

function renderDetection(detection) {
    if (!detection) {
        els.detection.innerHTML = `<p class="muted">${t('detectionWaiting')}</p>`;
        return;
    }

    const best = detection.summary?.best || {};
    const bestLabel = detection.watermarkKind === 'veo-text'
        ? (best.templateId || detection.template?.id || 'Veo text')
        : (best.label || best.candidateId || detection.candidate?.label || 'unknown');
    const bestScore = Number.isFinite(best.meanConfidence)
        ? best.meanConfidence
        : Number.isFinite(best.meanNcc)
            ? best.meanNcc
            : null;
    els.detection.innerHTML = `
        <dl>
            <div><dt>${t('detectionCandidate')}</dt><dd>${bestLabel}</dd></div>
            <div><dt>${t('detectionPosition')}</dt><dd>${detection.position.x}, ${detection.position.y}</dd></div>
            <div><dt>${t('detectionSize')}</dt><dd>${detection.position.width} x ${detection.position.height}</dd></div>
            <div><dt>${t('detectionScore')}</dt><dd>${Number.isFinite(bestScore) ? bestScore.toFixed(3) : '-'}</dd></div>
            <div><dt>${t('detectionVotes')}</dt><dd>${best.votes || 0}/${detection.summary?.frameCount || 0}</dd></div>
            <div><dt>${t('detectionStatus')}</dt><dd>${detection.isConfident ? t('readyToExport') : t('lowConfidence')}</dd></div>
        </dl>
    `;
}

function cleanupUrls() {
    if (state.originalUrl) URL.revokeObjectURL(state.originalUrl);
    if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
    state.originalUrl = null;
    state.processedUrl = null;
}

async function setFile(file) {
    const fileKind = getDebugFileKind(file);
    if (fileKind === 'image') {
        await routeImageFile(file);
        return;
    }
    if (fileKind !== 'video') {
        setStatus(t('chooseSupported'), 'warn');
        return;
    }

    cleanupUrls();
    state.file = file;
    state.metadata = null;
    state.detection = null;
    state.processedUrl = null;
    state.jobId++;
    updateComparisonOrientation(null);

    state.originalUrl = URL.createObjectURL(file);
    els.originalVideo.src = state.originalUrl;
    els.originalVideo.currentTime = 0;
    els.processedVideo.removeAttribute('src');
    els.processedVideo.load();
    els.downloadBtn.removeAttribute('href');
    els.downloadBtn.removeAttribute('download');
    els.originalEmpty.hidden = true;
    updateCompareMode();
    renderMetadata(null);
    renderDetection(null);
    setProgress(0, t('ready'));
    setStatus(t('readingMetadata'));
    updateButtons();

    try {
        const metadata = await inspectGeminiVideoFile(file);
        state.metadata = metadata;
        updateComparisonOrientation(metadata);
        renderMetadata(metadata);
        applyAutomaticPreset(null, metadata, { silent: true });
        setStatus(t('videoLoaded'));
    } catch (error) {
        console.error(error);
        setStatus(error.message || t('videoReadFailed'), 'error');
    } finally {
        updateButtons();
    }
}

async function routeImageFile(file) {
    try {
        setStatus(t('openingImage'));
        await saveDebugFileHandoff(file, 'image');
        window.location.assign('./?fileHandoff=1');
    } catch (error) {
        console.error(error);
        setStatus(error.message || t('openingImageFailed'), 'warn');
    }
}

function getDebugAlphaOptions() {
    return {
        alphaProfile: typeof window.__gwrVideoAlphaProfile === 'string'
            ? window.__gwrVideoAlphaProfile
            : undefined,
        alphaLowScale: Number.isFinite(window.__gwrVideoAlphaLowScale)
            ? window.__gwrVideoAlphaLowScale
            : undefined,
        alphaBodyScale: Number.isFinite(window.__gwrVideoAlphaBodyScale)
            ? window.__gwrVideoAlphaBodyScale
            : undefined,
        alphaEdgeBoost: Number.isFinite(window.__gwrVideoAlphaEdgeBoost)
            ? window.__gwrVideoAlphaEdgeBoost
            : undefined,
        alphaLocalRegion: typeof window.__gwrVideoAlphaLocalRegion === 'string'
            ? window.__gwrVideoAlphaLocalRegion
            : undefined,
        alphaLocalLowScale: Number.isFinite(window.__gwrVideoAlphaLocalLowScale)
            ? window.__gwrVideoAlphaLocalLowScale
            : undefined,
        alphaLocalBodyScale: Number.isFinite(window.__gwrVideoAlphaLocalBodyScale)
            ? window.__gwrVideoAlphaLocalBodyScale
            : undefined
    };
}

async function runDetection() {
    if (!state.file || state.running) return;
    const jobId = ++state.jobId;
    state.running = true;
    updateButtons();
    setProgress(0.05, t('detecting'));
    setStatus(t('detectingCorner'));

    try {
        await yieldToBrowserFrame();
        const result = await detectGeminiVideoWatermark(state.file, {
            ...getDebugAlphaOptions(),
            sampleCount: Number(els.sampleCount.value) || DEFAULT_SAMPLE_COUNT,
            onProgress: createDetectionProgressHandler(jobId, { start: 0.05, span: 0.9 }),
            yieldToMainThread: yieldToBrowserFrame
        });
        if (jobId !== state.jobId) return;
        state.metadata = result.metadata;
        state.detection = result.detection;
        updateComparisonOrientation(result.metadata);
        renderMetadata(result.metadata);
        renderDetection(result.detection);
        reportVideoDetection(result.detection, result.metadata);
        setProgress(1, result.detection.isConfident ? t('progressDone') : t('lowConfidence'));
        const preset = applyAutomaticPreset(result.detection, result.metadata, { silent: true });
        if (preset.id === 'relocated-review') {
            setStatus(t('detectionSuccess'), result.detection.isConfident ? 'success' : 'warn');
        } else {
            setStatus(
                result.detection.isConfident ? t('detectionSuccess') : t('detectionLowConfidence'),
                result.detection.isConfident ? 'success' : 'warn'
            );
        }
    } catch (error) {
        console.error(error);
        setStatus(error.message || t('detectionFailed'), 'error');
        setProgress(0, t('detectionFailed'));
    } finally {
        state.running = false;
        updateButtons();
    }
}

async function runExport() {
    if (!state.file || state.running) return;
    const jobId = ++state.jobId;
    state.running = true;
    updateButtons();
    setProgress(0, t('start'));
    setStatus(t('processingLocal'));

    try {
        let detectionPayload = state.detection ? { metadata: state.metadata, detection: state.detection } : null;
        if (!detectionPayload) {
            setProgress(0.04, t('detecting'));
            setStatus(t('checkingCandidates'));
            await yieldToBrowserFrame();
            const detected = await detectGeminiVideoWatermark(state.file, {
                ...getDebugAlphaOptions(),
                sampleCount: Number(els.sampleCount.value) || DEFAULT_SAMPLE_COUNT,
                onProgress: createDetectionProgressHandler(jobId, { start: 0.04, span: 0.08 }),
                yieldToMainThread: yieldToBrowserFrame
            });
            if (jobId !== state.jobId) return;
            state.metadata = detected.metadata;
            state.detection = detected.detection;
            updateComparisonOrientation(detected.metadata);
            renderMetadata(detected.metadata);
            renderDetection(detected.detection);
            reportVideoDetection(detected.detection, detected.metadata);
            detectionPayload = { metadata: detected.metadata, detection: detected.detection };
            applyAutomaticPreset(detected.detection, detected.metadata, { silent: true });
        } else {
            applyAutomaticPreset(detectionPayload.detection, detectionPayload.metadata, { silent: true });
        }
        applyDebugControlOverrides();
        const denoiseBackend = els.denoiseBackend.value || DEFAULT_DENOISE_BACKEND;
        const allenkFdncnnRuntimeProfile = resolveAllenkFdncnnRuntimeProfile(detectionPayload?.detection?.position);
        const allenkFdncnnSigma = resolveDetectionAllenkFdncnnSigma(detectionPayload?.detection);
        const allenkFdncnnPadding = resolveDetectionAllenkFdncnnPadding(
            detectionPayload?.detection,
            allenkFdncnnRuntimeProfile
        );
        const allenkFdncnnRuntime = await resolveExportDenoiseRuntime(denoiseBackend, allenkFdncnnRuntimeProfile);
        const allenkFdncnnTemporalReuse = getAllenkFdncnnTemporalReuseConfig(allenkFdncnnRuntime);
        const debugAlphaOptions = getDebugAlphaOptions();
        if (jobId !== state.jobId) return;

        const result = await removeGeminiVideoWatermark(state.file, {
            alphaGain: Number(els.alphaGain.value) || DEFAULT_ALPHA_GAIN,
            adaptiveAlpha: els.adaptiveAlpha.checked,
            highQualityCleanup: els.highQualityCleanup.checked,
            denoiseBackend,
            edgeDenoiseStrength: Number(els.edgeDenoiseStrength.value) || 0,
            residualCleanupStrength: Number(els.residualCleanup.value) || 0,
            videoBitrate: Number(els.videoBitrateMbps.value) > 0
                ? Number(els.videoBitrateMbps.value) * 1000 * 1000
                : DEFAULT_VIDEO_BITRATE,
            ...debugAlphaOptions,
            sampleCount: Number(els.sampleCount.value) || DEFAULT_SAMPLE_COUNT,
            detection: detectionPayload,
            allowLowConfidence: els.allowLowConfidence.checked,
            allenkFdncnnRuntime,
            allenkFdncnnSigma,
            allenkFdncnnPadding,
            allenkFdncnnTemporalReuse,
            yieldToMainThread: yieldToBrowserFrame,
            onProgress: ({ phase, progress, processedFrames, frameEstimate, metadata, detection, aiDenoiseFrames, aiReuseFrames }) => {
                if (jobId !== state.jobId) return;
                const cliProgress = phase === 'detect'
                    ? progress * 0.12
                    : 0.12 + progress * 0.88;
                window.__gwrVideoCliProgress = {
                    phase,
                    progress: cliProgress,
                    processedFrames,
                    frameEstimate,
                    aiDenoiseFrames,
                    aiReuseFrames
                };
                if (metadata) {
                    state.metadata = metadata;
                    updateComparisonOrientation(metadata);
                    renderMetadata(metadata);
                }
                if (detection) {
                    state.detection = detection;
                    renderDetection(detection);
                    reportVideoDetection(detection, metadata || state.metadata);
                }
                if (phase === 'detect') {
                    setProgress(progress * 0.12, progress >= 1 ? t('progressDone') : t('detecting'));
                } else if (phase === 'export') {
                    const exportProgress = 0.12 + progress * 0.88;
                    const frames = Number.isFinite(processedFrames)
                        ? String(processedFrames)
                        : t('noFrames');
                    const aiNote = '';
                    setProgress(exportProgress, t('exporting', { frames }));
                    setStatus(t('exportingStatus', { frames: `${frames}${aiNote}` }));
                }
            }
        });
        if (jobId !== state.jobId) return;

        if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
        state.processedUrl = URL.createObjectURL(result.blob);
        els.processedVideo.src = state.processedUrl;
        els.processedVideo.load();
        els.processedEmpty.hidden = true;
        updateCompareMode();
        syncProcessedToOriginal({ force: true });
        els.downloadBtn.href = state.processedUrl;
        els.downloadBtn.download = `${state.file.name.replace(/\.[^.]+$/, '')}_gwr_video_mvp.mp4`;
        setProgress(1, t('complete'));
        const audioNote = result.audioCopied
            ? t('audioKept', { codec: result.audioCodec || t('unknown'), packets: result.audioPacketCount || 0 })
            : t('audioNotKept', { reason: result.audioSkipReason || t('unknown') });
        const cleanupNote = result.denoiseBackend === VIDEO_DENOISE_BACKENDS.ALLENK_FDNCNN_BROWSER_SPIKE
            ? t('aiComplete')
            : t('cleanupComplete');
        setStatus(t('completedStatus', { cleanup: cleanupNote, frames: result.processedFrames, audio: audioNote }), 'success');
    } catch (error) {
        console.error(error);
        setStatus(error.message || t('exportFailed'), 'error');
    } finally {
        state.running = false;
        updateButtons();
    }
}

function reset() {
    state.jobId++;
    cleanupUrls();
    state.file = null;
    state.metadata = null;
    state.detection = null;
    state.running = false;
    updateComparisonOrientation(null);
    els.fileInput.value = '';
    els.originalVideo.removeAttribute('src');
    els.originalVideo.load();
    els.processedVideo.removeAttribute('src');
    els.processedVideo.load();
    els.downloadBtn.removeAttribute('href');
    els.downloadBtn.removeAttribute('download');
    els.originalEmpty.hidden = false;
    updateCompareMode();
    renderMetadata(null);
    renderDetection(null);
    renderAutoPresetSummary(null);
    setProgress(0, t('waitingVideo'));
    setStatus('');
    updateButtons();
}

function setNumberControl(input, value) {
    if (input.hasAttribute('max') && Number(value) > Number(input.getAttribute('max'))) {
        input.setAttribute('max', String(value));
    }
    input.value = String(value);
    if (input === els.alphaGain) {
        els.alphaGainValue.textContent = Number(input.value).toFixed(2);
    } else if (input === els.residualCleanup) {
        els.residualCleanupValue.textContent = Number(input.value).toFixed(2);
    } else if (input === els.edgeDenoiseStrength) {
        els.edgeDenoiseStrengthValue.textContent = Number(input.value).toFixed(2);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyPresetToControls(preset) {
    if (!preset) return;
    setNumberControl(els.alphaGain, preset.alphaGain ?? DEFAULT_ALPHA_GAIN);
    els.adaptiveAlpha.checked = preset.adaptiveAlpha ?? DEFAULT_ADAPTIVE_ALPHA;
    els.highQualityCleanup.checked = preset.highQualityCleanup ?? DEFAULT_HIGH_QUALITY_CLEANUP;
    els.denoiseBackend.value = Object.values(VIDEO_DENOISE_BACKENDS).includes(preset.denoiseBackend)
        ? preset.denoiseBackend
        : DEFAULT_DENOISE_BACKEND;
    els.denoiseBackend.dispatchEvent(new Event('change', { bubbles: true }));
    setNumberControl(els.edgeDenoiseStrength, preset.edgeDenoiseStrength ?? DEFAULT_EDGE_DENOISE_STRENGTH);
    setNumberControl(els.residualCleanup, preset.residualCleanupStrength ?? DEFAULT_RESIDUAL_CLEANUP_STRENGTH);
    els.sampleCount.value = String(preset.sampleCount ?? DEFAULT_SAMPLE_COUNT);
    els.videoBitrateMbps.value = Number(preset.videoBitrateMbps) > 0
        ? String(preset.videoBitrateMbps)
        : '';
    els.allowLowConfidence.checked = preset.allowLowConfidence === true;
    renderAutoPresetSummary(preset);
}

function applyAutomaticPreset(detection = state.detection, metadata = state.metadata, { silent = false } = {}) {
    const preset = getAutomaticVideoPresetConfig(detection, metadata);
    applyPresetToControls(preset);
    if (!silent) {
        setStatus(t('autoSelected', { label: t('presetTitle') }), preset.allowLowConfidence ? 'warn' : 'success');
    }
    return preset;
}

function applyDebugControlOverrides() {
    applyVideoAdaptiveAlphaDebugOverride({
        windowObject: window,
        adaptiveAlphaInput: els.adaptiveAlpha
    });
    if (typeof window.__gwrVideoOverrideDenoiseBackend === 'string') {
        if (els.denoiseBackend.value !== window.__gwrVideoOverrideDenoiseBackend) {
            els.denoiseBackend.value = window.__gwrVideoOverrideDenoiseBackend;
            els.denoiseBackend.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    if (typeof window.__gwrVideoOverrideAllowLowConfidence === 'boolean') {
        els.allowLowConfidence.checked = window.__gwrVideoOverrideAllowLowConfidence;
    }
    if (Number.isFinite(window.__gwrVideoOverrideEdgeDenoiseStrength)) {
        setNumberControl(
            els.edgeDenoiseStrength,
            Math.max(0, Math.min(3, window.__gwrVideoOverrideEdgeDenoiseStrength))
        );
    }
    if (Number.isFinite(window.__gwrVideoOverrideResidualCleanupStrength)) {
        setNumberControl(
            els.residualCleanup,
            Math.max(0, Math.min(1.8, window.__gwrVideoOverrideResidualCleanupStrength))
        );
    }
    applyVideoBitrateDebugOverride({
        windowObject: window,
        videoBitrateInput: els.videoBitrateMbps,
        setNumberControl
    });
}

function applyRelocatedReviewPreset() {
    const preset = getRelocatedReviewPresetConfig();
    applyPresetToControls(preset);
    setStatus(t('reviewPreset'), 'warn');
}

function setupEvents() {
    els.dropzone.addEventListener('click', () => els.fileInput.click());
    els.dropzone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            els.fileInput.click();
        }
    });
    els.fileInput.addEventListener('change', (event) => {
        const file = pickDebugUploadFile(event.target.files);
        if (file) setFile(file);
    });

    for (const eventName of ['dragenter', 'dragover']) {
        els.dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            els.dropzone.dataset.dragging = 'true';
        });
    }
    for (const eventName of ['dragleave', 'drop']) {
        els.dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            els.dropzone.dataset.dragging = 'false';
        });
    }
    els.dropzone.addEventListener('drop', (event) => {
        const file = pickDebugUploadFile(event.dataTransfer?.files);
        if (file) setFile(file);
    });

    els.alphaGain.addEventListener('input', () => {
        els.alphaGainValue.textContent = Number(els.alphaGain.value).toFixed(2);
    });
    els.residualCleanup.addEventListener('input', () => {
        els.residualCleanupValue.textContent = Number(els.residualCleanup.value).toFixed(2);
    });
    els.edgeDenoiseStrength.addEventListener('input', () => {
        els.edgeDenoiseStrengthValue.textContent = Number(els.edgeDenoiseStrength.value).toFixed(2);
    });
    els.denoiseBackend.addEventListener('change', () => {
        if (els.denoiseBackend.value !== VIDEO_DENOISE_BACKENDS.ALLENK_FDNCNN_BROWSER_SPIKE) return;
        setNumberControl(els.edgeDenoiseStrength, 1.8);
    });
    els.detectBtn.addEventListener('click', runDetection);
    els.processBtn.addEventListener('click', runExport);
    els.resetBtn.addEventListener('click', reset);
    els.relocatedReviewPresetBtn.addEventListener('click', applyRelocatedReviewPreset);
    els.downloadBtn.addEventListener('click', (event) => {
        if (!state.processedUrl || state.running) event.preventDefault();
    });
    els.playPauseBtn.addEventListener('click', togglePlayback);
    els.scrubber.addEventListener('input', (event) => {
        seekComparison(event.target.value);
    });
    els.originalVideo.addEventListener('loadedmetadata', () => {
        updatePlaybackControls();
    });
    els.originalVideo.addEventListener('timeupdate', () => {
        if (!els.originalVideo.paused) syncProcessedToOriginal();
        updatePlaybackControls();
    });
    els.originalVideo.addEventListener('pause', () => {
        if (!els.processedVideo.paused) els.processedVideo.pause();
        updatePlaybackControls();
    });
    els.originalVideo.addEventListener('ended', () => {
        pauseComparison();
    });
    els.processedVideo.addEventListener('loadedmetadata', () => {
        syncProcessedToOriginal({ force: true });
        updateCompareMode();
    });
    window.addEventListener('beforeunload', cleanupUrls);
}

async function consumePendingVideoHandoff() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fileHandoff') !== '1') return;

    try {
        const record = await consumeDebugFileHandoff('video');
        if (!record?.file) return;
        await setFile(record.file);
        window.history.replaceState(null, '', window.location.pathname);
    } catch (error) {
        console.warn('video handoff unavailable:', error);
        setStatus(error.message || t('handoffFailed'), 'warn');
    }
}

async function init() {
    applyPresetToControls(getAutomaticVideoPresetConfig());

    window.addEventListener('gax-video-language-change', () => {
        renderAutoPresetSummary(getAutomaticVideoPresetConfig(state.detection, state.metadata));
        renderMetadata(state.metadata);
        renderDetection(state.detection);
        updatePlaybackControls();
        if (!state.file && !state.running) {
            setProgress(0, t('waitingVideo'));
        }
    });

    if (!('VideoDecoder' in window) || !('VideoEncoder' in window)) {
        setStatus(t('webCodecsUnavailable'), 'error');
    }

    renderMetadata(null);
    renderDetection(null);
    updateCompareMode();
    setProgress(0, t('waitingVideo'));
    setupEvents();
    updateButtons();
    await consumePendingVideoHandoff();
}

init();

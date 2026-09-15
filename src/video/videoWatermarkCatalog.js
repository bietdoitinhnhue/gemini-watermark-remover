const REFERENCE_WIDTH = 1920;
const REFERENCE_HEIGHT = 1080;
const PORTRAIT_REFERENCE_WIDTH = 1080;
const PORTRAIT_REFERENCE_HEIGHT = 1920;

const REFERENCE_CANDIDATES = [
    {
        id: 'veo-1080p-standard',
        label: '1080p standard, 72px, margin 108',
        size: 72,
        marginRight: 108,
        marginBottom: 108
    },
    {
        id: 'veo-1080p-inset',
        label: '1080p inset, 72px, margin 144',
        size: 72,
        marginRight: 144,
        marginBottom: 144
    }
];

// Portrait Gemini/Veo exports use the 1080px short edge as their sizing
// reference.  Scaling these anchors from a 16:9 frame makes the ROI too small
// on 9:16 videos (for example, 1440x2560 incorrectly became a 54px ROI).
const PORTRAIT_REFERENCE_CANDIDATES = [
    {
        id: 'veo-portrait-standard',
        label: 'portrait standard, 72px, margin 108',
        size: 72,
        marginRight: 108,
        marginBottom: 108,
        sourcePriority: 0
    },
    {
        id: 'veo-portrait-relocated',
        label: 'portrait relocated, 72px, margin 144',
        size: 72,
        marginRight: 144,
        marginBottom: 144,
        sourcePriority: 1
    },
    {
        id: 'veo-portrait-animated-compact',
        label: 'portrait animated compact, 36px, margin 72',
        size: 36,
        marginRight: 72,
        marginBottom: 72,
        sourcePriority: 2
    },
    {
        id: 'veo-portrait-vertical-inset',
        label: 'portrait vertical inset, 52.5px, margin 153/144',
        size: 52.5,
        marginRight: 153,
        marginBottom: 144,
        sourcePriority: 3
    },
    {
        id: 'veo-portrait-compact',
        label: 'portrait compact, 66px, margin 43.5/60',
        size: 66,
        marginRight: 43.5,
        marginBottom: 60,
        sourcePriority: 4
    }
];

const EXACT_PROJECTED_CANDIDATE_OVERRIDES_BY_SIZE = Object.freeze({
    '1280x720': Object.freeze({
        'veo-1080p-inset': Object.freeze({
            id: 'veo-720p-3-inset',
            label: '720p-3 inset, 48px, margin 96',
            sourcePriority: 0,
            exactSizeVariant: true
        }),
        'veo-1080p-standard': Object.freeze({
            id: 'veo-720p-1-standard',
            label: '720p-1 standard, 48px, margin 72',
            sourcePriority: 1,
            exactSizeVariant: true
        })
    })
});

const clampInteger = (value, min, max) => Math.max(min, Math.min(max, Math.round(value)));

export function isReferenceGeminiVideoSize(width, height) {
    return width === REFERENCE_WIDTH && height === REFERENCE_HEIGHT;
}

export function resolveVideoWatermarkCandidates(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return [];
    }

    return dedupeVideoCandidates([
        ...getProjectedReferenceCandidates(width, height),
        ...getExplicitCandidates(width, height)
    ]);
}

export function getReferenceVideoWatermarkCatalog() {
    return {
        referenceSize: {
            width: REFERENCE_WIDTH,
            height: REFERENCE_HEIGHT
        },
        candidates: REFERENCE_CANDIDATES.map((candidate) => ({ ...candidate }))
    };
}

function buildCandidate(candidate, width, height, scale = 1, extras = {}) {
    const size = clampInteger(candidate.size * scale, 24, Math.min(width, height));
    const marginRight = clampInteger(candidate.marginRight * scale, 0, width - size);
    const marginBottom = clampInteger(candidate.marginBottom * scale, 0, height - size);
    return {
        ...candidate,
        size,
        width: size,
        height: size,
        marginRight,
        marginBottom,
        x: width - marginRight - size,
        y: height - marginBottom - size,
        sourcePriority: candidate.sourcePriority ?? extras.sourcePriority ?? 100,
        ...extras
    };
}

function isCandidateInBounds(candidate) {
    return (
        candidate.x >= 0 &&
        candidate.y >= 0 &&
        candidate.x + candidate.size <= candidate.videoWidth &&
        candidate.y + candidate.size <= candidate.videoHeight
    );
}

function withVideoBounds(candidate, width, height) {
    return {
        ...candidate,
        videoWidth: width,
        videoHeight: height
    };
}

function videoSizeKey(width, height) {
    return `${width}x${height}`;
}

function getProjectedReferenceCandidates(width, height) {
    const portrait = height > width;
    const hasExplicitPortraitCandidates = portrait && (
        (width === PORTRAIT_REFERENCE_WIDTH && height === PORTRAIT_REFERENCE_HEIGHT) ||
        (width === 720 && height === 1280)
    );
    if (hasExplicitPortraitCandidates) return [];

    const referenceWidth = portrait ? PORTRAIT_REFERENCE_WIDTH : REFERENCE_WIDTH;
    const referenceHeight = portrait ? PORTRAIT_REFERENCE_HEIGHT : REFERENCE_HEIGHT;
    const sourceCandidates = portrait ? PORTRAIT_REFERENCE_CANDIDATES : REFERENCE_CANDIDATES;
    const scale = Math.min(width / referenceWidth, height / referenceHeight);
    const referenceSize = !portrait && isReferenceGeminiVideoSize(width, height);
    const overrides = portrait
        ? {}
        : (EXACT_PROJECTED_CANDIDATE_OVERRIDES_BY_SIZE[videoSizeKey(width, height)] || {});

    return sourceCandidates
        .map((candidate, index) => {
            const override = overrides[candidate.id] || {};
            return withVideoBounds(buildCandidate(candidate, width, height, scale, {
                referenceSize,
                scaledFromReference: !referenceSize,
                sourceCandidateId: candidate.id,
                sourceResolution: `${referenceWidth}x${referenceHeight}`,
                sourceScale: scale,
                sourceFamily: portrait
                    ? 'portrait-projected'
                    : (referenceSize ? 'reference-exact' : 'reference-projected'),
                evidenceGate: 'standard',
                sourcePriority: override.sourcePriority ?? candidate.sourcePriority ?? index,
                ...override
            }), width, height);
        })
        .filter(isCandidateInBounds);
}

function buildCandidateGeometryKey(candidate) {
    return `${candidate.size}:${candidate.marginRight}:${candidate.marginBottom}`;
}

function getCandidatePriority(candidate) {
    return Number.isFinite(candidate?.sourcePriority) ? candidate.sourcePriority : 100;
}

function dedupeVideoCandidates(candidates) {
    const bestByGeometry = new Map();
    for (const candidate of candidates.filter(isCandidateInBounds)) {
        const key = buildCandidateGeometryKey(candidate);
        const existing = bestByGeometry.get(key);
        if (!existing || getCandidatePriority(candidate) < getCandidatePriority(existing)) {
            bestByGeometry.set(key, candidate);
        }
    }
    return [...bestByGeometry.values()].sort((left, right) => {
        const priorityDelta = getCandidatePriority(left) - getCandidatePriority(right);
        if (priorityDelta !== 0) return priorityDelta;
        return 0;
    });
}

function getExplicitCandidates(width, height) {
    if (width === 1080 && height === 1920) {
        return [
            {
                id: 'veo-1080x1920-portrait-72',
                label: '1080x1920 portrait, 72px, margin 108',
                size: 72,
                marginRight: 108,
                marginBottom: 108,
                sourcePriority: 0
            },
            {
                id: 'veo-1080x1920-portrait-relocated-72',
                label: '1080x1920 portrait relocated, 72px, margin 144',
                size: 72,
                marginRight: 144,
                marginBottom: 144,
                sourcePriority: 1
            }
        ].map((candidate) => withVideoBounds(buildCandidate(candidate, width, height, 1, {
            referenceSize: false,
            scaledFromReference: false,
            sourceCandidateId: null,
            sourceFamily: 'binary-prior',
            evidenceGate: 'required',
            exactSizeVariant: true
        }), width, height)).filter(isCandidateInBounds);
    }

    if (width === 1280 && height === 720) {
        return [
            {
                id: 'veo-720p-2-compact',
                label: '720p-2 compact, 44px, margin 29/40',
                size: 44,
                marginRight: 29,
                marginBottom: 40,
                sourcePriority: 2
            }
        ].map((candidate) => withVideoBounds(buildCandidate(candidate, width, height, 1, {
            referenceSize: false,
            scaledFromReference: false,
            sourceCandidateId: null,
            sourceFamily: 'exact-size-exception',
            evidenceGate: 'required',
            exactSizeVariant: true
        }), width, height)).filter(isCandidateInBounds);
    }

    if (width === 720 && height === 1280) {
        return [
            {
                id: 'veo-720x1280-portrait-48',
                label: '720x1280 portrait, 48px, margin 72',
                size: 48,
                marginRight: 72,
                marginBottom: 72,
                sourcePriority: 1,
                sourceFamily: 'binary-prior'
            },
            {
                id: 'veo-720x1280-portrait-relocated-48',
                label: '720x1280 portrait relocated, 48px, margin 96',
                size: 48,
                marginRight: 96,
                marginBottom: 96,
                sourcePriority: 0
            },
            {
                id: 'veo-720x1280-animated-compact-24',
                label: '720x1280 animated compact, 24px, margin 48',
                size: 24,
                marginRight: 48,
                marginBottom: 48,
                sourcePriority: 0
            },
            {
                id: 'veo-720x1280-vertical-inset',
                label: '720x1280 vertical inset, 35px, margin 102/96',
                size: 35,
                marginRight: 102,
                marginBottom: 96,
                sourcePriority: 1
            },
            {
                id: 'veo-720x1280-compact-44',
                label: '720x1280 compact, 44px, margin 29/40',
                size: 44,
                marginRight: 29,
                marginBottom: 40,
                sourcePriority: 3,
                sourceFamily: 'binary-prior'
            }
        ].map((candidate) => withVideoBounds(buildCandidate(candidate, width, height, 1, {
            referenceSize: false,
            scaledFromReference: false,
            sourceCandidateId: null,
            sourceFamily: candidate.sourceFamily || 'exact-size-exception',
            evidenceGate: 'required',
            exactSizeVariant: true
        }), width, height)).filter(isCandidateInBounds);
    }

    return [];
}

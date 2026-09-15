import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderVideoUiPresetExportMarkdown } from '../../scripts/export-video-ui-preset.js';

test('renderVideoUiPresetExportMarkdown records the real UI preset path', () => {
  const markdown = renderVideoUiPresetExportMarkdown({
    generatedAt: '2026-06-11T00:00:00.000Z',
    pagePath: 'D:\\Project\\gemini-watermark-remover\\dist\\video-remover.html',
    inputPath: 'D:\\sample.mp4',
    outputPath: 'D:\\out.mp4',
    bytes: 1234,
    presetButtonSelector: '#relocatedReviewPresetBtn',
    presetState: {
      denoiseBackend: 'canvas-temporal-match-delta-stabilize',
      edgeDenoiseStrength: 0.25,
      videoBitrateMbps: 12,
      allowLowConfidence: true
    },
    resultState: {
      statusTone: 'success',
      statusText: '导出完成'
    },
    screenshots: {
      before: 'before.png',
      after: 'after.png'
    }
  });

  assert.match(markdown, /#relocatedReviewPresetBtn/);
  assert.match(markdown, /canvas-temporal-match-delta-stabilize/);
  assert.match(markdown, /edgeDenoiseStrength: 0\.25/);
  assert.match(markdown, /videoBitrateMbps: 12/);
  assert.match(markdown, /allowLowConfidence: true/);
});

test('export-video-ui-preset source clicks the relocated review preset button', () => {
  const source = readFileSync(new URL('../../scripts/export-video-ui-preset.js', import.meta.url), 'utf8');

  assert.match(source, /PRESET_BUTTON_SELECTOR = '#relocatedReviewPresetBtn'/);
  assert.match(source, /withLocalStaticPreviewPage/);
  assert.match(source, /clickPresetButton/);
  assert.match(source, /document\.querySelector\(selector\)\?\.click\(\)/);
  assert.match(source, /locator\('#processBtn'\)\.click\(\)/);
});

test('video preview comparison panes should show the full frame without cropping', () => {
  const css = readFileSync(new URL('../../public/video-remover.css', import.meta.url), 'utf8');
  const videoRule = css.match(/\.compare-pane video\s*\{[^}]+\}/)?.[0] ?? '';

  assert.match(videoRule, /width:\s*100%;/);
  assert.match(videoRule, /height:\s*100%;/);
  assert.match(videoRule, /object-fit:\s*contain;/);
    assert.doesNotMatch(videoRule, /object-fit:\s*cover;/);
});

test('video preview should switch to portrait comparison geometry for 9:16 files', () => {
  const css = readFileSync(new URL('../../public/video-remover.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../../src/video-app.js', import.meta.url), 'utf8');
  const portraitRule = css.match(/\.compare-player\[data-orientation="portrait"\]\s*\{[^}]+\}/)?.[0] ?? '';

  assert.match(portraitRule, /width:\s*min\(100%,\s*760px\);/);
  assert.match(portraitRule, /min-height:\s*0;/);
  assert.match(portraitRule, /aspect-ratio:\s*9\s*\/\s*8;/);
  assert.match(source, /function updateComparisonOrientation/);
  assert.match(source, /dataset\.orientation = 'portrait'/);
});

test('video preview detection should yield to the browser while reporting progress', () => {
  const source = readFileSync(new URL('../../src/video-app.js', import.meta.url), 'utf8');

  assert.match(source, /function yieldToBrowserFrame\(\)/);
  assert.match(source, /function createDetectionProgressHandler/);
  assert.match(source, /yieldToMainThread:\s*yieldToBrowserFrame/);
  assert.match(source, /onProgress:\s*createDetectionProgressHandler/);
});

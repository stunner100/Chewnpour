import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dashboardAnalysisPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const source = await fs.readFile(dashboardAnalysisPath, 'utf8');

if (!/const\s+isIgnorableProcessingDispatchError\s*=\s*\(error\)\s*=>/.test(source)) {
  throw new Error('Expected DashboardAnalysis to define isIgnorableProcessingDispatchError().');
}

if (!/connection lost while action was in flight/.test(source)) {
  throw new Error('Expected DashboardAnalysis to classify in-flight connection loss errors.');
}

if (!/if\s*\(isIgnorableProcessingDispatchError\(err\)\)\s*\{[\s\S]*reportUploadWarning\(/s.test(source)) {
  throw new Error('Expected DashboardAnalysis to downgrade transient dispatch failures to reportUploadWarning().');
}

if (!/reportUploadFlowFailed\(uploadObservation,\s*err,\s*\{[\s\S]*stage:\s*'background_ai_processing'/s.test(source)) {
  throw new Error('Expected DashboardAnalysis to keep reportUploadFlowFailed for non-ignorable dispatch failures.');
}

const dispatchStageIndex = source.indexOf("currentStage = 'dispatch_ai_processing'");
const navigateStageIndex = source.indexOf("currentStage = 'navigate_processing_page'");

if (dispatchStageIndex === -1 || navigateStageIndex === -1) {
  throw new Error('Expected DashboardAnalysis upload flow to include dispatch and navigation stages.');
}

if (dispatchStageIndex > navigateStageIndex) {
  throw new Error('Expected DashboardAnalysis to dispatch AI processing before navigating to processing route.');
}

if (/currentStage\s*=\s*'extract_pdf_text_preview'/.test(source)) {
  throw new Error('Expected DashboardAnalysis not to block kickoff behind client PDF extraction.');
}

console.log('upload-dispatch-resilience-regression.test.mjs passed');

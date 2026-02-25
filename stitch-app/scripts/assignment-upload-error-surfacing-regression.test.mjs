import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');

if (!/const\s+normalizeAssignmentProcessingErrorMessage\s*=\s*\(error:\s*unknown\)\s*=>/.test(aiSource)) {
  throw new Error('Expected convex/ai.ts to normalize assignment processing errors.');
}

if (!/const\s+failThread\s*=\s*async\s*\(message:\s*string\)\s*:\s*Promise<never>\s*=>/.test(aiSource)) {
  throw new Error('Expected processAssignmentThread failThread helper to return Promise<never>.');
}

if (!/throw new ConvexError\(message\);/.test(aiSource)) {
  throw new Error('Expected processAssignmentThread to throw ConvexError for client-visible failures.');
}

if (!/if\s*\(error\s+instanceof\s+ConvexError\)\s*\{\s*throw error;\s*\}/s.test(aiSource)) {
  throw new Error('Expected processAssignmentThread to rethrow existing ConvexError values.');
}

if (!/ASSIGNMENT_AI_UNAVAILABLE_ERROR/.test(aiSource)) {
  throw new Error('Expected assignment processing to map upstream AI issues to a user-safe message.');
}

const helperSource = await fs.readFile(path.join(root, 'src', 'pages', 'AssignmentHelper.jsx'), 'utf8');

if (!/const\s+resolveConvexActionError\s*=\s*\(error,\s*fallbackMessage\)\s*=>/.test(helperSource)) {
  throw new Error('Expected AssignmentHelper to include a Convex action error unwrapping helper.');
}

if (!/setError\(resolveConvexActionError\(uploadError,\s*'Could not process assignment\. Please try again\.'\)\);/.test(helperSource)) {
  throw new Error('Expected AssignmentHelper upload failures to use resolveConvexActionError.');
}

if (!/const\s+isAssignmentExtractionInsufficientError\s*=\s*\(error\)\s*=>/.test(helperSource)) {
  throw new Error('Expected AssignmentHelper to detect insufficient text extraction upload errors.');
}

if (!/reportUploadWarning\(\s*uploadObservation,\s*currentStage,\s*'Assignment processing could not extract enough text from the uploaded file\.'/s.test(helperSource)) {
  throw new Error('Expected AssignmentHelper to report insufficient text extraction as upload warning instead of failure.');
}

if (!/setError\(buildAssignmentExtractionGuidance\(uploadError\)\);/.test(helperSource)) {
  throw new Error('Expected AssignmentHelper to show clearer guidance for insufficient text extraction errors.');
}

console.log('assignment-upload-error-surfacing-regression.test.mjs passed');

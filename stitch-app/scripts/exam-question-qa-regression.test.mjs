import assert from 'node:assert/strict';

import { getAssessmentQuestionMetadataIssues } from '../convex/lib/assessmentBlueprint.js';
import { isUsableExamQuestion } from '../convex/lib/examSecurity.js';

const blueprint = {
  version: 'assessment-blueprint-v3',
  outcomes: [
    {
      key: 'outcome-1',
      objective: 'Interpret a fraction as representing part of a whole in a simple visual or numerical situation.',
      bloomLevel: 'Understand',
      evidenceFocus: 'A fraction represents part of a whole.',
      cognitiveTask: 'interpret',
      difficultyBand: 'easy',
      scenarioFrame: 'A student shades part of a shape and decides whether it is correctly described by a fraction.',
    },
    {
      key: 'outcome-2',
      objective: 'Apply the idea of numerator and denominator to identify whether a fraction is being used correctly in a worked example.',
      bloomLevel: 'Apply',
      evidenceFocus: 'numerator and denominator',
      cognitiveTask: 'apply',
      difficultyBand: 'medium',
      scenarioFrame: 'A learner checks whether the top and bottom numbers are labeled and used appropriately.',
    },
    {
      key: 'outcome-4',
      objective: 'Diagnose whether a fraction addition solution is correct by checking the denominator rule in a worked problem.',
      bloomLevel: 'Analyze',
      evidenceFocus: 'adding fractions with same denominator; common mistake: adding denominators directly',
      cognitiveTask: 'diagnose',
      difficultyBand: 'hard',
      scenarioFrame: 'A student solves 1/4 + 2/4 and must identify whether the method used matches the denominator rule.',
    },
  ],
  trueFalsePlan: {
    allowedBloomLevels: ['Remember', 'Understand', 'Apply'],
    targetBloomLevels: ['Apply'],
    targetOutcomeKeys: ['outcome-1', 'outcome-2'],
  },
  multipleChoicePlan: {
    allowedBloomLevels: ['Remember', 'Understand', 'Apply', 'Analyze'],
    targetBloomLevels: ['Apply', 'Analyze'],
    targetOutcomeKeys: ['outcome-1', 'outcome-2', 'outcome-4'],
  },
};

const malformedQuestion = {
  questionText: 'In the example \u0000bd + \u0000bc = \u0000be, the denominator stays the same when adding fractions with the same denominator.',
  questionType: 'true_false',
  options: [
    { label: 'A', text: 'True' },
    { label: 'B', text: 'False' },
  ],
  qualityFlags: ['malformed_text'],
  qualityTier: 'premium',
  rigorScore: 0.83,
  qualityScore: 0.84,
};

assert.equal(
  isUsableExamQuestion(malformedQuestion),
  false,
  'Malformed encoded question text should never be treated as usable.'
);

const lowRigorQuestion = {
  questionText: 'A student shades a shape. Which interpretation best matches the passage?',
  questionType: 'multiple_choice',
  options: [
    { label: 'A', text: 'A fraction shows the total number of equal parts in the whole' },
    { label: 'B', text: 'A fraction represents part of a whole' },
    { label: 'C', text: 'A fraction is used only when adding two numbers' },
    { label: 'D', text: 'A fraction means the denominators should be added directly' },
  ],
  qualityFlags: ['low_rigor'],
  qualityTier: 'limited',
  rigorScore: 0.23,
  qualityScore: 0.63,
};

assert.equal(
  isUsableExamQuestion(lowRigorQuestion),
  false,
  'Low-rigor limited objective questions should not enter the usable exam bank.'
);

const misalignedQuestion = {
  questionText: 'A student solves 1/4 + 2/4 = 3/4 and claims the denominator stays the same when fractions share a denominator.',
  questionType: 'true_false',
  options: [
    { label: 'A', text: 'True' },
    { label: 'B', text: 'False' },
  ],
  bloomLevel: 'Apply',
  outcomeKey: 'outcome-2',
};

const metadataIssues = getAssessmentQuestionMetadataIssues({
  question: misalignedQuestion,
  blueprint,
  questionType: 'true_false',
});

assert.ok(
  metadataIssues.includes('outcomeKey weakly aligned to question')
    || metadataIssues.some((issue) => issue.startsWith('question aligns better to ')),
  'A question about denominator-rule diagnosis should not validate against the numerator/denominator outcome.'
);

console.log('exam-question-qa-regression tests passed');

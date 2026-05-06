import { weights } from "../config/weights.config.js";

const STOP_WORDS = new Set([
  "the",
  "and",
  "or",
  "with",
  "for",
  "in",
  "on",
  "at",
  "a",
  "an",
  "to",
  "of",
  "is",
  "are",
  "be",
  "this",
  "that",
  "by",
  "from",
  "as",
  "it",
  "will",
  "using",
  "required",
  "preferred",
  "experience",
  "looking",
  "need",
  "needs",
  "seeking",
  "seek",
  "seeks",
  "wanted",
  "want",
  "wants",
  "hiring",
  "hire",
  "hires",
]);

const normalizeText = (text = "") =>
  `${text}`
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Prefer the casing/spelling as it appears in the job description.
 */
const keywordDisplayFromJobDescription = (jobDescriptionOriginal, keywordLower) => {
  const lower = jobDescriptionOriginal.toLowerCase();
  const idx = lower.indexOf(keywordLower);
  if (idx === -1) {
    return keywordLower.charAt(0).toUpperCase() + keywordLower.slice(1);
  }
  return jobDescriptionOriginal.slice(idx, idx + keywordLower.length);
};

const stripEdgeNonWordChars = (word) => word.replace(/^[^a-z0-9#]+|[^a-z0-9]+$/g, "");

const extractKeywords = (text = "") => {
  const normalizedText = normalizeText(text);

  return [
    ...new Set(
      normalizedText
        .split(" ")
        .map((word) => stripEdgeNonWordChars(word.trim()))
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
    ),
  ];
};

export const keywordEvaluator = ({ resumeText = "", jobDescription = "" }) => {
  const normalizedResume = normalizeText(resumeText);
  const jdKeywords = extractKeywords(jobDescription);

  if (jdKeywords.length === 0) {
    return {
      score: 0,
      weight: weights.keyword ?? 0.10,
      feedback: ["No extractable keywords found in the job description"],
      matchedKeywords: [],
      missingKeywords: [],
    };
  }

  const matchedKeywords = [];
  const missingKeywords = [];

  jdKeywords.forEach((keyword) => {
    const display = keywordDisplayFromJobDescription(jobDescription, keyword);
    if (normalizedResume.includes(keyword)) {
      matchedKeywords.push(display);
    } else {
      missingKeywords.push(display);
    }
  });

  const totalKeywords = jdKeywords.length;
  const score = Number(
    Math.min((matchedKeywords.length / totalKeywords) * 100, 100).toFixed(2),
  );

  const feedback = [];
  if (score >= 80) {
    feedback.push("Resume contains most important job description keywords");
  } else if (score >= 50) {
    feedback.push("Resume contains some important keywords but can be improved");
  } else {
    feedback.push("Resume is missing many important job description keywords");
  }

  missingKeywords.forEach((keyword) => {
    feedback.push(`Missing keyword: ${keyword}`);
  });

  return {
    score,
    weight: weights.keyword ?? 0.10,
    feedback,
    matchedKeywords,
    missingKeywords,
  };
};

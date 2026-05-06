import { weights } from "../config/weights.config.js";

const roundToTwo = (value) => Number(value.toFixed(2));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const extractExperienceInYears = (text = "") => {
  const content = `${text}`.toLowerCase();
  if (!content.trim()) return 0;

  const detectedValues = [];
  const combinedMatchedIndices = [];

  // Examples: "1 year 6 months", "2 years and 3 months", "1.5 years 6 months"
  const combinedPattern =
    /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*\+?\s*(?:months?|mos?)/gi;
  for (const match of content.matchAll(combinedPattern)) {
    const years = toNumber(match[1]);
    const months = toNumber(match[2]);
    detectedValues.push(years + months / 12);
    
    combinedMatchedIndices.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }

  const isOverlapping = (index) => {
    return combinedMatchedIndices.some(
      (range) => index >= range.start && index < range.end
    );
  };

  // Examples: "3 years", "2+ years", "1 yr"
  const yearsPattern = /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/gi;
  for (const match of content.matchAll(yearsPattern)) {
    if (isOverlapping(match.index)) continue;
    detectedValues.push(toNumber(match[1]));
  }

  // Examples: "18 months", "6+ months", "10 mo"
  const monthsPattern = /(\d+(?:\.\d+)?)\s*\+?\s*(?:months?|mos?)/gi;
  for (const match of content.matchAll(monthsPattern)) {
    if (isOverlapping(match.index)) continue;
    detectedValues.push(toNumber(match[1]) / 12);
  }

  if (detectedValues.length === 0) return 0;
  return roundToTwo(Math.max(...detectedValues));
};

export const experienceEvaluator = ({
  candidateExperienceText = "",
  jobDescription = "",
  weight = weights.experience ?? 0.20,
} = {}) => {
  const candidateExperience = extractExperienceInYears(candidateExperienceText);
  const requiredExperience = extractExperienceInYears(jobDescription);

  if (!requiredExperience) {
    return {
      score: 0,
      weight,
      feedback: ["Could not detect required experience from the job description"],
      candidateExperience,
      requiredExperience: 0,
      experienceGap: 0,
    };
  }

  const gap = Math.max(requiredExperience - candidateExperience, 0);
  const rawScore =
    candidateExperience >= requiredExperience
      ? 100
      : (candidateExperience / requiredExperience) * 100;
  const score = roundToTwo(Math.min(rawScore, 100));
  const experienceGap = roundToTwo(gap);

  let feedback = [];
  if (candidateExperience >= requiredExperience) {
    feedback = [
      "Candidate experience meets or exceeds job requirements",
      `Required experience: ${requiredExperience} years`,
      `Candidate experience: ${candidateExperience} years`,
    ];
  } else if (score < 40) {
    feedback = [
      "Candidate experience is significantly below job requirements",
      `Required experience: ${requiredExperience} years`,
      `Candidate experience: ${candidateExperience} years`,
      `Experience gap: ${experienceGap} years`,
    ];
  } else {
    feedback = [
      "Candidate experience partially matches job requirements",
      `Required experience: ${requiredExperience} years`,
      `Candidate experience: ${candidateExperience} years`,
      `Experience gap: ${experienceGap} years`,
    ];
  }

  return {
    score,
    weight,
    feedback,
    candidateExperience,
    requiredExperience,
    experienceGap,
  };
};

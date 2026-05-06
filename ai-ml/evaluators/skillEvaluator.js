import { weights } from "../config/weights.config.js";

export const skillEvaluator = ({ resumeSkills = [], jobSkills = [] }) => {
  if (jobSkills.length === 0) {
    return {
      score: 0,
      weight: weights.skill ?? 0.50,
      feedback: ["No job skills provided for comparison"],
      matchedSkills: [],
      missingSkills: [],
      extraSkills: resumeSkills,
    };
  }

  // Normalize: lowercase, trim, unique
  const normalize = (skills) => 
    [...new Set(skills.map(s => s.toLowerCase().trim()).filter(Boolean))];

  const normResume = normalize(resumeSkills);
  const normJob = normalize(jobSkills);

  // Matched: intersection
  const matched = normJob.filter(s => normResume.includes(s));

  // Missing from job
  const missing = normJob.filter(s => !normResume.includes(s));

  // Extra in resume
  const extra = normResume.filter(s => !normJob.includes(s));

  // Score: (matched / job.length) * 100, adjusted
  const score = jobSkills.length > 0 ? Math.round((matched.length / normJob.length) * 100) : 0;

  // Feedback
  const feedback = [];
  if (matched.length > 0) feedback.push(`Great! ${matched.length}/${normJob.length} job skills match.`);
  if (missing.length > 0) feedback.push(`Add these job skills: ${missing.slice(0,3).join(', ')}${missing.length > 3 ? '...' : ''}`);
  if (extra.length > 0) feedback.push(`Consider prioritizing job-relevant skills over extras.`);

  return {
    score,
    weight: weights.skill ?? 0.50,
    feedback,
    matchedSkills: matched,
    missingSkills: missing,
    extraSkills: extra,
  };
};


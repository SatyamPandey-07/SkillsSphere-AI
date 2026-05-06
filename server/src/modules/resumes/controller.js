import path from "path";
import { parseResume } from "../../utils/parseResume.js";
import Resume from "../../database/models/Resume.js";
import asyncHandler from "../../utils/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import {
  experienceMatchEvaluator,
  keywordMatchEvaluator,
  skillMatchEvaluator,
  semanticMatchEvaluator,
} from "./evaluatorAdapters.js";
import { runPipeline } from "../../../../ai-ml/pipeline/runPipeline.js";

const defaultDependencies = {
  parseResume,
  createResume: (payload) => Resume.create(payload),
};

let controllerDependencies = { ...defaultDependencies };

export const setResumeControllerDependencies = (overrides = {}) => {
  controllerDependencies = {
    ...defaultDependencies,
    ...overrides,
  };
};

export const resetResumeControllerDependencies = () => {
  controllerDependencies = { ...defaultDependencies };
};

const parseSkillArrayString = (input) => {
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return null;

    return {
      skills: parsed.map((skill) => `${skill}`.trim()).filter(Boolean),
      invalidJson: false,
    };
  } catch {
    return null;
  }
};

const normalizeSkillInput = (skillsInput) => {
  if (!skillsInput) return { skills: [], invalidJson: false };

  if (Array.isArray(skillsInput)) {
    return {
      skills: skillsInput
        .flatMap((skill) => (typeof skill === "string" ? skill.split(",") : []))
        .map((skill) => skill.trim())
        .filter(Boolean),
      invalidJson: false,
    };
  }

  if (typeof skillsInput === "string") {
    const trimmedInput = skillsInput.trim();
    if (!trimmedInput) return { skills: [], invalidJson: false };

    const parsedArray = parseSkillArrayString(trimmedInput);
    if (parsedArray) return parsedArray;

    return {
      skills: trimmedInput.split(",").map((skill) => skill.trim()).filter(Boolean),
      invalidJson: trimmedInput.startsWith("["),
    };
  }

  return { skills: [], invalidJson: false };
};

const toLegacySkillMatch = (pipelineResult) => {
  const result = pipelineResult.breakdown.skillMatch;
  if (!result) return {};

  return {
    score: result.score,
    weight: result.weight,
    feedback: result.details.feedback || [],
    matchedSkills: result.details.matchedSkills || [],
    missingSkills: result.details.missingSkills || [],
    extraSkills: result.details.extraSkills || [],
  };
};

const toLegacyKeywordMatch = (pipelineResult) => {
  const result = pipelineResult.breakdown.keywordMatch;
  if (!result) return {};

  return {
    score: result.score,
    weight: result.weight,
    feedback: result.details.feedback || [],
    matchedKeywords: result.details.matchedKeywords || [],
    missingKeywords: result.details.missingKeywords || [],
  };
};

const toLegacyExperienceMatch = (pipelineResult) => {
  const result = pipelineResult.breakdown.experienceMatch;
  if (!result) return {};

  return {
    score: result.score,
    weight: result.weight,
    feedback: result.details.feedback || [],
    candidateExperience: result.details.candidateExperience,
    requiredExperience: result.details.requiredExperience,
    experienceGap: result.details.experienceGap,
  };
};

const toLegacySemanticMatch = (pipelineResult) => {
  const result = pipelineResult.breakdown.semanticMatch;
  if (!result) return {};

  return {
    score: result.score,
    weight: result.weight,
    feedback: result.summary ? [result.summary] : [],
  };
};

export const uploadResume = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No file uploaded", 400));
  }

  res.status(200).json({
    success: true,
    message: "Resume uploaded successfully",
    file: {
      originalName: req.file.originalname,
      storedName: req.file.filename,
      path: `/uploads/${req.file.filename}`,
      size: `${(req.file.size / 1024).toFixed(2)} KB`,
      mimeType: req.file.mimetype,
    },
  });
});

export const analyzeResume = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No resume file uploaded. Use form-data key `resume`.", 400));
  }

  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  if (fileExtension !== ".pdf") {
    return next(new AppError("Only PDF files are supported for resume analysis right now", 400));
  }

  const parsedData = await controllerDependencies.parseResume(req.file.path).catch((err) => {
    throw new AppError(err.message || "Unable to extract text from resume", 400);
  });

  const { skills: jobSkills, invalidJson } = normalizeSkillInput(req.body?.jobSkills);
  const jobDescription = typeof req.body?.jobDescription === "string" ? req.body.jobDescription : "";
  const trimmedJobDescription = jobDescription.trim();

  const candidateExperienceText =
    Array.isArray(parsedData.experience) && parsedData.experience.length > 0
      ? parsedData.experience.join(" ")
      : parsedData.resumeText || "";

  const evaluators = [];
  if (parsedData.skills?.length && jobSkills.length) {
    evaluators.push(skillMatchEvaluator);
  }
  if (trimmedJobDescription && parsedData.resumeText) {
    evaluators.push(keywordMatchEvaluator);
    evaluators.push(semanticMatchEvaluator);
  }
  evaluators.push(experienceMatchEvaluator);

  const pipelineResult = await runPipeline({
    evaluators,
    context: {
      parsedResume: parsedData,
      resumeSkills: parsedData.skills || [],
      jobSkills,
      resumeText: parsedData.resumeText || "",
      jobDescription: trimmedJobDescription,
      candidateExperienceText,
    },
  });

  const skillMatch = toLegacySkillMatch(pipelineResult);
  const keywordMatch = toLegacyKeywordMatch(pipelineResult);
  const experienceMatch = toLegacyExperienceMatch(pipelineResult);
  const semanticMatch = toLegacySemanticMatch(pipelineResult);

  const fileData = {
    originalName: req.file.originalname,
    storedName: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    size: `${(req.file.size / 1024).toFixed(2)} KB`,
    mimeType: req.file.mimetype,
  };

  const { resumeText, ...resumeFields } = parsedData;

  const savedResume = await controllerDependencies.createResume({
    ...resumeFields,
    jobSkills,
    jobDescription: trimmedJobDescription || null,
    skillMatch,
    keywordMatch,
    experienceMatch,
    semanticMatch,
    evaluatorBreakdown: pipelineResult.evaluators,
    aggregatedScore: pipelineResult.score,
    file: fileData,
  });

  const successParts = [];
  if (Object.keys(skillMatch).length > 0) successParts.push("skill match");
  if (Object.keys(keywordMatch).length > 0) successParts.push("keyword relevance");
  if (Object.keys(experienceMatch).length > 0) successParts.push("experience fit");
  if (Object.keys(semanticMatch).length > 0) successParts.push("semantic alignment");

  const evalSummary =
    successParts.length > 0
      ? `Resume parsed, ${successParts.join(" and ")} evaluated, and saved successfully`
      : "Resume parsed and saved successfully";

  res.status(200).json({
    success: true,
    message: invalidJson ? "Resume parsed and saved, but jobSkills JSON format is invalid" : evalSummary,
    resumeId: savedResume._id,
    data: resumeFields,
    skillMatch,
    keywordMatch,
    experienceMatch,
    semanticMatch,
    file: fileData,
    evaluatorBreakdown: pipelineResult.evaluators,
    overallScore: pipelineResult.score,
  });
});

export const getResumeResult = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const resume = await Resume.findById(id).lean();

  if (!resume) {
    return next(new AppError("Resume not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Resume fetched successfully",
    data: resume,
  });
});


/**
 * Evaluator weights configuration
 * All weights must sum to 1.0 for proper aggregation
 */

export const weights = {
  skill: 0.50,      // Skill match weight (reduced from 1.0 to accommodate semantic)
  keyword: 0.10,    // Keyword match weight (reduced from 0.2)
  experience: 0.20, // Experience match weight
  semantic: 0.20,   // Semantic match weight (as required by spec)
};

// Verify weights sum to 1.0
const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
if (Math.abs(totalWeight - 1.0) > 0.001) {
  console.warn(`Warning: Weights sum to ${totalWeight}, expected 1.0`);
}

export default weights;

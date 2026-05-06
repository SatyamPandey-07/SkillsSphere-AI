import { describe, it } from "node:test";
import assert from "node:assert";

// Import the semanticEvaluator module (without mocking)
const { semanticEvaluator } = await import("../semanticEvaluator.js");

await describe("semanticEvaluator", async () => {

  await it("returns 0 with safe message when resume text is missing", async () => {
    const result = await semanticEvaluator({
      resumeText: "",
      jobDescription: "test job description",
    });

    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.key, "semanticMatch");
    assert.strictEqual(result.label, "Semantic Match");
    assert.ok(result.feedback.toLowerCase().includes("missing"));
    assert.strictEqual(result.weight, 0.20);
  });

  await it("returns 0 with safe message when job description is missing", async () => {
    const result = await semanticEvaluator({
      resumeText: "test resume text",
      jobDescription: "",
    });

    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.key, "semanticMatch");
    assert.strictEqual(result.label, "Semantic Match");
    assert.ok(result.feedback.toLowerCase().includes("missing"));
    assert.strictEqual(result.weight, 0.20);
  });

  await it("propagates provider failure for pipeline safe handling (missing API key)", async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await assert.rejects(
        async () => {
          await semanticEvaluator({
            resumeText: "test resume with experience",
            jobDescription: "test job description",
          });
        },
        /OPENAI_API_KEY/
      );
    } finally {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });

  await it("has correct interface shape", async () => {
    // Verify the evaluator exports a function
    assert.strictEqual(typeof semanticEvaluator, "function");

    // Verify it accepts the required parameters
    const result = await semanticEvaluator({
      resumeText: "",
      jobDescription: "",
    });

    // Verify return shape even for empty inputs
    assert.strictEqual(typeof result, "object");
    assert.ok("key" in result);
    assert.ok("label" in result);
    assert.ok("score" in result);
    assert.ok("weight" in result);
    assert.ok("feedback" in result);
  });

  await it("uses correct weight from config", async () => {
    const result = await semanticEvaluator({
      resumeText: "",
      jobDescription: "",
    });

    // Weight should be exactly 0.20 from weights.config.js
    assert.strictEqual(result.weight, 0.20);
  });
});

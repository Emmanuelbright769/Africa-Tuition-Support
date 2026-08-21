import assert from "node:assert/strict";
import test from "node:test";
import {
  BACK_TO_SCHOOL_SPELLING_WORDS,
  selectSpellingQuestions,
  spellingQuestionFor,
} from "./backToSchoolSpellingBank";
import {
  BACK_TO_SCHOOL_TARGET_USD,
  calculateBackToSchoolDeposit,
  calculateBackToSchoolWithdrawal,
} from "./backToSchoolRules";

test("the Kiddies spelling bank remains large, unique, and word-only", () => {
  assert.ok(BACK_TO_SCHOOL_SPELLING_WORDS.length > 1_000);
  assert.equal(new Set(BACK_TO_SCHOOL_SPELLING_WORDS).size, BACK_TO_SCHOOL_SPELLING_WORDS.length);
  assert.ok(BACK_TO_SCHOOL_SPELLING_WORDS.every(word => /^[a-z]+$/.test(word)));
});

for (const level of ["junior", "senior"] as const) {
  test(`${level} spelling sessions contain 25 distinct answerable questions`, () => {
    const questions = selectSpellingQuestions(level, 25);
    assert.equal(questions.length, 25);
    assert.equal(new Set(questions.map(question => question.id)).size, 25);
    for (const question of questions) {
      assert.equal(question.choices.length, 4);
      assert.ok(question.answer >= 0 && question.answer < question.choices.length);
      assert.equal(spellingQuestionFor(question.id.slice("spell-".length)).id, question.id);
    }
  });
}

test("Kiddies fees preserve the stated guardian and child-wallet amounts", () => {
  assert.deepEqual(calculateBackToSchoolDeposit(10), { feeAmount: 0.5, totalDebited: 10.5 });
  assert.deepEqual(calculateBackToSchoolWithdrawal(10), { feeAmount: 0.75, netReceived: 9.25 });
  assert.equal(BACK_TO_SCHOOL_TARGET_USD, 30);
});
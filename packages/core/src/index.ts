export { htmlToText } from './html'
export { canonicalizeUrl } from './url'
export { jobContentHash, normalizeCompanyName, normalizeTitle } from './identity'
export { extractEvidence } from './evidence'
export { REGION_VOCABULARY, toRegions, type Region } from './regions'
export {
  classifyByRules,
  RULES_CLASSIFIER_VERSION,
  type ContractModel,
  type EligibilityInput,
  type RulesVerdict,
  type Verdict,
} from './eligibility'
export {
  buildUserPrompt,
  checkVerdict,
  llmVerdictSchema,
  LLM_CLASSIFIER_VERSION,
  SYSTEM_PROMPT,
  type CheckedVerdict,
  type LlmVerdict,
} from './eligibility-llm'

/**
 * Public engine interface.
 *
 * audit(student, program, courses, policyRules) => AuditResult
 * rankAddOns(student, currentPrograms, candidates, courses, policyRules, transferRules) => Opportunity[]
 * rankSwitches(student, currentMajor, targets, courses, policyRules, transferRules) => Opportunity[]
 * planTerms(student, programs, courses, policyRules, options?) => TermPlan
 *
 * No network and no model calls. Unconfirmed policy rules are returned as assumptions.
 */

export { audit } from "./audit";
export { planTerms, type PlanTermsOptions } from "./plan";
export { rankAddOns, rankSwitches } from "./rank";

import { z } from 'zod'
import { eligibilitySchema } from './eligibility'

export const jobSourceSchema = z.enum([
  'greenhouse',
  'lever',
  'ashby',
  'workable',
  'wwr',
  'remoteok',
  'himalayas',
  'remotive',
  'jobicy',
  'hn_whoishiring',
  'supportdriven',
  'dribbble',
  'other',
])
export type JobSource = z.infer<typeof jobSourceSchema>

export const JOB_SOURCE_LABELS: Record<JobSource, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workable: 'Workable',
  wwr: 'WWR',
  remoteok: 'RemoteOK',
  himalayas: 'Himalayas',
  remotive: 'Remotive',
  jobicy: 'Jobicy',
  hn_whoishiring: 'HN Who is hiring',
  supportdriven: 'SupportDriven',
  dribbble: 'Dribbble',
  other: 'Other',
}

export const compensationSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  currency: z.string().length(3).nullable(),
  period: z.enum(['year', 'month']).default('year'),
  /** Pre-rendered label; the source often gives a string we cannot parse. */
  label: z.string(),
})
export type Compensation = z.infer<typeof compensationSchema>

export const jobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  applyUrl: z.string().url(),
  jobFamily: z.string(),
  skills: z.array(z.string()),
  compensation: compensationSchema,
  postedAt: z.string().datetime(),
  source: jobSourceSchema,
  eligibility: eligibilitySchema,
})
export type Job = z.infer<typeof jobSchema>

export const jobInteractionSchema = z.enum(['saved', 'applied', 'dismissed'])
export type JobInteraction = z.infer<typeof jobInteractionSchema>

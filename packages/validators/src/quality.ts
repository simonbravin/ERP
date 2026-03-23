import { z } from 'zod'

export const createRfiSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  question: z.string().min(1, 'Question is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  wbsNodeId: z.string().uuid().optional().nullable(),
  assignedToOrgMemberId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
})

export const addRfiCommentSchema = z.object({
  comment: z.string().min(1, 'Comment is required'),
})

export const answerRfiSchema = z.object({
  answer: z.string().min(1, 'Answer is required'),
})

export const SUBMITTAL_TYPES = [
  'MATERIAL',
  'PRODUCT',
  'SHOP_DRAWING',
  'SAMPLES',
  'CUT_SHEETS',
  'OTHER',
] as const

export const createSubmittalSchema = z.object({
  submittalType: z.enum(SUBMITTAL_TYPES),
  specSection: z.string().max(50).optional().nullable(),
  wbsNodeId: z.string().uuid().optional().nullable(),
  submittedByPartyId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date(),
})

export const reviewSubmittalSchema = z.object({
  status: z.enum([
    'APPROVED',
    'APPROVED_AS_NOTED',
    'REJECTED',
    'REVISE_AND_RESUBMIT',
  ]),
  reviewComments: z.string().optional().nullable(),
})

export type CreateRfiInput = z.infer<typeof createRfiSchema>
export type AddRfiCommentInput = z.infer<typeof addRfiCommentSchema>
export type AnswerRfiInput = z.infer<typeof answerRfiSchema>
export type CreateSubmittalInput = z.infer<typeof createSubmittalSchema>
export type ReviewSubmittalInput = z.infer<typeof reviewSubmittalSchema>

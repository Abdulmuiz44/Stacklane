import { z } from 'zod'

export const projectStatuses = ['provisioning', 'ready', 'paused', 'error'] as const

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
})

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional()
})

export const createProjectSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  organizationId: z.string().trim().min(1),
  status: z.enum(projectStatuses).default('provisioning'),
  region: z.string().trim().min(2).default('af-west-1'),
  description: z.string().default('')
})

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    status: z.enum(projectStatuses).optional(),
    description: z.string().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.'
  })

export const createEnvironmentSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  status: z.string().trim().default('active'),
  region: z.string().trim().default('af-west-1'),
  deploymentTarget: z.string().trim().default('primary')
})

export const updateEnvironmentSchema = z
  .object({
    status: z.string().trim().optional(),
    region: z.string().trim().optional(),
    deploymentTarget: z.string().trim().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.'
  })

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2)
})

export const provisionProjectSchema = z.object({
  regionCode: z.string().trim().min(2).optional()
})

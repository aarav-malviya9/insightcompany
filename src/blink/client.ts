import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'company-insight-portal-xdoosm5q',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_DSUtQTGcr_sJKFsI5ifaD5d0AxZSCwfR',
  authRequired: false,
  auth: { mode: 'managed' },
})

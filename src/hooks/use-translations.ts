import { useTranslations } from 'next-intl'

export function useCommonTranslations() {
  return useTranslations('common')
}

export function useNavigationTranslations() {
  return useTranslations('navigation')
}

export function useAuthTranslations() {
  return useTranslations('auth')
}

export function useDashboardTranslations() {
  return useTranslations('dashboard')
}

export function useWorkflowTranslations() {
  return useTranslations('workflows')
}

export function useTemplateTranslations() {
  return useTranslations('templates')
}

export function useAnalyticsTranslations() {
  return useTranslations('analytics')
}

export function useSettingsTranslations() {
  return useTranslations('settings')
}

export function useBillingTranslations() {
  return useTranslations('billing')
}

export function usePlanTranslations() {
  return useTranslations('plans')
}

export function useErrorTranslations() {
  return useTranslations('errors')
}
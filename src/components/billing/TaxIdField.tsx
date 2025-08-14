'use client'

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getCountryConfig } from '@/lib/i18n/config'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TaxIdFieldProps {
  value?: string
  onChange?: (value: string, isValid: boolean) => void
  country?: string
  businessType?: 'B2C' | 'B2B'
  required?: boolean
  className?: string
}

interface TaxIdConfig {
  label: string
  placeholder: string
  pattern: string
  format: string
  description: string
  required: boolean
  example: string
}

const TAX_ID_CONFIGS: Record<string, TaxIdConfig> = {
  'MX': {
    label: 'RFC',
    placeholder: 'RFC123456789',
    pattern: '^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$',
    format: 'AAAA######AAA (RFC with homoclave)',
    description: 'Registro Federal de Contribuyentes - Tax identification number for Mexico',
    required: true,
    example: 'XAXX010101000'
  },
  'CO': {
    label: 'NIT',
    placeholder: '900123456-7',
    pattern: '^[0-9]{8,10}-[0-9]$',
    format: '########-# (NIT with check digit)',
    description: 'Número de Identificación Tributaria - Tax identification number for Colombia',
    required: true,
    example: '900123456-7'
  },
  'CL': {
    label: 'RUT',
    placeholder: '12345678-9',
    pattern: '^[0-9]{7,8}-[0-9K]$',
    format: '########-# (RUT with check digit)',
    description: 'Rol Único Tributario - Tax identification number for Chile',
    required: true,
    example: '12345678-9'
  },
  'PE': {
    label: 'RUC',
    placeholder: '20123456789',
    pattern: '^[0-9]{11}$',
    format: '########### (11 digits)',
    description: 'Registro Único de Contribuyentes - Tax identification number for Peru',
    required: true,
    example: '20123456789'
  },
  'AR': {
    label: 'CUIT',
    placeholder: '20-12345678-9',
    pattern: '^[0-9]{2}-[0-9]{8}-[0-9]$',
    format: '##-########-# (CUIT with dashes)',
    description: 'Clave Única de Identificación Tributaria - Tax identification number for Argentina',
    required: true,
    example: '20-12345678-9'
  },
  'DO': {
    label: 'RNC',
    placeholder: '123456789',
    pattern: '^[0-9]{9}$',
    format: '######### (9 digits)',
    description: 'Registro Nacional del Contribuyente - Tax identification number for Dominican Republic',
    required: false,
    example: '123456789'
  },
  'US': {
    label: 'EIN',
    placeholder: '12-3456789',
    pattern: '^[0-9]{2}-[0-9]{7}$',
    format: '##-####### (EIN format)',
    description: 'Employer Identification Number - Tax identification number for United States',
    required: false,
    example: '12-3456789'
  }
}

export function TaxIdField({
  value = '',
  onChange,
  country,
  businessType = 'B2C',
  required,
  className = ''
}: TaxIdFieldProps) {
  const locale = useLocale()
  const t = useTranslations()
  const [taxId, setTaxId] = useState(value)
  const [isValid, setIsValid] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  
  const countryConfig = getCountryConfig(locale)
  const targetCountry = country || countryConfig.country
  const taxConfig = TAX_ID_CONFIGS[targetCountry]
  
  // If no tax config for country, don't render
  if (!taxConfig) {
    return null
  }
  
  // Determine if field should be required
  const isRequired = required !== undefined 
    ? required 
    : (businessType === 'B2B' ? true : taxConfig.required)

  useEffect(() => {
    if (taxId) {
      const valid = validateTaxId(taxId, targetCountry)
      setIsValid(valid)
      onChange?.(taxId, valid)
    } else {
      setIsValid(!isRequired)
      onChange?.(taxId, !isRequired)
    }
  }, [taxId, targetCountry, isRequired, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase().trim()
    setTaxId(newValue)
    setShowValidation(true)
  }

  const handleBlur = () => {
    setShowValidation(true)
  }

  const formatTaxId = (input: string) => {
    // Auto-format based on country
    switch (targetCountry) {
      case 'CO':
        // Format NIT: add dash before last digit
        const cleanCO = input.replace(/[^0-9]/g, '')
        if (cleanCO.length >= 9) {
          return cleanCO.slice(0, -1) + '-' + cleanCO.slice(-1)
        }
        return cleanCO
        
      case 'CL':
        // Format RUT: add dash before last digit
        const cleanCL = input.replace(/[^0-9K]/g, '')
        if (cleanCL.length >= 2) {
          return cleanCL.slice(0, -1) + '-' + cleanCL.slice(-1)
        }
        return cleanCL
        
      case 'AR':
        // Format CUIT: ##-########-#
        const cleanAR = input.replace(/[^0-9]/g, '')
        if (cleanAR.length >= 11) {
          return cleanAR.slice(0, 2) + '-' + cleanAR.slice(2, 10) + '-' + cleanAR.slice(10)
        } else if (cleanAR.length >= 10) {
          return cleanAR.slice(0, 2) + '-' + cleanAR.slice(2)
        } else if (cleanAR.length >= 2) {
          return cleanAR.slice(0, 2) + '-' + cleanAR.slice(2)
        }
        return cleanAR
        
      case 'US':
        // Format EIN: ##-#######
        const cleanUS = input.replace(/[^0-9]/g, '')
        if (cleanUS.length >= 3) {
          return cleanUS.slice(0, 2) + '-' + cleanUS.slice(2)
        }
        return cleanUS
        
      default:
        return input
    }
  }

  const validateTaxId = (id: string, countryCode: string): boolean => {
    if (!id || !taxConfig) return false
    
    const pattern = new RegExp(taxConfig.pattern)
    if (!pattern.test(id)) return false
    
    // Additional country-specific validations
    switch (countryCode) {
      case 'CL':
        return validateRUT(id)
      case 'CO':
        return validateNIT(id)
      case 'AR':
        return validateCUIT(id)
      default:
        return true
    }
  }

  // Chile RUT validation with check digit
  const validateRUT = (rut: string): boolean => {
    const cleanRut = rut.replace(/[^0-9K]/g, '')
    if (cleanRut.length < 8) return false
    
    const rutDigits = cleanRut.slice(0, -1)
    const checkDigit = cleanRut.slice(-1)
    
    let sum = 0
    let multiplier = 2
    
    for (let i = rutDigits.length - 1; i >= 0; i--) {
      sum += parseInt(rutDigits[i]) * multiplier
      multiplier = multiplier === 7 ? 2 : multiplier + 1
    }
    
    const remainder = sum % 11
    const calculatedCheckDigit = remainder === 0 ? '0' : 
                                remainder === 1 ? 'K' : 
                                (11 - remainder).toString()
    
    return checkDigit === calculatedCheckDigit
  }

  // Colombia NIT validation
  const validateNIT = (nit: string): boolean => {
    const cleanNit = nit.replace(/[^0-9]/g, '')
    if (cleanNit.length < 9) return false
    
    const nitDigits = cleanNit.slice(0, -1)
    const checkDigit = parseInt(cleanNit.slice(-1))
    
    const weights = [41, 37, 29, 23, 19, 17, 13, 7, 3]
    let sum = 0
    
    for (let i = 0; i < nitDigits.length; i++) {
      sum += parseInt(nitDigits[i]) * weights[i]
    }
    
    const remainder = sum % 11
    const calculatedCheckDigit = remainder === 0 || remainder === 1 ? remainder : 11 - remainder
    
    return checkDigit === calculatedCheckDigit
  }

  // Argentina CUIT validation
  const validateCUIT = (cuit: string): boolean => {
    const cleanCuit = cuit.replace(/[^0-9]/g, '')
    if (cleanCuit.length !== 11) return false
    
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    let sum = 0
    
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCuit[i]) * weights[i]
    }
    
    const remainder = sum % 11
    const calculatedCheckDigit = remainder === 0 ? 0 :
                                remainder === 1 ? 9 :
                                11 - remainder
    
    return parseInt(cleanCuit[10]) === calculatedCheckDigit
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Label htmlFor="tax-id" className="text-sm font-medium">
          {taxConfig.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                <Info size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <p>{taxConfig.description}</p>
                <p><strong>Format:</strong> {taxConfig.format}</p>
                <p><strong>Example:</strong> {taxConfig.example}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {businessType === 'B2B' && (
          <Badge variant="outline" className="text-xs">
            B2B Required
          </Badge>
        )}
      </div>
      
      <div className="relative">
        <Input
          id="tax-id"
          type="text"
          value={taxId}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={taxConfig.placeholder}
          className={`pr-10 ${
            showValidation 
              ? isValid 
                ? 'border-green-500 focus:ring-green-500' 
                : 'border-red-500 focus:ring-red-500'
              : ''
          }`}
          maxLength={targetCountry === 'AR' ? 13 : targetCountry === 'PE' ? 11 : 12}
        />
        
        {showValidation && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {isValid ? (
              <CheckCircle size={16} className="text-green-500" />
            ) : (
              <AlertCircle size={16} className="text-red-500" />
            )}
          </div>
        )}
      </div>
      
      {showValidation && !isValid && taxId && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {t('billing.invalid_tax_id', { 
              default: `Invalid ${taxConfig.label} format. Expected: ${taxConfig.format}`,
              label: taxConfig.label,
              format: taxConfig.format
            })}
          </AlertDescription>
        </Alert>
      )}
      
      {!taxId && isRequired && showValidation && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {t('billing.tax_id_required', {
              default: `${taxConfig.label} is required for business customers`,
              label: taxConfig.label
            })}
          </AlertDescription>
        </Alert>
      )}
      
      <p className="text-xs text-muted-foreground">
        {t('billing.tax_id_help', {
          default: `Enter your ${taxConfig.label} for tax compliance and invoicing`,
          label: taxConfig.label
        })}
      </p>
    </div>
  )
}

// Utility function to get tax ID configuration by country
export function getTaxIdConfig(country: string): TaxIdConfig | null {
  return TAX_ID_CONFIGS[country] || null
}

// Utility function to validate tax ID
export function validateTaxIdByCountry(taxId: string, country: string): boolean {
  const config = getTaxIdConfig(country)
  if (!config) return true // No validation for unsupported countries
  
  const pattern = new RegExp(config.pattern)
  return pattern.test(taxId)
}
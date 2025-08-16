'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, X } from "lucide-react"

interface CreateWorkflowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  availableTags: string[]
}

export default function CreateWorkflowModal({ 
  open, 
  onOpenChange, 
  onSuccess,
  availableTags 
}: CreateWorkflowModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    active: false
  })
  const [newTag, setNewTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    // Validación básica
    if (!formData.name.trim()) {
      setError('El nombre del workflow es requerido')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/workflows-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          tags: formData.tags,
          active: formData.active
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear el workflow')
      }

      const result = await response.json()
      
      // Resetear formulario
      setFormData({
        name: '',
        description: '',
        tags: [],
        active: false
      })
      setNewTag('')
      
      // Cerrar modal y notificar éxito
      onOpenChange(false)
      onSuccess()

    } catch (error) {
      console.error('Error creating workflow:', error)
      setError(error instanceof Error ? error.message : 'Error al crear el workflow')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleSelectTag = (tag: string) => {
    if (!formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }))
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      // Resetear formulario al cerrar
      setFormData({
        name: '',
        description: '',
        tags: [],
        active: false
      })
      setNewTag('')
      setError('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Workflow</DialogTitle>
          <DialogDescription>
            Configura los detalles básicos de tu nuevo workflow de automatización.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Workflow *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Procesamiento de Órdenes"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe qué hace este workflow..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags/Categorías</Label>
            
            {/* Tags seleccionados */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {formData.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="text-xs px-2 py-1 cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Selector de tags existentes */}
            {availableTags.length > 0 && (
              <Select onValueChange={handleSelectTag} disabled={isSubmitting}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar tag existente" />
                </SelectTrigger>
                <SelectContent>
                  {availableTags
                    .filter(tag => !formData.tags.includes(tag))
                    .map(tag => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {/* Crear nuevo tag */}
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Crear nuevo tag"
                disabled={isSubmitting}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTag}
                disabled={!newTag.trim() || isSubmitting}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Estado inicial */}
          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
              disabled={isSubmitting}
            />
            <Label htmlFor="active">Activar workflow inmediatamente</Label>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Workflow
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
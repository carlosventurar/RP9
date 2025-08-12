$files = @(
    "src/i18n/messages/es-CO.json",
    "src/i18n/messages/es-DO.json", 
    "src/i18n/messages/es-MX.json",
    "src/i18n/messages/es-PE.json"
)

$newWorkflowsSection = @'
  "workflows": {
    "title": "Flujos de Trabajo",
    "subtitle": "Gestiona y monitorea tus flujos de trabajo de automatización",
    "newWorkflow": "Nuevo Flujo",
    "createNew": "Crear Nuevo Flujo",
    "import": "Importar Flujo",
    "noWorkflows": "No se encontraron flujos de trabajo",
    "noWorkflowsMatchFilters": "Ningún flujo coincide con tus filtros",
    "noWorkflowsFound": "No se encontraron flujos de trabajo",
    "createFirstWorkflow": "Crear Primer Flujo",
    "workflowsWillAppear": "Tus flujos de n8n aparecerán aquí",
    "searchWorkflows": "Buscar flujos...",
    "lastRun": "Última Ejecución",
    "executions": "Ejecuciones",
    "run": "Ejecutar",
    "never": "Nunca",
    "all": "Todos",
    "active": "Activo",
    "inactive": "Inactivo",
    "success": "Exitoso",
    "crossnetFilterActive": "Filtro Crossnet Activo",
    "status": {
      "active": "Activo",
      "inactive": "Inactivo",
      "success": "Exitoso",
      "error": "Error",
      "running": "Ejecutando"
    }
  },
'@

foreach ($file in $files) {
    Write-Host "Fixing $file"
    
    $content = Get-Content $file -Raw -Encoding UTF8
    
    # Find the workflows section and replace it
    $pattern = '"workflows":\s*\{[^}]*"status":\s*\{[^}]*\}[^}]*\},'
    $content = $content -replace $pattern, $newWorkflowsSection.TrimEnd(',')
    
    Set-Content $file $content -Encoding UTF8
}

Write-Host "All workflow translations fixed!"

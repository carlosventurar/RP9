# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you do.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the todo.md file with a summary of the changes you made and any other relevant information.
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
8. can you double check the work you just did and look for edge cases
9. Please check through all the code you just wrote and any documentation for security best practices. Make sure no sensitive information is leaked and any potential security vulnerabilities people can exploit
10. Please explain the functionality and code you just built out in detail. Walk me through what you changed and how you're solving the problem
11. When I am coding with AI there are long breaks into between me giving me commands to the AI. Typically I spend that time doom scrolling which distracts me and puts me in a bad mental state. I'd like to use that time now to chat with you and generate new ideas, and also reflect on my other ideas and businesses and content. I'm not sure how I'd like to use this chat or what role I'd like you to play, but I think it could be much more useful than me doom scrolling. What do you think? What could be the best way for us to use this chat?
12. **ACTUALIZADO QA WORKFLOW**: Después de cada cambio, commit, push y crea PR a `qa` branch. Valida en QA environment antes de hacer PR a `main`.
13. La aplicacion es primario en español. Si no se puede traducir, no se puede usar, por default en español y secundario ingles.
## Project Overview

Este es el repositorio de "Agente Virtual IA" - una plataforma de automatización inteligente con IA para empresas modernas. La estructura del proyecto y arquitectura están completamente definidas y funcionales.

## Development Commands

*To be updated as the project build system is established*

### Common Commands
- Build: *TBD*
- Test: *TBD*
- Lint: *TBD*
- Dev server: *TBD*

### Single Test Execution
- *TBD based on chosen testing framework*

## Architecture Overview

*This section will be updated as the codebase architecture is established*

### Key Components
- *To be documented as components are created*

### Project Structure
- *To be documented as the file structure is established*

## Development Workflow (QA Environment)

⚠️ **NUEVO WORKFLOW QA IMPLEMENTADO** ⚠️

### Workflow Principal:
1. **Development**: Crear feature branch → PR a `qa` branch
2. **QA Testing**: Validar cambios en ambiente QA
3. **Production**: PR de `qa` → `main` (solo después de validación)

### Comandos de Desarrollo:
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Dev server: `npm run dev --turbopack`

### Ramas y Ambientes:
- **`qa`**: Ambiente de testing - todos los cambios van aquí primero
- **`main`**: Producción estable - solo cambios validados en QA
- **feature branches**: Para desarrollo de nuevas funcionalidades

### Proceso de Commit:
1. **Desarrollo**: `feature/nueva-funcionalidad` → commit → push
2. **QA Deploy**: PR a `qa` → auto-deploy a QA environment  
3. **Testing**: Validar funcionalidad en QA environment
4. **Production**: PR de `qa` a `main` → auto-deploy a producción

### Reglas Importantes:
- **NUNCA** hacer commit directo a `main`
- **SIEMPRE** pasar por QA antes de producción
- **VALIDAR** cambios en QA environment antes de aprobar PR a main
- **USAR** labels: `qa-ready`, `prod-ready`, `hotfix`, `qa-testing`

### Ambientes:
- **QA**: https://qa-agentevirtualia.netlify.app (rama `qa`)
- **Producción**: https://agentevirtualia.com (rama `main`)

### Hotfixes Críticos:
Para bugs críticos que requieren deploy inmediato:
1. `hotfix/nombre-fix` → PR a `qa` (label: `hotfix`)
2. Testing rápido en QA
3. Fast-track PR de `qa` a `main`

## Notes

This CLAUDE.md will be updated as the project grows and the codebase structure becomes more defined.
# Propuestas (para próximas fases)

## Pack-group v2 (declarativo)
**Motivación**: Reducir comandos repetitivos cuando un mismo tema usa múltiples sources.

### Idea
Definir un “theme” con sources y pesos en un único bloque declarativo.
Ejemplo conceptual:
```json
{
  "theme": "cyberpunk",
  "sources": {
    "wallhaven": { "weight": 2, "categories": "111" },
    "unsplash": { "weight": 1, "orientation": "landscape" },
    "reddit": { "subreddits": ["Cyberpunk"] }
  }
}
```

### Comportamiento esperado
- Genera packs por source (`wallhaven-cyberpunk`, `unsplash-cyberpunk`, etc.).
- Aplica defaults y overrides por source.
- Agrega automáticamente al pool con pesos.

### Tradeoffs
- Requiere definir un mini-schema adicional.
- Aumenta la complejidad de configuración, pero simplifica UX.

### Estado
Propuesta: no implementado.

# Jira MCP Server

Servidor MCP minimo para Jira Cloud usando `stdio`.

## Requisitos

- Node.js 20+
- Un API token de Atlassian

## Variables de entorno

```bash
export JIRA_BASE_URL="https://tracktec.atlassian.net"
export JIRA_EMAIL="tu_correo@tracktec.cl"
export JIRA_API_TOKEN="tu_token"
```

## Instalar dependencias

```bash
npm install
```

## Probar que el script compila

```bash
npm run check
```

## Ejecutar localmente

```bash
npm start
```

## Herramientas expuestas

- `get_issue`
- `list_transitions`
- `transition_issue`
- `add_comment`
- `update_issue_description`
- `append_issue_description`
- `search_issues`
- `find_user`
- `create_issue`
- `assign_issue`

## Conectar a Codex

Ejemplo de configuracion en `~/.codex/config.toml`:

```toml
[mcp_servers.jira]
command = "node"
args = ["/home/work/tracktec/jira-mcp/src/index.js"]

[mcp_servers.jira.env]
JIRA_BASE_URL = "https://tracktec.atlassian.net"
JIRA_EMAIL = "tu_correo@tracktec.cl"
JIRA_API_TOKEN = "tu_token"
```

Tambien puedes registrarlo con `codex mcp add` si prefieres manejarlo por CLI.

## Ejemplos

Buscar tareas en curso del usuario actual:

```jql
assignee = currentUser() AND status = "En curso"
```

Buscar un usuario para asignar:

- usa `find_user` con nombre o correo
- toma el `accountId`
- luego pásalo a `create_issue.assignee_account_id`

Reasignar una tarea ya creada:

- usa `find_user` con nombre o correo
- toma el `accountId`
- luego pásalo a `assign_issue.assignee_account_id` junto con `assign_issue.issue_key`

Actualizar o limpiar la descripcion de una tarea:

- usa `update_issue_description.issue_key` con la clave Jira
- pasa el nuevo texto en `update_issue_description.description`
- si envias `""`, la descripcion se limpia

Agregar texto a la descripcion actual:

- usa `append_issue_description.issue_key` con la clave Jira
- pasa el texto adicional en `append_issue_description.text`
- el servidor lee la descripcion actual y concatena el nuevo contenido al final

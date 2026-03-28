# motodiario

## Configuración ERP por empresa

Cada empresa puede activar la opción de sincronización con un ERP y guardar su configuración de credenciales de forma independiente.

### Campos

- Sincronizar con ERP: habilita el uso de credenciales de ERP para esa empresa.
- URL de API ERP: obligatoria cuando la sincronización está activa. Máximo 500 caracteres. Debe ser una URL http/https válida.
  - Ejemplos válidos: `https://erp.ejemplo.com/api`, `http://localhost:8080/api/v1`
- Token de API ERP: obligatorio cuando la sincronización está activa. Máximo 255 caracteres. Solo permite caracteres alfanuméricos y guiones (`A-Z`, `a-z`, `0-9`, `-`).
  - Ejemplo válido: `ERP-TOKEN-123`

### Obtención del token

Motodiario almacena y valida el formato del token, pero la emisión del token depende del ERP que use cada empresa. Flujo recomendado:

- En el ERP, crear una credencial de API (token/personal access token/API key) con permisos mínimos necesarios.
- Copiar el token sin espacios y pegarlo en el campo correspondiente en la empresa.
- Si el ERP rota tokens, actualizar el token en el catálogo de empresas.

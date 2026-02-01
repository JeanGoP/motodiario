-- Renombrar tablas base usadas por el frontend
IF OBJECT_ID(N'dbo.cost_centers', N'U') IS NOT NULL
  EXEC sp_rename 'dbo.cost_centers', 'centros_costo';
GO
IF OBJECT_ID(N'dbo.clients', N'U') IS NOT NULL
  EXEC sp_rename 'dbo.clients', 'clientes';
GO

-- COSTO DE COSTOS: eliminar dependencias, renombrar columnas y recrear restricciones
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_cost_centers_code' AND type = 'UQ')
  ALTER TABLE dbo.centros_costo DROP CONSTRAINT UQ_cost_centers_code;
GO

IF COL_LENGTH('dbo.centros_costo', 'name') IS NOT NULL EXEC sp_rename 'dbo.centros_costo.name', 'nombre', 'COLUMN';
IF COL_LENGTH('dbo.centros_costo', 'code') IS NOT NULL EXEC sp_rename 'dbo.centros_costo.code', 'codigo', 'COLUMN';
IF COL_LENGTH('dbo.centros_costo', 'description') IS NOT NULL EXEC sp_rename 'dbo.centros_costo.description', 'descripcion', 'COLUMN';
IF COL_LENGTH('dbo.centros_costo', 'active') IS NOT NULL EXEC sp_rename 'dbo.centros_costo.active', 'activo', 'COLUMN';
IF COL_LENGTH('dbo.centros_costo', 'created_at') IS NOT NULL EXEC sp_rename 'dbo.centros_costo.created_at', 'creado_en', 'COLUMN';
IF COL_LENGTH('dbo.centros_costo', 'updated_at') IS NOT NULL EXEC sp_rename 'dbo.centros_costo.updated_at', 'actualizado_en', 'COLUMN';
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_centros_costo_codigo' AND type = 'UQ')
  ALTER TABLE dbo.centros_costo ADD CONSTRAINT UQ_centros_costo_codigo UNIQUE (codigo);
GO

-- CLIENTES: eliminar dependencias, renombrar columnas y recrear restricciones/índices
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'FK_clients_cost_center' AND type = 'F')
  ALTER TABLE dbo.clientes DROP CONSTRAINT FK_clients_cost_center;
GO
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_clients_document' AND type = 'UQ')
  ALTER TABLE dbo.clientes DROP CONSTRAINT UQ_clients_document;
GO
IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'CK_clients_grace_days' AND type = 'C')
  ALTER TABLE dbo.clientes DROP CONSTRAINT CK_clients_grace_days;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_clients_cost_center' AND object_id = OBJECT_ID(N'dbo.clientes'))
  DROP INDEX idx_clients_cost_center ON dbo.clientes;
GO

IF COL_LENGTH('dbo.clientes', 'cost_center_id') IS NOT NULL EXEC sp_rename 'dbo.clientes.cost_center_id', 'centro_costo_id', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'name') IS NOT NULL EXEC sp_rename 'dbo.clientes.name', 'nombre', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'document') IS NOT NULL EXEC sp_rename 'dbo.clientes.document', 'documento', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'phone') IS NOT NULL EXEC sp_rename 'dbo.clientes.phone', 'telefono', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'email') IS NOT NULL EXEC sp_rename 'dbo.clientes.email', 'correo', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'address') IS NOT NULL EXEC sp_rename 'dbo.clientes.address', 'direccion', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'grace_days') IS NOT NULL EXEC sp_rename 'dbo.clientes.grace_days', 'dias_gracia', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'active') IS NOT NULL EXEC sp_rename 'dbo.clientes.active', 'activo', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'created_at') IS NOT NULL EXEC sp_rename 'dbo.clientes.created_at', 'creado_en', 'COLUMN';
IF COL_LENGTH('dbo.clientes', 'updated_at') IS NOT NULL EXEC sp_rename 'dbo.clientes.updated_at', 'actualizado_en', 'COLUMN';
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'UQ_clientes_documento' AND type = 'UQ')
  ALTER TABLE dbo.clientes ADD CONSTRAINT UQ_clientes_documento UNIQUE (documento);
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'CK_clientes_dias_gracia' AND type = 'C')
  ALTER TABLE dbo.clientes ADD CONSTRAINT CK_clientes_dias_gracia CHECK (dias_gracia IN (2,4));
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'FK_clientes_centro_costo' AND type = 'F')
  ALTER TABLE dbo.clientes ADD CONSTRAINT FK_clientes_centro_costo FOREIGN KEY (centro_costo_id) REFERENCES dbo.centros_costo(id);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_clientes_centro_costo' AND object_id = OBJECT_ID(N'dbo.clientes'))
  CREATE INDEX idx_clientes_centro_costo ON dbo.clientes(centro_costo_id);
GO

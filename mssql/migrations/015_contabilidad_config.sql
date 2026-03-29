IF OBJECT_ID(N'[dbo].[contable_cuentas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[contable_cuentas] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [codigo] nvarchar(50) NOT NULL,
    [nombre] nvarchar(255) NOT NULL,
    [activo] bit NOT NULL DEFAULT 1,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [actualizado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_contable_cuentas] PRIMARY KEY ([id])
  );
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_cuentas_empresa')
  ALTER TABLE dbo.contable_cuentas
    ADD CONSTRAINT FK_contable_cuentas_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_contable_cuentas_empresa_codigo' AND object_id = OBJECT_ID(N'dbo.contable_cuentas'))
  CREATE UNIQUE INDEX UQ_contable_cuentas_empresa_codigo ON dbo.contable_cuentas(empresa_id, codigo);

IF OBJECT_ID(N'[dbo].[contable_reglas_versiones]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[contable_reglas_versiones] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [tipo_cuota] nvarchar(64) NOT NULL,
    [version] int NOT NULL,
    [activa] bit NOT NULL DEFAULT 0,
    [creada_por] uniqueidentifier NULL,
    [creada_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [comentario] nvarchar(255) NULL,
    CONSTRAINT [PK_contable_reglas_versiones] PRIMARY KEY ([id])
  );
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_reglas_versiones_empresa')
  ALTER TABLE dbo.contable_reglas_versiones
    ADD CONSTRAINT FK_contable_reglas_versiones_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_reglas_versiones_usuario')
  ALTER TABLE dbo.contable_reglas_versiones
    ADD CONSTRAINT FK_contable_reglas_versiones_usuario FOREIGN KEY (creada_por) REFERENCES dbo.usuarios(id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_contable_reglas_empresa_tipo_version' AND object_id = OBJECT_ID(N'dbo.contable_reglas_versiones'))
  CREATE UNIQUE INDEX UQ_contable_reglas_empresa_tipo_version ON dbo.contable_reglas_versiones(empresa_id, tipo_cuota, version);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_contable_reglas_empresa_tipo_activa' AND object_id = OBJECT_ID(N'dbo.contable_reglas_versiones'))
  CREATE INDEX idx_contable_reglas_empresa_tipo_activa ON dbo.contable_reglas_versiones(empresa_id, tipo_cuota, activa);

IF OBJECT_ID(N'[dbo].[contable_regla_lineas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[contable_regla_lineas] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [regla_version_id] uniqueidentifier NOT NULL,
    [cuenta_id] uniqueidentifier NOT NULL,
    [movimiento] nvarchar(7) NOT NULL,
    [porcentaje] decimal(9,4) NOT NULL,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_contable_regla_lineas] PRIMARY KEY ([id])
  );
END

IF OBJECT_ID(N'[dbo].[contable_regla_lineas]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.contable_regla_lineas', 'movimiento') = 12
    EXEC sp_executesql N'ALTER TABLE dbo.contable_regla_lineas ALTER COLUMN movimiento nvarchar(7) NOT NULL;';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_regla_lineas_empresa')
  ALTER TABLE dbo.contable_regla_lineas
    ADD CONSTRAINT FK_contable_regla_lineas_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_regla_lineas_regla')
  ALTER TABLE dbo.contable_regla_lineas
    ADD CONSTRAINT FK_contable_regla_lineas_regla FOREIGN KEY (regla_version_id) REFERENCES dbo.contable_reglas_versiones(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_regla_lineas_cuenta')
  ALTER TABLE dbo.contable_regla_lineas
    ADD CONSTRAINT FK_contable_regla_lineas_cuenta FOREIGN KEY (cuenta_id) REFERENCES dbo.contable_cuentas(id);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contable_regla_lineas_movimiento' AND parent_object_id = OBJECT_ID(N'dbo.contable_regla_lineas'))
  ALTER TABLE dbo.contable_regla_lineas
    ADD CONSTRAINT CK_contable_regla_lineas_movimiento CHECK (movimiento IN (N'DEBITO', N'CREDITO'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contable_regla_lineas_porcentaje' AND parent_object_id = OBJECT_ID(N'dbo.contable_regla_lineas'))
  ALTER TABLE dbo.contable_regla_lineas
    ADD CONSTRAINT CK_contable_regla_lineas_porcentaje CHECK (porcentaje > 0 AND porcentaje <= 100);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_contable_regla_lineas_regla' AND object_id = OBJECT_ID(N'dbo.contable_regla_lineas'))
  CREATE INDEX idx_contable_regla_lineas_regla ON dbo.contable_regla_lineas(empresa_id, regla_version_id);

IF OBJECT_ID(N'[dbo].[contable_asientos]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[contable_asientos] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [origen] nvarchar(32) NOT NULL,
    [origen_id] uniqueidentifier NOT NULL,
    [regla_version_id] uniqueidentifier NULL,
    [fecha] date NOT NULL,
    [descripcion] nvarchar(255) NULL,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_contable_asientos] PRIMARY KEY ([id])
  );
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_asientos_empresa')
  ALTER TABLE dbo.contable_asientos
    ADD CONSTRAINT FK_contable_asientos_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_asientos_regla')
  ALTER TABLE dbo.contable_asientos
    ADD CONSTRAINT FK_contable_asientos_regla FOREIGN KEY (regla_version_id) REFERENCES dbo.contable_reglas_versiones(id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_contable_asientos_origen' AND object_id = OBJECT_ID(N'dbo.contable_asientos'))
  CREATE INDEX idx_contable_asientos_origen ON dbo.contable_asientos(empresa_id, origen, origen_id);

IF OBJECT_ID(N'[dbo].[contable_asiento_lineas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[contable_asiento_lineas] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [asiento_id] uniqueidentifier NOT NULL,
    [cuenta_id] uniqueidentifier NOT NULL,
    [movimiento] nvarchar(7) NOT NULL,
    [porcentaje] decimal(9,4) NOT NULL,
    [valor] decimal(18,2) NOT NULL,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_contable_asiento_lineas] PRIMARY KEY ([id])
  );
END

IF OBJECT_ID(N'[dbo].[contable_asiento_lineas]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.contable_asiento_lineas', 'movimiento') = 12
    EXEC sp_executesql N'ALTER TABLE dbo.contable_asiento_lineas ALTER COLUMN movimiento nvarchar(7) NOT NULL;';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_asiento_lineas_empresa')
  ALTER TABLE dbo.contable_asiento_lineas
    ADD CONSTRAINT FK_contable_asiento_lineas_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_asiento_lineas_asiento')
  ALTER TABLE dbo.contable_asiento_lineas
    ADD CONSTRAINT FK_contable_asiento_lineas_asiento FOREIGN KEY (asiento_id) REFERENCES dbo.contable_asientos(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contable_asiento_lineas_cuenta')
  ALTER TABLE dbo.contable_asiento_lineas
    ADD CONSTRAINT FK_contable_asiento_lineas_cuenta FOREIGN KEY (cuenta_id) REFERENCES dbo.contable_cuentas(id);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contable_asiento_lineas_movimiento' AND parent_object_id = OBJECT_ID(N'dbo.contable_asiento_lineas'))
  ALTER TABLE dbo.contable_asiento_lineas
    ADD CONSTRAINT CK_contable_asiento_lineas_movimiento CHECK (movimiento IN (N'DEBITO', N'CREDITO'));

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_contable_asiento_lineas_asiento' AND object_id = OBJECT_ID(N'dbo.contable_asiento_lineas'))
  CREATE INDEX idx_contable_asiento_lineas_asiento ON dbo.contable_asiento_lineas(empresa_id, asiento_id);

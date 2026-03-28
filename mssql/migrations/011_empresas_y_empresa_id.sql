IF OBJECT_ID(N'[dbo].[empresas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[empresas] (
    [id] uniqueidentifier NOT NULL,
    [nombre] nvarchar(255) NOT NULL,
    [codigo] nvarchar(100) NOT NULL,
    [activo] bit NOT NULL DEFAULT 1,
    [leadconnector_location_id] nvarchar(128) NULL,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [actualizado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_empresas] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_empresas_codigo] UNIQUE ([codigo])
  );
END

DECLARE @defaultEmpresaId uniqueidentifier;
SELECT @defaultEmpresaId = id FROM dbo.empresas WHERE codigo = N'DEFAULT';

IF @defaultEmpresaId IS NULL
BEGIN
  SET @defaultEmpresaId = NEWID();
  INSERT INTO dbo.empresas (id, nombre, codigo, activo, leadconnector_location_id, creado_en, actualizado_en)
  VALUES (@defaultEmpresaId, N'Empresa', N'DEFAULT', 1, NULL, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
END

IF OBJECT_ID(N'[dbo].[usuarios]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.usuarios', 'empresa_id') IS NULL
    ALTER TABLE dbo.usuarios ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.usuarios', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.usuarios SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.usuarios'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.usuarios ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_usuarios_empresa'')
        ALTER TABLE dbo.usuarios ADD CONSTRAINT FK_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_usuarios_empresa'' AND object_id = OBJECT_ID(N''dbo.usuarios''))
        CREATE INDEX idx_usuarios_empresa ON dbo.usuarios(empresa_id);
      IF EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_usuarios_correo'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.usuarios''))
        ALTER TABLE dbo.usuarios DROP CONSTRAINT UQ_usuarios_correo;
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_usuarios_empresa_correo'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.usuarios''))
        ALTER TABLE dbo.usuarios ADD CONSTRAINT UQ_usuarios_empresa_correo UNIQUE (empresa_id, correo);
      IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE empresa_id = @empresa AND rol = N''admin'')
         AND NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE empresa_id = @empresa AND correo = N''admin@motodiario.local'')
        INSERT INTO dbo.usuarios (empresa_id, nombre, correo, hash_password, rol, activo, creado_en)
        VALUES (@empresa, N''Administrador'', N''admin@motodiario.local'', N''$2a$10$Sla7Nw/E3BWhtLiY1NrJEe.7wYSOGyU9BezWpz/TY6Z9lpZwC9ltW'', N''admin'', 1, SYSDATETIMEOFFSET());
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[centros_costo]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.centros_costo', 'empresa_id') IS NULL
    ALTER TABLE dbo.centros_costo ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.centros_costo', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.centros_costo SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.centros_costo'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.centros_costo ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_centros_costo_empresa'')
        ALTER TABLE dbo.centros_costo ADD CONSTRAINT FK_centros_costo_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_centros_costo_empresa'' AND object_id = OBJECT_ID(N''dbo.centros_costo''))
        CREATE INDEX idx_centros_costo_empresa ON dbo.centros_costo(empresa_id);
      IF EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_centros_costo_codigo'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.centros_costo''))
        ALTER TABLE dbo.centros_costo DROP CONSTRAINT UQ_centros_costo_codigo;
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_centros_costo_empresa_codigo'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.centros_costo''))
        ALTER TABLE dbo.centros_costo ADD CONSTRAINT UQ_centros_costo_empresa_codigo UNIQUE (empresa_id, codigo);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[asociados]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.asociados', 'empresa_id') IS NULL
    ALTER TABLE dbo.asociados ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.asociados', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.asociados SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.asociados'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.asociados ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_asociados_empresa'')
        ALTER TABLE dbo.asociados ADD CONSTRAINT FK_asociados_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_asociados_empresa'' AND object_id = OBJECT_ID(N''dbo.asociados''))
        CREATE INDEX idx_asociados_empresa ON dbo.asociados(empresa_id);
      IF EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_asociados_documento'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.asociados''))
        ALTER TABLE dbo.asociados DROP CONSTRAINT UQ_asociados_documento;
      IF EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_clientes_documento'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.asociados''))
        ALTER TABLE dbo.asociados DROP CONSTRAINT UQ_clientes_documento;
      IF EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_clients_document'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.asociados''))
        ALTER TABLE dbo.asociados DROP CONSTRAINT UQ_clients_document;
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_asociados_empresa_documento'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.asociados''))
        ALTER TABLE dbo.asociados ADD CONSTRAINT UQ_asociados_empresa_documento UNIQUE (empresa_id, documento);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[motos]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.motos', 'empresa_id') IS NULL
    ALTER TABLE dbo.motos ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.motos', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.motos SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.motos'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.motos ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_motos_empresa'')
        ALTER TABLE dbo.motos ADD CONSTRAINT FK_motos_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_motos_empresa'' AND object_id = OBJECT_ID(N''dbo.motos''))
        CREATE INDEX idx_motos_empresa ON dbo.motos(empresa_id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[pagos]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.pagos', 'empresa_id') IS NULL
    ALTER TABLE dbo.pagos ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.pagos', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.pagos SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.pagos'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.pagos ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_pagos_empresa'')
        ALTER TABLE dbo.pagos ADD CONSTRAINT FK_pagos_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_pagos_empresa'' AND object_id = OBJECT_ID(N''dbo.pagos''))
        CREATE INDEX idx_pagos_empresa ON dbo.pagos(empresa_id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[distribuciones_pagos]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.distribuciones_pagos', 'empresa_id') IS NULL
    ALTER TABLE dbo.distribuciones_pagos ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.distribuciones_pagos', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.distribuciones_pagos SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.distribuciones_pagos'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.distribuciones_pagos ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_distribuciones_pagos_empresa'')
        ALTER TABLE dbo.distribuciones_pagos ADD CONSTRAINT FK_distribuciones_pagos_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_distribuciones_pagos_empresa'' AND object_id = OBJECT_ID(N''dbo.distribuciones_pagos''))
        CREATE INDEX idx_distribuciones_pagos_empresa ON dbo.distribuciones_pagos(empresa_id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[recibos_caja]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.recibos_caja', 'empresa_id') IS NULL
    ALTER TABLE dbo.recibos_caja ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.recibos_caja', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.recibos_caja SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.recibos_caja'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.recibos_caja ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_recibos_caja_empresa'')
        ALTER TABLE dbo.recibos_caja ADD CONSTRAINT FK_recibos_caja_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_recibos_caja_empresa'' AND object_id = OBJECT_ID(N''dbo.recibos_caja''))
        CREATE INDEX idx_recibos_caja_empresa ON dbo.recibos_caja(empresa_id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[notificaciones]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.notificaciones', 'empresa_id') IS NULL
    ALTER TABLE dbo.notificaciones ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.notificaciones', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.notificaciones SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.notificaciones'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.notificaciones ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_notificaciones_empresa'')
        ALTER TABLE dbo.notificaciones ADD CONSTRAINT FK_notificaciones_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_notificaciones_empresa'' AND object_id = OBJECT_ID(N''dbo.notificaciones''))
        CREATE INDEX idx_notificaciones_empresa ON dbo.notificaciones(empresa_id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[desactivaciones]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.desactivaciones', 'empresa_id') IS NULL
    ALTER TABLE dbo.desactivaciones ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.desactivaciones', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.desactivaciones SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.desactivaciones'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.desactivaciones ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_desactivaciones_empresa'')
        ALTER TABLE dbo.desactivaciones ADD CONSTRAINT FK_desactivaciones_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_desactivaciones_empresa'' AND object_id = OBJECT_ID(N''dbo.desactivaciones''))
        CREATE INDEX idx_desactivaciones_empresa ON dbo.desactivaciones(empresa_id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[dias_gracia_asociados]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.dias_gracia_asociados', 'empresa_id') IS NULL
    ALTER TABLE dbo.dias_gracia_asociados ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.dias_gracia_asociados', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.dias_gracia_asociados SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.dias_gracia_asociados'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.dias_gracia_asociados ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_dias_gracia_asociados_empresa'')
        ALTER TABLE dbo.dias_gracia_asociados ADD CONSTRAINT FK_dias_gracia_asociados_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_dias_gracia_asociados_empresa'' AND object_id = OBJECT_ID(N''dbo.dias_gracia_asociados''))
        CREATE INDEX idx_dias_gracia_asociados_empresa ON dbo.dias_gracia_asociados(empresa_id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[dias_gracia_motos]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.dias_gracia_motos', 'empresa_id') IS NULL
    ALTER TABLE dbo.dias_gracia_motos ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.dias_gracia_motos', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.dias_gracia_motos SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.dias_gracia_motos'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.dias_gracia_motos ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_dias_gracia_motos_empresa'')
        ALTER TABLE dbo.dias_gracia_motos ADD CONSTRAINT FK_dias_gracia_motos_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''idx_dias_gracia_motos_empresa'' AND object_id = OBJECT_ID(N''dbo.dias_gracia_motos''))
        CREATE INDEX idx_dias_gracia_motos_empresa ON dbo.dias_gracia_motos(empresa_id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[cost_centers]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.cost_centers', 'empresa_id') IS NULL
    ALTER TABLE dbo.cost_centers ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.cost_centers', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.cost_centers SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.cost_centers'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.cost_centers ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_cost_centers_empresa'')
        ALTER TABLE dbo.cost_centers ADD CONSTRAINT FK_cost_centers_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_cost_centers_code'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.cost_centers''))
        ALTER TABLE dbo.cost_centers DROP CONSTRAINT UQ_cost_centers_code;
      IF COL_LENGTH(''dbo.cost_centers'', ''code'') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_cost_centers_empresa_code'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.cost_centers''))
        ALTER TABLE dbo.cost_centers ADD CONSTRAINT UQ_cost_centers_empresa_code UNIQUE (empresa_id, code);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[clients]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.clients', 'empresa_id') IS NULL
    ALTER TABLE dbo.clients ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.clients', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.clients SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.clients'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.clients ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_clients_empresa'')
        ALTER TABLE dbo.clients ADD CONSTRAINT FK_clients_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[motorcycles]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.motorcycles', 'empresa_id') IS NULL
    ALTER TABLE dbo.motorcycles ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.motorcycles', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.motorcycles SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.motorcycles'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.motorcycles ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_motorcycles_empresa'')
        ALTER TABLE dbo.motorcycles ADD CONSTRAINT FK_motorcycles_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_motorcycles_plate'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.motorcycles''))
        ALTER TABLE dbo.motorcycles DROP CONSTRAINT UQ_motorcycles_plate;
      IF COL_LENGTH(''dbo.motorcycles'', ''plate'') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_motorcycles_empresa_plate'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.motorcycles''))
        ALTER TABLE dbo.motorcycles ADD CONSTRAINT UQ_motorcycles_empresa_plate UNIQUE (empresa_id, plate);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[payments]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.payments', 'empresa_id') IS NULL
    ALTER TABLE dbo.payments ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.payments', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.payments SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.payments'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.payments ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_payments_empresa'')
        ALTER TABLE dbo.payments ADD CONSTRAINT FK_payments_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
      IF EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_payments_receipt'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.payments''))
        ALTER TABLE dbo.payments DROP CONSTRAINT UQ_payments_receipt;
      IF COL_LENGTH(''dbo.payments'', ''receipt_number'') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = ''UQ_payments_empresa_receipt'' AND type = ''UQ'' AND parent_object_id = OBJECT_ID(N''dbo.payments''))
        ALTER TABLE dbo.payments ADD CONSTRAINT UQ_payments_empresa_receipt UNIQUE (empresa_id, receipt_number);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[payment_distributions]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.payment_distributions', 'empresa_id') IS NULL
    ALTER TABLE dbo.payment_distributions ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.payment_distributions', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.payment_distributions SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.payment_distributions'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.payment_distributions ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_payment_distributions_empresa'')
        ALTER TABLE dbo.payment_distributions ADD CONSTRAINT FK_payment_distributions_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[deactivations]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.deactivations', 'empresa_id') IS NULL
    ALTER TABLE dbo.deactivations ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.deactivations', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.deactivations SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.deactivations'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.deactivations ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_deactivations_empresa'')
        ALTER TABLE dbo.deactivations ADD CONSTRAINT FK_deactivations_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[notifications]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.notifications', 'empresa_id') IS NULL
    ALTER TABLE dbo.notifications ADD empresa_id uniqueidentifier NULL;
  IF COL_LENGTH('dbo.notifications', 'empresa_id') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.notifications SET empresa_id = @empresa WHERE empresa_id IS NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N''dbo.notifications'') AND name = ''empresa_id'' AND is_nullable = 1)
        ALTER TABLE dbo.notifications ALTER COLUMN empresa_id uniqueidentifier NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = ''FK_notifications_empresa'')
        ALTER TABLE dbo.notifications ADD CONSTRAINT FK_notifications_empresa FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id);
    ', N'@empresa uniqueidentifier', @empresa = @defaultEmpresaId;
END

IF OBJECT_ID(N'[dbo].[tr_create_payment_distribution]', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[tr_create_payment_distribution];

IF OBJECT_ID(N'[dbo].[pagos]', N'U') IS NOT NULL AND OBJECT_ID(N'[dbo].[distribuciones_pagos]', N'U') IS NOT NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER [dbo].[tr_create_payment_distribution]
    ON [dbo].[pagos]
    AFTER INSERT
    AS
    BEGIN
      SET NOCOUNT ON;
      INSERT INTO [dbo].[distribuciones_pagos] (empresa_id, payment_id, associate_amount, company_amount)
      SELECT i.empresa_id, i.id, CONVERT(decimal(10,2), i.amount * 0.70), CONVERT(decimal(10,2), i.amount * 0.30)
      FROM inserted i;
    END
  ');
END
ELSE IF OBJECT_ID(N'[dbo].[payments]', N'U') IS NOT NULL AND OBJECT_ID(N'[dbo].[payment_distributions]', N'U') IS NOT NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER [dbo].[tr_create_payment_distribution]
    ON [dbo].[payments]
    AFTER INSERT
    AS
    BEGIN
      SET NOCOUNT ON;
      INSERT INTO [dbo].[payment_distributions] (empresa_id, payment_id, associate_amount, company_amount)
      SELECT i.empresa_id, i.id, CONVERT(decimal(10,2), i.amount * 0.70), CONVERT(decimal(10,2), i.amount * 0.30)
      FROM inserted i;
    END
  ');
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[audit_logs]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[audit_logs] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [usuario_id] uniqueidentifier NOT NULL,
    [accion] nvarchar(32) NOT NULL,
    [recurso] nvarchar(64) NOT NULL,
    [recurso_id] uniqueidentifier NULL,
    [payload_json] nvarchar(max) NULL,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_audit_logs] PRIMARY KEY ([id])
  );

  CREATE INDEX [idx_audit_logs_empresa] ON [dbo].[audit_logs]([empresa_id], [creado_en]);
  CREATE INDEX [idx_audit_logs_usuario] ON [dbo].[audit_logs]([usuario_id], [creado_en]);
END
GO


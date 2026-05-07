IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[moto_entrega_adjuntos]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[moto_entrega_adjuntos] (
    [id] uniqueidentifier NOT NULL CONSTRAINT [DF_moto_entrega_adjuntos_id] DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [moto_id] uniqueidentifier NOT NULL,
    [nombre_archivo] nvarchar(255) NOT NULL,
    [mime_type] nvarchar(100) NOT NULL,
    [size_bytes] int NOT NULL,
    [contenido] varbinary(max) NOT NULL,
    [creado_por] uniqueidentifier NULL,
    [creado_en] datetimeoffset NOT NULL CONSTRAINT [DF_moto_entrega_adjuntos_creado_en] DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_moto_entrega_adjuntos] PRIMARY KEY ([id])
  );

  CREATE INDEX [IX_moto_entrega_adjuntos_moto] ON [dbo].[moto_entrega_adjuntos] ([empresa_id], [moto_id], [creado_en] DESC);
END
GO

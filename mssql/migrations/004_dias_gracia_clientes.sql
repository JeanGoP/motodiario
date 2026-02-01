IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[dias_gracia_clientes]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[dias_gracia_clientes] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [cliente_id] uniqueidentifier NOT NULL,
    [anio] int NOT NULL,
    [mes] int NOT NULL,
    [dia] int NOT NULL,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_dias_gracia_clientes] PRIMARY KEY ([id]),
    CONSTRAINT [FK_dgc_cliente] FOREIGN KEY ([cliente_id]) REFERENCES [dbo].[clientes]([id]) ON DELETE CASCADE,
    CONSTRAINT [CK_dgc_mes] CHECK ([mes] BETWEEN 1 AND 12),
    CONSTRAINT [CK_dgc_dia] CHECK ([dia] BETWEEN 1 AND 31)
  );
END
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_dgc_cliente_mes_dia' AND object_id = OBJECT_ID(N'[dbo].[dias_gracia_clientes]'))
  CREATE UNIQUE INDEX [UQ_dgc_cliente_mes_dia] ON [dbo].[dias_gracia_clientes]([cliente_id],[anio],[mes],[dia]);
GO

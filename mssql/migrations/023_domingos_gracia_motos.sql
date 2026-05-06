IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[domingos_gracia_motos]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[domingos_gracia_motos] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [empresa_id] uniqueidentifier NOT NULL,
    [moto_id] uniqueidentifier NOT NULL,
    [anio] int NOT NULL,
    [mes] int NOT NULL,
    [modo] nvarchar(16) NOT NULL,
    [actualizado_por] uniqueidentifier NOT NULL,
    [actualizado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_domingos_gracia_motos] PRIMARY KEY ([id])
  );

  CREATE INDEX [idx_domingos_gracia_motos] ON [dbo].[domingos_gracia_motos]([empresa_id], [moto_id], [anio], [mes]);
END
GO

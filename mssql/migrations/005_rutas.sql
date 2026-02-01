IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rutas]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[rutas] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [nombre] nvarchar(255) NOT NULL,
    [descripcion] nvarchar(max) NOT NULL DEFAULT N'',
    [activo] bit NOT NULL DEFAULT 1,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [actualizado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_rutas] PRIMARY KEY ([id])
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usuarios]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[usuarios] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [nombre] nvarchar(255) NOT NULL,
    [correo] nvarchar(255) NOT NULL,
    [hash_password] nvarchar(255) NOT NULL,
    [rol] nvarchar(50) NOT NULL DEFAULT N'usuario',
    [activo] bit NOT NULL DEFAULT 1,
    [creado_en] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_usuarios] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_usuarios_correo] UNIQUE ([correo])
  );
END
GO

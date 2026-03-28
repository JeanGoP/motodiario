IF OBJECT_ID(N'[dbo].[empresas]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.empresas', 'tema_acento') IS NULL
    ALTER TABLE dbo.empresas ADD tema_acento NVARCHAR(20) NULL;

  IF COL_LENGTH('dbo.empresas', 'tema_acento') IS NOT NULL
    EXEC sp_executesql N'
      UPDATE dbo.empresas
      SET tema_acento = COALESCE(tema_acento, N''#6366f1'')
    ';
END
GO


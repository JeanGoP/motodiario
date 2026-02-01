IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rutas]') AND name = 'codigo')
BEGIN
  ALTER TABLE [dbo].[rutas] ADD [codigo] nvarchar(100) NOT NULL DEFAULT N'';
  
  -- Add unique constraint
  ALTER TABLE [dbo].[rutas] ADD CONSTRAINT [UQ_rutas_codigo] UNIQUE ([codigo]);
END
GO

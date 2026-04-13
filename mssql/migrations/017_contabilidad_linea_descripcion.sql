IF OBJECT_ID(N'[dbo].[contable_regla_lineas]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.contable_regla_lineas', 'descripcion') IS NULL
  BEGIN
    ALTER TABLE dbo.contable_regla_lineas ADD descripcion nvarchar(255) NULL;
  END;
END

IF OBJECT_ID(N'[dbo].[contable_asiento_lineas]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.contable_asiento_lineas', 'descripcion') IS NULL
  BEGIN
    ALTER TABLE dbo.contable_asiento_lineas ADD descripcion nvarchar(255) NULL;
  END;
END

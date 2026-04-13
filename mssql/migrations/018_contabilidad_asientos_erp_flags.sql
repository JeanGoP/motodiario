IF OBJECT_ID(N'[dbo].[contable_asientos]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.contable_asientos', 'erp_enviado') IS NULL
  BEGIN
    ALTER TABLE dbo.contable_asientos ADD erp_enviado bit NOT NULL CONSTRAINT DF_contable_asientos_erp_enviado DEFAULT 0;
  END;

  IF COL_LENGTH('dbo.contable_asientos', 'erp_enviado_en') IS NULL
  BEGIN
    ALTER TABLE dbo.contable_asientos ADD erp_enviado_en datetimeoffset NULL;
  END;

  IF COL_LENGTH('dbo.contable_asientos', 'erp_ultimo_error') IS NULL
  BEGIN
    ALTER TABLE dbo.contable_asientos ADD erp_ultimo_error nvarchar(255) NULL;
  END;
END

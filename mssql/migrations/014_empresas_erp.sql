IF OBJECT_ID(N'[dbo].[empresas]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.empresas', 'erp_sync') IS NULL
    ALTER TABLE dbo.empresas ADD erp_sync bit NOT NULL CONSTRAINT DF_empresas_erp_sync DEFAULT 0;

  IF COL_LENGTH('dbo.empresas', 'erp_api_url') IS NULL
    ALTER TABLE dbo.empresas ADD erp_api_url nvarchar(500) NULL;

  IF COL_LENGTH('dbo.empresas', 'erp_api_token') IS NULL
    ALTER TABLE dbo.empresas ADD erp_api_token nvarchar(255) NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_empresas_erp_api_token_format' AND parent_object_id = OBJECT_ID(N'dbo.empresas'))
  BEGIN
    EXEC sp_executesql N'
      ALTER TABLE dbo.empresas
        ADD CONSTRAINT CK_empresas_erp_api_token_format
        CHECK (erp_api_token IS NULL OR erp_api_token NOT LIKE ''%[^0-9A-Za-z-]%'');
    ';
  END
END

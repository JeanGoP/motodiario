IF OBJECT_ID(N'[dbo].[municipios_dane]', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.municipios_dane (
    codigo NVARCHAR(16) NOT NULL,
    municipio NVARCHAR(128) NOT NULL,
    departamento NVARCHAR(128) NOT NULL,
    CONSTRAINT PK_municipios_dane PRIMARY KEY CLUSTERED (codigo)
  );

  CREATE INDEX IX_municipios_dane_municipio ON dbo.municipios_dane (municipio);
  CREATE INDEX IX_municipios_dane_departamento ON dbo.municipios_dane (departamento);
END;
